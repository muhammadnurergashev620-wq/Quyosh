import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import { normalizeUzPhone } from '../../common/utils/phone';
import { slugify } from '../../common/utils/slug';
import { canTransition } from './shop-state-machine';
import { CreateShopDto, UpdateShopDto, VerificationDocumentDto } from './dto/shop.dto';

/** TZ 3.7.2: foydalanuvchining egalik qiladigan do‘konlari soni chegarasi. */
export const MAX_OWNED_SHOPS = 3;

export const conflict = (code: string, message: string) => new DomainException(HttpStatus.CONFLICT, code, message);
export const invalidTransition = () => conflict('INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);

@Injectable()
export class ShopService {
  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  /** Bo‘sh slug: nomdan yasaladi, band bo‘lsa -2, -3 … qo‘shiladi. */
  async uniqueSlug(name: string, tx: Prisma.TransactionClient = this.db): Promise<string> {
    const base = slugify(name);
    for (let i = 1; i < 200; i += 1) {
      const candidate = i === 1 ? base : `${base}-${i}`.slice(0, 120);
      if (!(await tx.shop.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  async assertOwnerLimit(userId: string, tx: Prisma.TransactionClient = this.db) {
    const owned = await tx.shopMember.count({ where: { userId, memberRole: 'OWNER', shop: { archivedAt: null } } });
    if (owned >= MAX_OWNED_SHOPS) throw conflict('SHOP_LIMIT_REACHED', ERRORS.SHOP_LIMIT_REACHED);
  }

  async assertStirFree(stir: string | undefined | null, exceptShopId?: string) {
    if (!stir) return;
    const taken = await this.db.shop.findFirst({ where: { stir, archivedAt: null, ...(exceptShopId ? { id: { not: exceptShopId } } : {}) }, select: { id: true } });
    if (taken) throw conflict('SHOP_STIR_TAKEN', ERRORS.SHOP_STIR_TAKEN);
  }

  /** TZ 3.5: foydalanuvchi o‘zi do‘kon ochadi → DRAFT, OWNER a’zolik, SHOP roli. */
  async createSelf(userId: string, dto: CreateShopDto) {
    const phone = normalizeUzPhone(dto.phone);
    await this.assertStirFree(dto.stir);
    return this.db.$transaction(async (tx) => {
      await this.assertOwnerLimit(userId, tx);
      const shop = await tx.shop.create({
        data: {
          slug: await this.uniqueSlug(dto.name, tx),
          name: dto.name.trim(),
          phone,
          stir: dto.stir ?? null,
          createdSource: 'SELF',
          createdByUserId: userId,
          members: { create: { userId, memberRole: 'OWNER' } },
        },
      });
      await tx.userRole.upsert({ where: { userId_role: { userId, role: Role.SHOP } }, update: {}, create: { userId, role: Role.SHOP } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'SHOP_CREATED', targetType: 'Shop', targetId: shop.id, after: { name: shop.name, source: 'SELF', activities: dto.activities ?? [] } } });
      return shop;
    });
  }

  /** GET /me/shops — foydalanuvchi a’zo bo‘lgan do‘konlar (do‘kon almashtirgich uchun). */
  async myShops(userId: string) {
    const rows = await this.db.shopMember.findMany({
      where: { userId, shop: { archivedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: { memberRole: true, permissions: true, shop: { select: { id: true, slug: true, name: true, status: true, verificationStatus: true, logoAssetId: true } } },
    });
    return rows.map(({ shop, memberRole, permissions }) => ({ ...shop, memberRole, permissions: memberRole === 'OWNER' ? ['*'] : permissions }));
  }

  /** Bosh panel: do‘kon ma’lumoti + «Profil to‘liqligi: N%» chek-listi (TZ 3.5, U11.1). */
  async getManaged(ctx: ShopContext) {
    const shop = await this.db.shop.findUnique({
      where: { id: ctx.shopId },
      include: {
        _count: { select: { branches: { where: { archivedAt: null } }, products: { where: { status: 'ACTIVE' } }, verificationDocs: true, services: { where: { active: true } } } },
      },
    });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    const { _count, ...rest } = shop;
    const serviceAreas = await this.db.serviceArea.count({ where: { active: true, branch: { shopId: shop.id, archivedAt: null } } });
    const checklist = [
      { key: 'profile', done: !!shop.description && !!shop.logoAssetId },
      { key: 'branch', done: _count.branches > 0 },
      { key: 'serviceArea', done: serviceAreas > 0 },
      { key: 'verification', done: _count.verificationDocs > 0 },
      { key: 'products', done: _count.products > 0 },
    ];
    const completeness = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);
    const lastRejection =
      shop.verificationStatus === 'REJECTED'
        ? await this.db.auditLog.findFirst({ where: { targetType: 'Shop', targetId: shop.id, action: 'SHOP_VERIFICATION_REJECTED' }, orderBy: { createdAt: 'desc' }, select: { reason: true, createdAt: true } })
        : null;
    return { ...rest, counts: _count, completeness, checklist, rejection: lastRejection, membership: { memberRole: ctx.memberRole, permissions: ctx.memberRole === 'OWNER' ? ['*'] : ctx.permissions } };
  }

  private async assertShopAsset(shopId: string, assetId: string, kinds: string[]) {
    const asset = await this.db.mediaAsset.findUnique({ where: { id: assetId }, select: { kind: true, linkedResourceType: true, linkedResourceId: true } });
    if (!asset || asset.linkedResourceType !== 'Shop' || asset.linkedResourceId !== shopId || !kinds.includes(asset.kind)) {
      throw new NotFoundException(ERRORS.MEDIA_NOT_FOUND);
    }
  }

  async updateProfile(ctx: ShopContext, actorId: string, dto: UpdateShopDto) {
    const before = await this.db.shop.findUniqueOrThrow({ where: { id: ctx.shopId } });
    if (dto.stir !== undefined) await this.assertStirFree(dto.stir, ctx.shopId);
    if (dto.logoAssetId) await this.assertShopAsset(ctx.shopId, dto.logoAssetId, ['SHOP_LOGO']);
    if (dto.coverAssetId) await this.assertShopAsset(ctx.shopId, dto.coverAssetId, ['SHOP_LOGO', 'PORTFOLIO']);
    const data: Prisma.ShopUpdateInput = {
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      phone: dto.phone ? normalizeUzPhone(dto.phone) : undefined,
      email: dto.email?.trim().toLowerCase(),
      stir: dto.stir,
      logoAssetId: dto.logoAssetId,
      coverAssetId: dto.coverAssetId,
    };
    return this.db.$transaction(async (tx) => {
      const shop = await tx.shop.update({ where: { id: ctx.shopId }, data });
      await tx.auditLog.create({
        data: { actorId, action: 'SHOP_PROFILE_UPDATED', targetType: 'Shop', targetId: ctx.shopId, before: { name: before.name, phone: before.phone, stir: before.stir }, after: { name: shop.name, phone: shop.phone, stir: shop.stir } },
      });
      return shop;
    });
  }

  async addVerificationDocument(ctx: ShopContext, actorId: string, dto: VerificationDocumentDto) {
    await this.assertShopAsset(ctx.shopId, dto.fileId, ['VERIFICATION_DOC']);
    return this.db.$transaction(async (tx) => {
      const doc = await tx.shopVerificationDocument.create({ data: { shopId: ctx.shopId, fileId: dto.fileId, docType: dto.docType } });
      await tx.auditLog.create({ data: { actorId, action: 'SHOP_VERIFICATION_DOC_ADDED', targetType: 'Shop', targetId: ctx.shopId, after: { docType: dto.docType } } });
      return doc;
    });
  }

  listVerificationDocuments(shopId: string) {
    return this.db.shopVerificationDocument.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' } });
  }

  /** TZ 3.5/3.7: ega tekshiruvga yuboradi (DRAFT → PENDING_REVIEW). */
  async submitForReview(ctx: ShopContext, actorId: string) {
    const shop = await this.db.shop.findUniqueOrThrow({ where: { id: ctx.shopId }, select: { status: true } });
    if (!canTransition(shop.status, 'PENDING_REVIEW', 'OWNER')) throw invalidTransition();
    const docs = await this.db.shopVerificationDocument.count({ where: { shopId: ctx.shopId, status: { not: 'REJECTED' } } });
    if (docs === 0) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', ERRORS.SHOP_VERIFICATION_DOCS_REQUIRED);
    return this.db.$transaction(async (tx) => {
      // Shartli yangilash: parallel so‘rovda holat o‘zgarib ketgan bo‘lsa — 409.
      const updated = await tx.shop.updateMany({ where: { id: ctx.shopId, status: shop.status }, data: { status: 'PENDING_REVIEW', verificationStatus: 'PENDING' } });
      if (updated.count === 0) throw invalidTransition();
      await tx.auditLog.create({ data: { actorId, action: 'SHOP_SUBMITTED_FOR_REVIEW', targetType: 'Shop', targetId: ctx.shopId, before: { status: shop.status }, after: { status: 'PENDING_REVIEW' } } });
      await this.outbox.emit(tx, { eventName: 'shop.submitted', aggregateType: 'Shop', aggregateId: ctx.shopId, payload: { shopId: ctx.shopId }, createdById: actorId });
      return tx.shop.findUniqueOrThrow({ where: { id: ctx.shopId } });
    });
  }

  /** Yaroqlilik: public ro‘yxatda ko‘rinish shartlari (TZ 3.5, 3.7.2 qoida 5). */
  static publicWhere(): Prisma.ShopWhereInput {
    return { status: 'ACTIVE', verificationStatus: 'VERIFIED', archivedAt: null, members: { some: { memberRole: 'OWNER' } } };
  }

  /** Bir xil STIR/telefon bo‘yicha mavjud do‘kon va foydalanuvchilar (TZ 3.7.1, admin yaratishda). */
  async duplicates(stir?: string, phone?: string) {
    const normalized = phone ? normalizeUzPhone(phone) : null;
    const [shops, users] = await Promise.all([
      stir || normalized
        ? this.db.shop.findMany({
            where: { archivedAt: null, OR: [...(stir ? [{ stir }] : []), ...(normalized ? [{ phone: normalized }] : [])] },
            select: { id: true, name: true, slug: true, status: true, stir: true, phone: true },
            take: 10,
          })
        : Promise.resolve([] as Array<{ id: string; name: string; slug: string; status: string; stir: string | null; phone: string | null }>),
      normalized ? this.db.user.findMany({ where: { phone: normalized, deletedAt: null }, select: { id: true, accountNumber: true, firstName: true, lastName: true, createdAt: true }, take: 5 }) : Promise.resolve([]),
    ]);
    return { shops, users, blocking: shops.some((shop) => !!stir && shop.stir === stir) };
  }

  async findOrThrow(shopId: string) {
    const shop = await this.db.shop.findFirst({ where: { id: shopId, archivedAt: null } });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    return shop;
  }

  conflictIfExists(exists: boolean, code: string, message: string) {
    if (exists) throw new ConflictException({ code, message });
  }
}
