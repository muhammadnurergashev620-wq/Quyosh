import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import { normalizeUzPhone } from '../../common/utils/phone';
import { slugify } from '../../common/utils/slug';
import { UpdateShopDto } from './dto/shop.dto';

/** Foydalanuvchining egalik qiladigan do‘konlari soni chegarasi (egani almashtirishda tekshiriladi). */
export const MAX_OWNED_SHOPS = 3;

export const conflict = (code: string, message: string) => new DomainException(HttpStatus.CONFLICT, code, message);
export const invalidTransition = () => conflict('INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);

@Injectable()
export class ShopService {
  constructor(private readonly db: PrismaService) {}

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

  /** Bir telefon — bitta faol do‘kon (takroriy telefon bloklanadi, STIR kabi). */
  async assertShopPhoneFree(phone: string | undefined | null, exceptShopId?: string) {
    const normalized = phone ? normalizeUzPhone(phone) : null;
    if (!normalized) return;
    const taken = await this.db.shop.findFirst({ where: { phone: normalized, archivedAt: null, ...(exceptShopId ? { id: { not: exceptShopId } } : {}) }, select: { id: true } });
    if (taken) throw conflict('SHOP_PHONE_TAKEN', ERRORS.SHOP_PHONE_TAKEN);
  }

  /** GET /me/shops — foydalanuvchi a’zo bo‘lgan do‘konlar (do‘kon almashtirgich uchun). */
  async myShops(userId: string) {
    const rows = await this.db.shopMember.findMany({
      where: { userId, shop: { archivedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: { memberRole: true, permissions: true, shop: { select: { id: true, slug: true, name: true, status: true, suspendReason: true, verificationStatus: true, logoAssetId: true } } },
    });
    return rows.map(({ shop, memberRole, permissions }) => ({ ...shop, memberRole, permissions: memberRole === 'OWNER' ? ['*'] : permissions }));
  }

  /** Bosh panel: do‘kon ma’lumoti + «Profil to‘liqligi: N%» chek-listi (TZ 3.5, U11.2). */
  async getManaged(ctx: ShopContext) {
    const shop = await this.db.shop.findUnique({
      where: { id: ctx.shopId },
      include: {
        _count: { select: { branches: { where: { archivedAt: null } }, products: { where: { status: 'ACTIVE' } }, services: { where: { active: true } } } },
      },
    });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    const { _count, ...rest } = shop;
    const serviceAreas = await this.db.serviceArea.count({ where: { active: true, branch: { shopId: shop.id, archivedAt: null } } });
    const checklist = [
      { key: 'profile', done: !!shop.description && !!shop.logoAssetId },
      { key: 'branch', done: _count.branches > 0 },
      { key: 'serviceArea', done: serviceAreas > 0 },
      { key: 'products', done: _count.products > 0 },
    ];
    const completeness = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);
    return { ...rest, counts: _count, completeness, checklist, membership: { memberRole: ctx.memberRole, permissions: ctx.memberRole === 'OWNER' ? ['*'] : ctx.permissions } };
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
    if (dto.phone) await this.assertShopPhoneFree(dto.phone, ctx.shopId);
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
    return { shops, users, blocking: shops.some((shop) => (!!stir && shop.stir === stir) || (!!normalized && shop.phone === normalized)) };
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
