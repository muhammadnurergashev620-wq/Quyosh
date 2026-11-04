import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, ShopStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DEFAULT_PERMISSIONS } from '../../common/constants/shop-permissions';
import { DomainException } from '../../common/exceptions/business.exception';
import { hashSecret } from '../../common/security/hash';
import { generateTempPassword } from '../../common/security/temp-password';
import { normalizeUzPhone } from '../../common/utils/phone';
import { canTransition } from './shop-state-machine';
import { conflict, invalidTransition, ShopService } from './shop.service';
import { AdminAddMemberDto, AdminCreateShopDto, AdminShopQueryDto } from './dto/shop.dto';

const OWNER_SELECT = { where: { memberRole: 'OWNER' as const }, select: { user: { select: { id: true, accountNumber: true, firstName: true, lastName: true, phone: true } } } };
const MEMBER_USER = { id: true, accountNumber: true, firstName: true, lastName: true, phone: true, email: true, mustPasswordChange: true } as const;

/** Vaqtincha parol bilan yaratilgan/tiklangan hisob: parol javobda BIR MARTA qaytadi (bazada faqat hash, logga yozilmaydi). */
interface IssuedAccount {
  user: { id: string; phone: string | null; firstName: string | null; lastName: string | null };
  temporaryPassword: string;
}

/**
 * Admin: do‘kon yaratish (egasining hisobi bilan), a’zo qo‘shish, parolni tiklash, egani almashtirish,
 * to‘xtatish/qayta yoqish (TZ 3.7). Huquq — `SHOPS` (controller); har amal AuditLog’ga yoziladi.
 */
