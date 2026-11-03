import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ShopStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import { normalizeUzPhone } from '../../common/utils/phone';
import { canTransition } from './shop-state-machine';
import { conflict, invalidTransition, ShopService } from './shop.service';
import { ShopMembersService } from './shop-members.service';
import { AdminCreateShopDto, AdminShopQueryDto } from './dto/shop.dto';

const OWNER_SELECT = { where: { memberRole: 'OWNER' as const }, select: { user: { select: { id: true, accountNumber: true, firstName: true, lastName: true, phone: true } } } };

/** Admin: do‘konlar ro‘yxati, tekshiruv, yaratish, to‘xtatish, egalikni o‘tkazish (TZ 3.7, U18.3). */
@Injectable()
export class AdminShopsService {
  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly shops: ShopService,
    private readonly members: ShopMembersService,
  ) {}

  private async actorKind(adminId: string): Promise<'ADMIN' | 'SUPER_ADMIN'> {
    const admin = await this.db.user.findUnique({ where: { id: adminId }, select: { isSuperAdmin: true } });
    return admin?.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN';
  }

  private async requireSuper(adminId: string) {
    if ((await this.actorKind(adminId)) !== 'SUPER_ADMIN') throw new ForbiddenException(ERRORS.SUPER_ADMIN_ONLY);
  }

  async list(query: AdminShopQueryDto) {
    const limit = Math.min(query.limit ?? 20, 100);
    const page = query.page ?? 1;
    const search = query.search?.trim();
    const phone = search ? normalizeUzPhone(search) : null;
    const where: Prisma.ShopWhereInput = {
      archivedAt: null,
      status: query.status,
      verificationStatus: query.verificationStatus,
      createdSource: query.source,
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { slug: { contains: search.toLowerCase() } }, { stir: search }, ...(phone ? [{ phone }] : [])] }
        : {}),
    };
    const [items, total, byStatus] = await Promise.all([
      this.db.shop.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, slug: true, name: true, stir: true, phone: true, status: true, verificationStatus: true, createdSource: true, ratingAvg: true, ratingCount: true, createdAt: true, logoAssetId: true,
          members: OWNER_SELECT,
          _count: { select: { branches: { where: { archivedAt: null } }, products: true, verificationDocs: true } },
        },
      }),
      this.db.shop.count({ where }),
      this.db.shop.groupBy({ by: ['status'], where: { archivedAt: null }, _count: true }),
    ]);
    return {
      items: items.map(({ members, ...shop }) => ({ ...shop, owner: members[0]?.user ?? null })),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: Object.fromEntries(byStatus.map((row) => [row.status, row._count])),
    };
  }

  async detail(shopId: string) {
    const shop = await this.db.shop.findFirst({
      where: { id: shopId, archivedAt: null },
      include: {
        members: { orderBy: { createdAt: 'asc' }, select: { id: true, memberRole: true, permissions: true, createdAt: true, user: { select: { id: true, accountNumber: true, firstName: true, lastName: true, phone: true, email: true } } } },
        invitations: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, select: { id: true, target: true, memberRole: true, purpose: true, expiresAt: true, createdAt: true } },
        verificationDocs: { orderBy: { createdAt: 'desc' } },
        branches: { where: { archivedAt: null }, orderBy: { createdAt: 'asc' } },
        createdBy: { select: { id: true, accountNumber: true, firstName: true, lastName: true } },
        _count: { select: { products: true, services: true } },
      },
    });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    const history = await this.db.auditLog.findMany({
      where: { targetType: 'Shop', targetId: shopId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, reason: true, before: true, after: true, createdAt: true, actor: { select: { id: true, accountNumber: true, firstName: true, lastName: true } } },
    });
    return { ...shop, history };
  }

  duplicates(stir?: string, phone?: string) {
    return this.shops.duplicates(stir, phone);
  }

  /** TZ 3.7.1: faqat superadmin; dublikatlar tekshiriladi; egasiga INITIAL_OWNER taklifi. */
  async create(adminId: string, dto: AdminCreateShopDto) {
    await this.requireSuper(adminId);
    const ownerTarget = this.members.normalizeTarget(dto.ownerTarget);
    const dup = await this.shops.duplicates(dto.stir, dto.phone);
    if (dup.blocking) throw conflict('SHOP_STIR_TAKEN', ERRORS.SHOP_STIR_TAKEN);
    if ((dup.shops.length > 0) && !dto.confirmDuplicates) {
      throw new DomainException(HttpStatus.CONFLICT, 'SHOP_DUPLICATE_WARNING', 'Shu telefon raqamli do‘kon mavjud. Davom etish uchun tasdiqlang');
    }
    const result = await this.db.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          slug: await this.shops.uniqueSlug(dto.name, tx),
          name: dto.name.trim(),
          phone: normalizeUzPhone(dto.phone),
          stir: dto.stir ?? null,
          createdSource: 'ADMIN',
          createdByUserId: adminId,
          ...(dto.activate ? { status: 'ACTIVE' as const, verificationStatus: 'VERIFIED' as const } : {}),
        },
      });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SHOP_CREATED', targetType: 'Shop', targetId: shop.id, after: { name: shop.name, source: 'ADMIN', status: shop.status, duplicatesConfirmed: !!dto.confirmDuplicates } } });
      const invite = await this.members.createInvitation(tx, { shopId: shop.id, invitedByUserId: adminId, target: ownerTarget, memberRole: 'OWNER', permissions: [], purpose: 'INITIAL_OWNER' });
      return { shop, invite };
    });
    const invitation = await this.members.deliver(result.invite, result.shop.name);
    return { shop: result.shop, invitation };
  }

  /** Egasiz do‘kon uchun boshlang‘ich ega taklifini qayta yuborish (eski PENDING bekor qilinadi). */
  async inviteOwner(adminId: string, shopId: string, rawTarget: string) {
    await this.requireSuper(adminId);
    const shop = await this.shops.findOrThrow(shopId);
    const target = this.members.normalizeTarget(rawTarget);
    const hasOwner = await this.db.shopMember.count({ where: { shopId, memberRole: 'OWNER' } });
    const purpose = hasOwner ? 'TRANSFER' : 'INITIAL_OWNER';
    const invite = await this.db.$transaction(async (tx) => {
      await tx.shopInvitation.updateMany({ where: { shopId, memberRole: 'OWNER', status: 'PENDING' }, data: { status: 'REVOKED' } });
      return this.members.createInvitation(tx, { shopId, invitedByUserId: adminId, target, memberRole: 'OWNER', permissions: [], purpose });
    });
    return this.members.deliver(invite, shop.name);
  }

  /** Tasdiqlash: PENDING_REVIEW → ACTIVE, hujjatlar APPROVED. Egasiz do‘kon faollashmaydi. */
  async approve(adminId: string, shopId: string) {
    const actor = await this.actorKind(adminId);
    const shop = await this.shops.findOrThrow(shopId);
    if (!canTransition(shop.status, 'ACTIVE', actor) || shop.status === 'SUSPENDED') throw invalidTransition();
    const owners = await this.db.shopMember.count({ where: { shopId, memberRole: 'OWNER' } });
    if (owners === 0) throw conflict('SHOP_OWNER_REQUIRED', ERRORS.SHOP_OWNER_REQUIRED);
    return this.transition(adminId, shop.id, shop.status, { status: 'ACTIVE', verificationStatus: 'VERIFIED' }, 'SHOP_VERIFICATION_APPROVED', null, async (tx) => {
      await tx.shopVerificationDocument.updateMany({ where: { shopId, status: 'PENDING' }, data: { status: 'ACCEPTED', reviewerId: adminId, reviewedAt: new Date() } });
    }, { title: 'Do‘kon tasdiqlandi', body: `«${shop.name}» tekshiruvdan o‘tdi va katalogda ko‘rinadi.` });
  }

  /** Rad etish: PENDING_REVIEW → DRAFT, sabab majburiy (ega ko‘radi). */
  async reject(adminId: string, shopId: string, reason: string) {
    const actor = await this.actorKind(adminId);
    const shop = await this.shops.findOrThrow(shopId);
    if (shop.status !== 'PENDING_REVIEW' || !canTransition(shop.status, 'DRAFT', actor)) throw invalidTransition();
    return this.transition(adminId, shop.id, shop.status, { status: 'DRAFT', verificationStatus: 'REJECTED' }, 'SHOP_VERIFICATION_REJECTED', reason, async (tx) => {
      await tx.shopVerificationDocument.updateMany({ where: { shopId, status: 'PENDING' }, data: { status: 'REJECTED', reviewerId: adminId, reviewedAt: new Date(), reason } });
    }, { title: 'Do‘kon tekshiruvi rad etildi', body: `Sabab: ${reason}` });
  }

  async suspend(adminId: string, shopId: string, reason: string) {
    await this.requireSuper(adminId);
    const shop = await this.shops.findOrThrow(shopId);
    if (!canTransition(shop.status, 'SUSPENDED', 'SUPER_ADMIN')) throw invalidTransition();
    return this.transition(adminId, shop.id, shop.status, { status: 'SUSPENDED', suspendedAt: new Date(), suspendReason: reason }, 'SHOP_SUSPENDED', reason, undefined, { title: 'Do‘kon to‘xtatildi', body: `Sabab: ${reason}` });
  }

  async resume(adminId: string, shopId: string) {
    await this.requireSuper(adminId);
    const shop = await this.shops.findOrThrow(shopId);
    if (!canTransition(shop.status, 'ACTIVE', 'SUPER_ADMIN') || shop.status !== 'SUSPENDED') throw invalidTransition();
    return this.transition(adminId, shop.id, shop.status, { status: 'ACTIVE', suspendedAt: null, suspendReason: null }, 'SHOP_RESUMED', null, undefined, { title: 'Do‘kon qayta faollashtirildi', body: `«${shop.name}» yana ishlamoqda.` });
  }

  private async transition(
    adminId: string,
    shopId: string,
    from: ShopStatus,
    data: Prisma.ShopUpdateManyMutationInput,
    action: string,
    reason: string | null,
    extra?: (tx: Prisma.TransactionClient) => Promise<void>,
    notify?: { title: string; body: string },
  ) {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.shop.updateMany({ where: { id: shopId, status: from }, data });
      if (updated.count === 0) throw invalidTransition();
      if (extra) await extra(tx);
      await tx.auditLog.create({ data: { actorId: adminId, action, reason, targetType: 'Shop', targetId: shopId, before: { status: from }, after: { status: (data.status as string) ?? from } } });
      if (notify) {
        const owner = await tx.shopMember.findFirst({ where: { shopId, memberRole: 'OWNER' }, select: { userId: true } });
        if (owner) await this.outbox.emit(tx, { eventName: `shop.${action.toLowerCase()}`, aggregateType: 'Shop', aggregateId: shopId, payload: { userId: owner.userId, ...notify }, createdById: adminId });
      }
      return tx.shop.findUniqueOrThrow({ where: { id: shopId } });
    });
  }
}
