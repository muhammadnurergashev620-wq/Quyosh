import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import { tashkentDate } from '../../common/utils/tashkent-date';
import { ExchangeRateService } from './exchange-rate.service';
import { BulkProductsDto, OfferDto, ShopProductDto, ShopProductQueryDto, UpdateOfferDto, UpdateShopProductDto } from './dto/catalog.dto';

const conflict = (code: string, message: string) => new DomainException(HttpStatus.CONFLICT, code, message);
const invalid = (message: string) => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', message);
const versionConflict = () => conflict('VERSION_CONFLICT', ERRORS.VERSION_CONFLICT);

/** Sana oralig‘i: validUntil ≥ validFrom (TZ 9.7: «sanalar valid»). */
export function offerDates(dto: Pick<OfferDto, 'validFrom' | 'validUntil'>) {
  const validFrom = dto.validFrom ? new Date(dto.validFrom.slice(0, 10)) : new Date(tashkentDate());
  const validUntil = dto.validUntil ? new Date(dto.validUntil.slice(0, 10)) : null;
  if (validUntil && validUntil < validFrom) throw invalid('Amal qilish muddati boshlanish sanasidan oldin bo‘lishi mumkin emas');
  return { validFrom, validUntil };
}

/** Do‘kon katalogi: ShopProduct va ProductOffer (TZ 9.7, U11.6). */
@Injectable()
export class ShopCatalogService {
  constructor(
    private readonly db: PrismaService,
    private readonly rates: ExchangeRateService,
  ) {}