@Injectable()
export class AdminShopsService {
  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly shops: ShopService,
  ) {}

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
          _count: { select: { branches: { where: { archivedAt: null } }, products: true } },
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
        members: { orderBy: { createdAt: 'asc' }, select: { id: true, memberRole: true, permissions: true, createdAt: true, user: { select: MEMBER_USER } } },
        certifications: { orderBy: { createdAt: 'desc' } },
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

  /** Foydalanuvchi uchun login (telefon) band emasligini tekshiradi: mavjud akkaunt do‘konga bog‘lanmaydi. */
  private async assertPhoneFree(phone: string, tx: Prisma.TransactionClient = this.db) {
    const taken = await tx.user.findFirst({ where: { phone }, select: { id: true } });
    if (taken) throw conflict('PHONE_TAKEN', ERRORS.SHOP_PHONE_TAKEN_BY_USER);
  }

  /** SHOP rolli hisob + vaqtincha parol (mustPasswordChange = true). Parol faqat qaytariladi. */
  private async newShopAccount(
    tx: Prisma.TransactionClient,
    input: { phone: string; firstName: string; lastName?: string },
    passwordHash: string,
  ) {
    return tx.user.create({
      data: {
        phone: input.phone,
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || null,
        status: 'ACTIVE',
        phoneVerifiedAt: new Date(),
        passwordHash,
        mustPasswordChange: true,
        userRoles: { create: [{ role: Role.SHOP }] },
      },
      select: { id: true, phone: true, firstName: true, lastName: true },
    });
  }

  /** TZ 3.7.1: do‘kon + birinchi filial + egasining hisobi (OWNER) — bitta tranzaksiyada; do‘kon darhol ACTIVE/VERIFIED. */
  async create(adminId: string, dto: AdminCreateShopDto) {
    const phone = normalizeUzPhone(dto.phone)!;
    const ownerPhone = normalizeUzPhone(dto.ownerPhone)!;
    const dup = await this.shops.duplicates(dto.stir, phone);
    if (dup.blocking) throw conflict('SHOP_STIR_TAKEN', ERRORS.SHOP_STIR_TAKEN);
    if (dup.shops.length > 0 && !dto.confirmDuplicates) {
      throw new DomainException(HttpStatus.CONFLICT, 'SHOP_DUPLICATE_WARNING', 'Shu telefon raqamli do‘kon mavjud. Davom etish uchun tasdiqlang');
    }
    await this.assertPhoneFree(ownerPhone);

    const temporaryPassword = generateTempPassword();
    const passwordHash = await hashSecret(temporaryPassword, 12);
    const { shop, owner } = await this.db.$transaction(async (tx) => {
      await this.assertPhoneFree(ownerPhone, tx);
      const user = await this.newShopAccount(tx, { phone: ownerPhone, firstName: dto.ownerFirstName, lastName: dto.ownerLastName }, passwordHash);
      const created = await tx.shop.create({
        data: {
          slug: await this.shops.uniqueSlug(dto.name, tx),
          name: dto.name.trim(),
          phone,
          stir: dto.stir,
          createdSource: 'ADMIN',
          createdByUserId: adminId,
          status: 'ACTIVE',
          verificationStatus: 'VERIFIED',
          members: { create: { userId: user.id, memberRole: 'OWNER' } },
          branches: { create: { name: 'Asosiy filial', address: dto.address.trim(), regionCode: dto.regionCode, phone } },
        },
      });
      // Parol audit va logga tushmaydi — faqat kim va nima yaratilgani.
      await tx.auditLog.create({
        data: { actorId: adminId, action: 'SHOP_CREATED', targetType: 'Shop', targetId: created.id, after: { name: created.name, stir: created.stir, source: 'ADMIN', status: created.status, ownerUserId: user.id, duplicatesConfirmed: !!dto.confirmDuplicates } },
      });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SHOP_ACCOUNT_CREATED', targetType: 'User', targetId: user.id, after: { shopId: created.id, role: 'OWNER', mustPasswordChange: true } } });
      return { shop: created, owner: user };
    });
    return { shop, owner, temporaryPassword };
  }

  /** TZ 3.7.2: xodim qo‘shish — hisob (login + vaqtincha parol) va ShopMember(MANAGER/STAFF). */
  async addMember(adminId: string, shopId: string, dto: AdminAddMemberDto) {
    const shop = await this.shops.findOrThrow(shopId);
    const phone = normalizeUzPhone(dto.phone)!;
    await this.assertPhoneFree(phone);
    const temporaryPassword = generateTempPassword();
    const passwordHash = await hashSecret(temporaryPassword, 12);
    const { user, member } = await this.db.$transaction(async (tx) => {
      await this.assertPhoneFree(phone, tx);
      const created = await this.newShopAccount(tx, { phone, firstName: dto.firstName, lastName: dto.lastName }, passwordHash);
      const row = await tx.shopMember.create({
        data: { shopId: shop.id, userId: created.id, memberRole: dto.memberRole, permissions: dto.permissions ?? DEFAULT_PERMISSIONS[dto.memberRole] },
        select: { id: true, memberRole: true, permissions: true },
      });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SHOP_MEMBER_ADDED', targetType: 'Shop', targetId: shop.id, after: { userId: created.id, memberRole: row.memberRole, permissions: row.permissions } } });
      return { user: created, member: row };
    });
    return { member, user, temporaryPassword } satisfies { member: unknown } & IssuedAccount;
  }

  /** Parolni tiklash: yangi vaqtincha parol, mustPasswordChange = true, barcha sessiyalar bekor qilinadi. */
  async resetMemberPassword(adminId: string, shopId: string, userId: string) {
    const shop = await this.shops.findOrThrow(shopId);
    const member = await this.db.shopMember.findFirst({ where: { shopId: shop.id, userId }, select: { id: true, memberRole: true, user: { select: { id: true, phone: true, firstName: true, lastName: true, deletedAt: true } } } });
    if (!member || member.user.deletedAt) throw new NotFoundException(ERRORS.SHOP_MEMBER_NOT_FOUND);
    const temporaryPassword = generateTempPassword();
    const passwordHash = await hashSecret(temporaryPassword, 12);
    const revokedAt = new Date();
    const sessions = await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash, mustPasswordChange: true } });
      await tx.refreshToken.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt } });
      const revoked = await tx.deviceSession.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SHOP_PASSWORD_RESET', targetType: 'User', targetId: userId, after: { shopId: shop.id, memberRole: member.memberRole, revokedSessions: revoked.count } } });
      return revoked.count;
    });
    return { user: member.user && { id: member.user.id, phone: member.user.phone, firstName: member.user.firstName, lastName: member.user.lastName }, temporaryPassword, revokedSessions: sessions };
  }

  /** Egani almashtirish: mavjud a’zo OWNER, eski ega MANAGER (bitta OWNER — partial unique, shuning uchun avval pasaytiriladi). */
  async changeOwner(adminId: string, shopId: string, userId: string, reason: string) {
    const shop = await this.shops.findOrThrow(shopId);
    const target = await this.db.shopMember.findFirst({ where: { shopId: shop.id, userId }, select: { id: true, memberRole: true } });
    if (!target) throw new NotFoundException(ERRORS.SHOP_MEMBER_NOT_FOUND);
    if (target.memberRole === 'OWNER') throw conflict('SHOP_ALREADY_OWNER', 'Bu a’zo allaqachon do‘kon egasi');
    return this.db.$transaction(async (tx) => {
      await this.shops.assertOwnerLimit(userId, tx);
      const previous = await tx.shopMember.findFirst({ where: { shopId: shop.id, memberRole: 'OWNER' }, select: { id: true, userId: true } });
      if (previous) await tx.shopMember.update({ where: { id: previous.id }, data: { memberRole: 'MANAGER', permissions: DEFAULT_PERMISSIONS.MANAGER } });
      await tx.shopMember.update({ where: { id: target.id }, data: { memberRole: 'OWNER', permissions: [] } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SHOP_OWNER_CHANGED', reason, targetType: 'Shop', targetId: shop.id, before: { ownerUserId: previous?.userId ?? null }, after: { ownerUserId: userId } } });
      for (const id of [previous?.userId, userId]) {
        if (!id) continue;
        await this.outbox.emit(tx, { eventName: 'shop.owner_changed', aggregateType: 'Shop', aggregateId: shop.id, payload: { userId: id, title: 'Do‘kon egasi o‘zgardi', body: `«${shop.name}» do‘konining egasi almashtirildi.` }, createdById: adminId });
      }
      return { shopId: shop.id, ownerUserId: userId, previousOwnerUserId: previous?.userId ?? null };
    });
  }

  async suspend(adminId: string, shopId: string, reason: string) {
    const shop = await this.shops.findOrThrow(shopId);
    if (!canTransition(shop.status, 'SUSPENDED', 'ADMIN')) throw invalidTransition();
    return this.transition(adminId, shop.id, shop.status, { status: 'SUSPENDED', suspendedAt: new Date(), suspendReason: reason }, 'SHOP_SUSPENDED', reason, { title: 'Do‘kon to‘xtatildi', body: `Sabab: ${reason}` });
  }

  async resume(adminId: string, shopId: string) {
    const shop = await this.shops.findOrThrow(shopId);
    if (!canTransition(shop.status, 'ACTIVE', 'ADMIN')) throw invalidTransition();
    return this.transition(adminId, shop.id, shop.status, { status: 'ACTIVE', suspendedAt: null, suspendReason: null }, 'SHOP_RESUMED', null, { title: 'Do‘kon qayta faollashtirildi', body: `«${shop.name}» yana ishlamoqda.` });
  }

  private async transition(
    adminId: string,
    shopId: string,
    from: ShopStatus,
    data: Prisma.ShopUpdateManyMutationInput,
    action: string,
    reason: string | null,
    notify?: { title: string; body: string },
  ) {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.shop.updateMany({ where: { id: shopId, status: from }, data });
      if (updated.count === 0) throw invalidTransition();
      await tx.auditLog.create({ data: { actorId: adminId, action, reason, targetType: 'Shop', targetId: shopId, before: { status: from }, after: { status: (data.status as string) ?? from } } });
      if (notify) {
        const owner = await tx.shopMember.findFirst({ where: { shopId, memberRole: 'OWNER' }, select: { userId: true } });
        if (owner) await this.outbox.emit(tx, { eventName: `shop.${action.toLowerCase()}`, aggregateType: 'Shop', aggregateId: shopId, payload: { userId: owner.userId, ...notify }, createdById: adminId });
      }
      return tx.shop.findUniqueOrThrow({ where: { id: shopId } });
    });
  }
}