  async list(shopId: string, query: ShopProductQueryDto) {
    const limit = query.limit ?? 30;
    const page = query.page ?? 1;
    const q = query.q?.trim();
    const where: Prisma.ShopProductWhereInput = {
      shopId,
      status: query.status ?? { not: 'ARCHIVED' },
      productModel: {
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(q ? { OR: [{ brand: { contains: q, mode: 'insensitive' } }, { model: { contains: q, mode: 'insensitive' } }] } : {}),
      },
    };
    const [items, total, counts] = await Promise.all([
      this.db.shopProduct.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          productModel: { select: { id: true, slug: true, brand: true, model: true, status: true, nominalPowerW: true, inverterAcKw: true, batteryCapacityKwh: true, category: { select: { id: true, slug: true, nameI18n: true } } } },
          offers: { orderBy: { createdAt: 'asc' }, include: { branch: { select: { id: true, name: true } } } },
        },
      }),
      this.db.shopProduct.count({ where }),
      this.db.shopProduct.groupBy({ by: ['status'], where: { shopId }, _count: true }),
    ]);
    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), counts: Object.fromEntries(counts.map((row) => [row.status, row._count])), rate: await this.rates.latest('USD') };
  }

  private async productOrThrow(shopId: string, productId: string) {
    const product = await this.db.shopProduct.findFirst({ where: { id: productId, shopId } });
    if (!product) throw new NotFoundException(ERRORS.SHOP_PRODUCT_NOT_FOUND);
    return product;
  }

  private async assertBranch(shopId: string, branchId?: string | null) {
    if (!branchId) return;
    const branch = await this.db.shopBranch.findFirst({ where: { id: branchId, shopId, archivedAt: null }, select: { id: true } });
    if (!branch) throw new NotFoundException(ERRORS.BRANCH_NOT_FOUND);
  }

  async get(shopId: string, productId: string) {
    const product = await this.db.shopProduct.findFirst({
      where: { id: productId, shopId },
      include: { productModel: { include: { category: { select: { id: true, slug: true, nameI18n: true } }, images: true } }, offers: { orderBy: { createdAt: 'asc' }, include: { branch: { select: { id: true, name: true } } } } },
    });
    if (!product) throw new NotFoundException(ERRORS.SHOP_PRODUCT_NOT_FOUND);
    return product;
  }

  /** Faqat APPROVED model (TZ 9.7). Do‘kon o‘zi taklif qilgan PENDING model — DRAFT holatda qo‘shiladi, tasdiqlangach faollashtiriladi. */
  async create(shopId: string, actorId: string, dto: ShopProductDto) {
    const model = await this.db.productModel.findUnique({ where: { id: dto.productModelId }, select: { id: true, status: true, proposedByShopId: true } });
    if (!model || model.status === 'MERGED' || model.status === 'REJECTED') throw new NotFoundException(ERRORS.PRODUCT_MODEL_NOT_FOUND);
    const ownPending = model.status === 'PENDING' && model.proposedByShopId === shopId;
    if (model.status !== 'APPROVED' && !ownPending) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'PRODUCT_MODEL_NOT_APPROVED', ERRORS.PRODUCT_MODEL_NOT_APPROVED);
    const status = ownPending ? 'DRAFT' : (dto.status ?? 'ACTIVE');
    if (ownPending && dto.status === 'ACTIVE') throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'PRODUCT_MODEL_NOT_APPROVED', ERRORS.PRODUCT_MODEL_NOT_APPROVED);
    if (await this.db.shopProduct.findUnique({ where: { shopId_productModelId: { shopId, productModelId: model.id } }, select: { id: true } })) {
      throw conflict('SHOP_PRODUCT_EXISTS', ERRORS.SHOP_PRODUCT_EXISTS);
    }
    if (dto.offer) await this.assertBranch(shopId, dto.offer.branchId);
    const dates = dto.offer ? offerDates(dto.offer) : null;
    return this.db.$transaction(async (tx) => {
      const product = await tx.shopProduct.create({ data: { shopId, productModelId: model.id, description: dto.description?.trim(), status } });
      if (dto.offer && dates) {
        await tx.productOffer.create({ data: { shopProductId: product.id, branchId: dto.offer.branchId ?? null, price: dto.offer.price, currency: dto.offer.currency, vatIncluded: dto.offer.vatIncluded, stockStatus: dto.offer.stockStatus, quantity: dto.offer.quantity ?? null, ...dates } });
      }
      await tx.auditLog.create({ data: { actorId, action: 'SHOP_PRODUCT_CREATED', targetType: 'Shop', targetId: shopId, after: { productId: product.id, productModelId: model.id, status } } });
      return tx.shopProduct.findUniqueOrThrow({ where: { id: product.id }, include: { offers: true } });
    });
  }

  async update(shopId: string, actorId: string, productId: string, dto: UpdateShopProductDto) {
    const current = await this.productOrThrow(shopId, productId);
    if (dto.status === 'ACTIVE' && current.status !== 'ACTIVE') {
      const model = await this.db.productModel.findUnique({ where: { id: current.productModelId }, select: { status: true } });
      if (model?.status !== 'APPROVED') throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'PRODUCT_MODEL_NOT_APPROVED', ERRORS.PRODUCT_MODEL_NOT_APPROVED);
    }
    return this.db.$transaction(async (tx) => {
      const result = await tx.shopProduct.updateMany({ where: { id: productId, shopId, version: dto.version }, data: { description: dto.description?.trim(), status: dto.status, version: { increment: 1 } } });
      if (result.count === 0) throw versionConflict();
      await tx.auditLog.create({ data: { actorId, action: 'SHOP_PRODUCT_UPDATED', targetType: 'Shop', targetId: shopId, before: { productId, status: current.status }, after: { status: dto.status ?? current.status } } });
      return tx.shopProduct.findUniqueOrThrow({ where: { id: productId }, include: { offers: true } });
    });
  }

  /** O‘chirish o‘rniga arxiv: yuborilgan takliflardagi snapshotlar buzilmasin. */
  async archive(shopId: string, actorId: string, productId: string) {
    await this.productOrThrow(shopId, productId);
    await this.db.shopProduct.update({ where: { id: productId }, data: { status: 'ARCHIVED', version: { increment: 1 } } });
    await this.db.auditLog.create({ data: { actorId, action: 'SHOP_PRODUCT_ARCHIVED', targetType: 'Shop', targetId: shopId, after: { productId } } });
    return { id: productId, status: 'ARCHIVED' };
  }

  // ───────────── Narxlar (offers) ─────────────

  async listOffers(shopId: string, productId: string) {
    await this.productOrThrow(shopId, productId);
    return this.db.productOffer.findMany({ where: { shopProductId: productId }, orderBy: { createdAt: 'asc' }, include: { branch: { select: { id: true, name: true } } } });
  }

  async createOffer(shopId: string, actorId: string, productId: string, dto: OfferDto) {
    await this.productOrThrow(shopId, productId);
    await this.assertBranch(shopId, dto.branchId);
    const offer = await this.db.productOffer.create({
      data: { shopProductId: productId, branchId: dto.branchId ?? null, price: dto.price, currency: dto.currency, vatIncluded: dto.vatIncluded, stockStatus: dto.stockStatus, quantity: dto.quantity ?? null, ...offerDates(dto) },
    });
    await this.db.auditLog.create({ data: { actorId, action: 'OFFER_CREATED', targetType: 'Shop', targetId: shopId, after: { offerId: offer.id, productId, price: offer.price.toString(), currency: offer.currency } } });
    return offer;
  }

  /** Inline tahrir (U11.6): eskirgan versiya — 409 «boshqa xodim o‘zgartirgan». */
  async updateOffer(shopId: string, actorId: string, productId: string, offerId: string, dto: UpdateOfferDto) {
    await this.productOrThrow(shopId, productId);
    const current = await this.db.productOffer.findFirst({ where: { id: offerId, shopProductId: productId } });
    if (!current) throw new NotFoundException(ERRORS.OFFER_NOT_FOUND);
    await this.assertBranch(shopId, dto.branchId);
    const dates = offerDates({ validFrom: dto.validFrom ?? current.validFrom.toISOString(), validUntil: dto.validUntil === undefined ? current.validUntil?.toISOString() : dto.validUntil });
    return this.db.$transaction(async (tx) => {
      const result = await tx.productOffer.updateMany({
        where: { id: offerId, shopProductId: productId, version: dto.version },
        data: {
          branchId: dto.branchId === undefined ? undefined : dto.branchId,
          price: dto.price,
          currency: dto.currency,
          vatIncluded: dto.vatIncluded,
          stockStatus: dto.stockStatus,
          quantity: dto.quantity === undefined ? undefined : dto.quantity,
          ...dates,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw versionConflict();
      await tx.auditLog.create({ data: { actorId, action: 'OFFER_UPDATED', targetType: 'Shop', targetId: shopId, before: { offerId, price: current.price.toString(), currency: current.currency, stockStatus: current.stockStatus }, after: { price: dto.price, currency: dto.currency ?? current.currency, stockStatus: dto.stockStatus ?? current.stockStatus } } });
      return tx.productOffer.findUniqueOrThrow({ where: { id: offerId } });
    });
  }

  async deleteOffer(shopId: string, actorId: string, productId: string, offerId: string) {
    await this.productOrThrow(shopId, productId);
    const result = await this.db.productOffer.deleteMany({ where: { id: offerId, shopProductId: productId } });
    if (result.count === 0) throw new NotFoundException(ERRORS.OFFER_NOT_FOUND);
    await this.db.auditLog.create({ data: { actorId, action: 'OFFER_DELETED', targetType: 'Shop', targetId: shopId, after: { offerId, productId } } });
    return { id: offerId, deleted: true };
  }

  /** Ommaviy amallar (U11.6) — bitta tranzaksiya. */
  async bulk(shopId: string, actorId: string, dto: BulkProductsDto) {
    const products = await this.db.shopProduct.findMany({ where: { id: { in: dto.ids }, shopId }, select: { id: true } });
    const ids = products.map((product) => product.id);
    if (ids.length === 0) throw new NotFoundException(ERRORS.SHOP_PRODUCT_NOT_FOUND);
    return this.db.$transaction(async (tx) => {
      let affected = 0;
      switch (dto.action) {
        case 'PRICE_PERCENT': {
          if (dto.percent === undefined || dto.percent === 0) throw invalid('Foizni kiriting');
          const factor = new Prisma.Decimal(100).plus(dto.percent).div(100);
          affected = await tx.$executeRaw`
            UPDATE product_offers SET price = round(price * ${factor}::numeric, 2), version = version + 1, "updatedAt" = now()
            WHERE shop_product_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})`;
          break;
        }
        case 'STOCK': {
          if (!dto.stockStatus) throw invalid('Zaxira holatini tanlang');
          affected = (await tx.productOffer.updateMany({ where: { shopProductId: { in: ids } }, data: { stockStatus: dto.stockStatus, version: { increment: 1 } } })).count;
          break;
        }
        case 'ARCHIVE':
          affected = (await tx.shopProduct.updateMany({ where: { id: { in: ids } }, data: { status: 'ARCHIVED', version: { increment: 1 } } })).count;
          break;
        case 'ACTIVATE':
          affected = (await tx.shopProduct.updateMany({ where: { id: { in: ids }, productModel: { status: 'APPROVED' } }, data: { status: 'ACTIVE', version: { increment: 1 } } })).count;
          break;
      }
      await tx.auditLog.create({ data: { actorId, action: `SHOP_PRODUCTS_BULK_${dto.action}`, targetType: 'Shop', targetId: shopId, after: { ids, percent: dto.percent ?? null, stockStatus: dto.stockStatus ?? null, affected } } });
      return { action: dto.action, products: ids.length, affected };
    });
  }
}
