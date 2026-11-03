import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductModel } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import { slugify } from '../../common/utils/slug';
import { tashkentDate } from '../../common/utils/tashkent-date';
import { ExchangeRateService } from './exchange-rate.service';
import { AdminModelQueryDto, AdminUpdateModelDto, CategoryDto, ModelQueryDto, OfferQueryDto, ProductSpecsDto, ProposeModelDto } from './dto/catalog.dto';

const conflict = (code: string, message: string) => new DomainException(HttpStatus.CONFLICT, code, message);

/** TZ 7.4 typed xususiyatlar ro‘yxati (forma, solishtirish va import uchun yagona manba). */
export const SPEC_KEYS = [
  'nominalPowerW', 'efficiencyPct', 'widthMm', 'heightMm', 'weightKg', 'tempCoeffPmaxPctPerC', 'vocV', 'vmpV', 'iscA', 'impA', 'degradationPctPerYear',
  'inverterAcKw', 'inverterMaxDcV', 'mpptMinV', 'mpptMaxV', 'mpptMaxCurrentA', 'batteryVoltageV', 'batteryCapacityKwh', 'batteryUsableDod', 'batteryChemistry', 'batteryCycles', 'warrantyMonths',
] as const;

/** Solishtirishda «eng yaxshi» qiymat yo‘nalishi (U7.5). */
const BEST: Partial<Record<(typeof SPEC_KEYS)[number], 'max' | 'min'>> = {
  nominalPowerW: 'max', efficiencyPct: 'max', tempCoeffPmaxPctPerC: 'max', degradationPctPerYear: 'min', weightKg: 'min',
  inverterAcKw: 'max', batteryCapacityKwh: 'max', batteryUsableDod: 'max', batteryCycles: 'max', warrantyMonths: 'max',
};

const MODEL_CARD = {
  id: true, slug: true, brand: true, model: true, status: true, categoryId: true, nominalPowerW: true, efficiencyPct: true, inverterAcKw: true, batteryCapacityKwh: true, batteryChemistry: true, warrantyMonths: true,
  category: { select: { id: true, slug: true, nameI18n: true } },
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1, select: { fileId: true, altText: true } },
} satisfies Prisma.ProductModelSelect;

/** Faol taklif sharti: do‘kon ochiq, mahsulot ACTIVE, sana oralig‘ida (Toshkent sanasi). */
const ACTIVE_OFFER_SQL = Prisma.sql`
  sp.status = 'ACTIVE' AND s.status = 'ACTIVE' AND s.verification_status = 'VERIFIED' AND s.archived_at IS NULL
  AND o.valid_from <= (now() AT TIME ZONE 'Asia/Tashkent')::date
  AND (o.valid_until IS NULL OR o.valid_until >= (now() AT TIME ZONE 'Asia/Tashkent')::date)
  AND o.stock_status <> 'OUT_OF_STOCK'`;

export function specData(dto: ProductSpecsDto): Prisma.ProductModelUncheckedUpdateInput {
  const data: Record<string, unknown> = {};
  for (const key of SPEC_KEYS) if (dto[key] !== undefined) data[key] = dto[key];
  if (dto.specsJson !== undefined) data.specsJson = dto.specsJson as Prisma.InputJsonValue;
  if (dto.datasheetFileId !== undefined) data.datasheetFileId = dto.datasheetFileId;
  return data as Prisma.ProductModelUncheckedUpdateInput;
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly rates: ExchangeRateService,
  ) {}

  // ───────────── Kategoriyalar ─────────────

  async categories(parentId?: string, includeInactive = false) {
    const rows = await this.db.category.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      include: { _count: { select: { models: { where: { status: 'APPROVED' } } } } },
    });
    type Node = (typeof rows)[number] & { modelCount: number; children: Node[] };
    const nodes = new Map<string, Node>(rows.map((row) => [row.id, { ...row, modelCount: row._count.models, children: [] }]));
    const roots: Node[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else if (!node.parentId) roots.push(node);
    }
    const strip = ({ _count, ...node }: Node): Omit<Node, '_count'> => ({ ...node, children: node.children.map(strip) as Node[] });
    if (parentId) {
      const parent = nodes.get(parentId);
      if (!parent) throw new NotFoundException(ERRORS.CATEGORY_NOT_FOUND);
      return parent.children.map(strip);
    }
    return roots.map(strip);
  }

  private async assertParent(parentId: string | null | undefined, selfId?: string) {
    if (!parentId) return;
    if (parentId === selfId) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', ERRORS.CATEGORY_NOT_FOUND);
    // Halqa bo‘lmasin: ota-onalar zanjirida o‘zi uchramasligi kerak.
    let cursor: string | null = parentId;
    for (let depth = 0; cursor && depth < 10; depth += 1) {
      const row: { id: string; parentId: string | null } | null = await this.db.category.findUnique({ where: { id: cursor }, select: { id: true, parentId: true } });
      if (!row) throw new NotFoundException(ERRORS.CATEGORY_NOT_FOUND);
      if (selfId && row.parentId === selfId) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', ERRORS.CATEGORY_NOT_FOUND);
      cursor = row.parentId;
    }
  }

  async createCategory(adminId: string, dto: CategoryDto) {
    await this.assertParent(dto.parentId);
    if (await this.db.category.findUnique({ where: { slug: dto.slug }, select: { id: true } })) throw conflict('CONFLICT', 'Bu slug band');
    const category = await this.db.category.create({
      data: {
        parentId: dto.parentId ?? null,
        slug: dto.slug,
        nameI18n: { ...dto.nameI18n } as Prisma.InputJsonValue,
        descriptionI18n: dto.descriptionI18n as Prisma.InputJsonValue | undefined,
        attributeSchemaJson: dto.attributeSchemaJson as Prisma.InputJsonValue | undefined,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.db.auditLog.create({ data: { actorId: adminId, action: 'CATEGORY_CREATED', targetType: 'Category', targetId: category.id, after: { slug: category.slug } } });
    return category;
  }

  async updateCategory(adminId: string, id: string, dto: CategoryDto) {
    const current = await this.db.category.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(ERRORS.CATEGORY_NOT_FOUND);
    await this.assertParent(dto.parentId, id);
    const taken = await this.db.category.findFirst({ where: { slug: dto.slug, id: { not: id } }, select: { id: true } });
    if (taken) throw conflict('CONFLICT', 'Bu slug band');
    const category = await this.db.category.update({
      where: { id },
      data: {
        parentId: dto.parentId ?? null,
        slug: dto.slug,
        nameI18n: { ...dto.nameI18n } as Prisma.InputJsonValue,
        descriptionI18n: (dto.descriptionI18n ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        attributeSchemaJson: (dto.attributeSchemaJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        active: dto.active ?? current.active,
        sortOrder: dto.sortOrder ?? current.sortOrder,
      },
    });
    await this.db.auditLog.create({ data: { actorId: adminId, action: 'CATEGORY_UPDATED', targetType: 'Category', targetId: id, before: { slug: current.slug, active: current.active }, after: { slug: category.slug, active: category.active } } });
    return category;
  }

  async deleteCategory(adminId: string, id: string) {
    const category = await this.db.category.findUnique({ where: { id }, include: { _count: { select: { children: true, models: true } } } });
    if (!category) throw new NotFoundException(ERRORS.CATEGORY_NOT_FOUND);
    if (category._count.children > 0 || category._count.models > 0) throw conflict('CATEGORY_HAS_CHILDREN', ERRORS.CATEGORY_HAS_CHILDREN);
    await this.db.category.delete({ where: { id } });
    await this.db.auditLog.create({ data: { actorId: adminId, action: 'CATEGORY_DELETED', targetType: 'Category', targetId: id, before: { slug: category.slug } } });
    return { id, deleted: true };
  }

  // ───────────── Ochiq katalog ─────────────

  /** GET /product-models — APPROVED modellar, eng past narx (so‘mda) va takliflar soni bilan (TZ 9.5). */
  async listModels(query: ModelQueryDto) {
    const limit = query.limit ?? 24;
    const page = query.page ?? 1;
    let categoryIds: string[] | null = null;
    if (query.categoryId || query.categorySlug) {
      const root = await this.db.category.findFirst({ where: query.categoryId ? { id: query.categoryId } : { slug: query.categorySlug }, select: { id: true } });
      if (!root) return { items: [], total: 0, page, limit, pages: 1, rate: await this.rates.latest('USD') };
      categoryIds = await this.descendantIds(root.id);
    }
    const q = query.q?.trim().toLowerCase();
    const filters: Prisma.Sql[] = [Prisma.sql`pm.status = 'APPROVED'`];
    if (categoryIds) filters.push(Prisma.sql`pm.category_id IN (${Prisma.join(categoryIds.map((id) => Prisma.sql`${id}::uuid`))})`);
    if (query.brand) filters.push(Prisma.sql`lower(pm.brand) = ${query.brand.trim().toLowerCase()}`);
    if (query.minPowerW !== undefined) filters.push(Prisma.sql`pm.nominal_power_w >= ${query.minPowerW}`);
    if (query.maxPowerW !== undefined) filters.push(Prisma.sql`pm.nominal_power_w <= ${query.maxPowerW}`);
    if (query.minPrice !== undefined) filters.push(Prisma.sql`st.min_price_uzs >= ${query.minPrice}`);
    if (query.maxPrice !== undefined) filters.push(Prisma.sql`st.min_price_uzs <= ${query.maxPrice}`);
    if (query.stock === 'IN_STOCK') filters.push(Prisma.sql`st.in_stock IS TRUE`);
    if (q) filters.push(Prisma.sql`(lower(pm.brand || ' ' || pm.model) LIKE ${`%${q}%`} OR similarity(lower(pm.brand || ' ' || pm.model), ${q}) > 0.3)`);
    const order = {
      price: Prisma.sql`st.min_price_uzs ASC NULLS LAST`,
      '-price': Prisma.sql`st.min_price_uzs DESC NULLS LAST`,
      power: Prisma.sql`pm.nominal_power_w ASC NULLS LAST`,
      '-power': Prisma.sql`pm.nominal_power_w DESC NULLS LAST`,
      new: Prisma.sql`pm.created_at DESC`,
      offers: Prisma.sql`st.offer_count DESC NULLS LAST`,
    }[query.sort ?? 'offers'] ?? Prisma.sql`st.offer_count DESC NULLS LAST`;

    const rows = await this.db.$queryRaw<Array<{ id: string; total: bigint; min_price_uzs: Prisma.Decimal | null; offer_count: bigint | null; in_stock: boolean | null }>>`
      WITH rate AS (SELECT rate_to_uzs FROM exchange_rates WHERE currency = 'USD' ORDER BY rate_date DESC LIMIT 1),
      st AS (
        SELECT sp.product_model_id AS model_id,
               MIN(CASE WHEN o.currency = 'USD' THEN o.price * (SELECT rate_to_uzs FROM rate) ELSE o.price END) AS min_price_uzs,
               COUNT(*) AS offer_count,
               BOOL_OR(o.stock_status = 'IN_STOCK') AS in_stock
        FROM product_offers o
        JOIN shop_products sp ON sp.id = o.shop_product_id
        JOIN shops s ON s.id = sp.shop_id
        WHERE ${ACTIVE_OFFER_SQL}
        GROUP BY sp.product_model_id
      )
      SELECT pm.id, COUNT(*) OVER () AS total, st.min_price_uzs, st.offer_count, st.in_stock
      FROM product_models pm
      LEFT JOIN st ON st.model_id = pm.id
      WHERE ${Prisma.join(filters, ' AND ')}
      ORDER BY ${order}, pm.id
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`;

    const models = await this.db.productModel.findMany({ where: { id: { in: rows.map((row) => row.id) } }, select: MODEL_CARD });
    const byId = new Map(models.map((model) => [model.id, model]));
    const total = Number(rows[0]?.total ?? 0);
    return {
      items: rows.map((row) => ({
        ...byId.get(row.id)!,
        minPriceUzs: row.min_price_uzs ? new Prisma.Decimal(row.min_price_uzs).toDecimalPlaces(2).toFixed(2) : null,
        offerCount: Number(row.offer_count ?? 0),
        inStock: !!row.in_stock,
      })),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      rate: await this.rates.latest('USD'),
    };
  }

  private async descendantIds(rootId: string) {
    const all = await this.db.category.findMany({ where: { active: true }, select: { id: true, parentId: true } });
    const ids = new Set([rootId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const row of all) if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) { ids.add(row.id); grew = true; }
    }
    return [...ids];
  }

  /** Brendlar ro‘yxati (filtr uchun). */
  async brands(categoryId?: string) {
    const rows = await this.db.productModel.groupBy({ by: ['brand'], where: { status: 'APPROVED', ...(categoryId ? { categoryId: { in: await this.descendantIds(categoryId) } } : {}) }, _count: true, orderBy: { brand: 'asc' } });
    return rows.map((row) => ({ brand: row.brand, count: row._count }));
  }

  async modelBySlug(slug: string) {
    const model = await this.db.productModel.findUnique({
      where: { slug },
      include: { category: { select: { id: true, slug: true, nameI18n: true, attributeSchemaJson: true, parentId: true } }, images: { orderBy: { sortOrder: 'asc' } }, mergedInto: { select: { slug: true } } },
    });
    if (!model || (model.status !== 'APPROVED' && model.status !== 'MERGED')) throw new NotFoundException(ERRORS.PRODUCT_MODEL_NOT_FOUND);
    // Birlashtirilgan model: eski havola yangi modelga yo‘naltiriladi.
    if (model.status === 'MERGED') return { redirectSlug: model.mergedInto?.slug ?? null };
    const { mergedInto: _m, proposedByShopId: _p, rejectReason: _r, ...rest } = model;
    return rest;
  }

  /** GET /product-models/:slug/offers — faol takliflar (narx, do‘kon, filial). Masofa — M3 (PostGIS). */
  async offers(slug: string, query: OfferQueryDto) {
    const model = await this.db.productModel.findFirst({ where: { slug, status: 'APPROVED' }, select: { id: true } });
    if (!model) throw new NotFoundException(ERRORS.PRODUCT_MODEL_NOT_FOUND);
    const today = new Date(tashkentDate());
    const offers = await this.db.productOffer.findMany({
      where: {
        stockStatus: { not: 'OUT_OF_STOCK' },
        validFrom: { lte: today },
        OR: [{ validUntil: null }, { validUntil: { gte: today } }],
        shopProduct: { productModelId: model.id, status: 'ACTIVE', shop: { status: 'ACTIVE', verificationStatus: 'VERIFIED', archivedAt: null } },
        ...(query.region ? { branch: { regionCode: query.region } } : {}),
      },
      take: 500,
      select: {
        id: true, price: true, currency: true, vatIncluded: true, stockStatus: true, quantity: true, validUntil: true, updatedAt: true,
        branch: { select: { id: true, name: true, address: true, regionCode: true } },
        shopProduct: { select: { id: true, description: true, shop: { select: { id: true, slug: true, name: true, logoAssetId: true, ratingAvg: true, ratingCount: true } } } },
      },
    });
    const rate = await this.rates.latest('USD');
    const items = offers.map(({ shopProduct, ...offer }) => ({ ...offer, priceUzs: ExchangeRateService.toUzs(offer.price, offer.currency, rate), shop: shopProduct.shop, description: shopProduct.description }));
    items.sort((a, b) => (query.sort === 'updated' ? b.updatedAt.getTime() - a.updatedAt.getTime() : Number(a.priceUzs ?? Infinity) - Number(b.priceUzs ?? Infinity)));
    const page = query.page ?? 1;
    return { items: items.slice((page - 1) * 20, page * 20), total: items.length, page, rate };
  }

  /** GET /product-models/compare?ids= — bir xil atributlar jadvali, farqlar va eng yaxshi qiymat. */
  async compare(ids: string[]) {
    const models = await this.db.productModel.findMany({ where: { id: { in: ids }, status: 'APPROVED' }, include: { category: { select: { id: true, slug: true, nameI18n: true } }, images: { take: 1, orderBy: { sortOrder: 'asc' } } } });
    if (models.length !== new Set(ids).size) throw new NotFoundException(ERRORS.PRODUCT_MODEL_NOT_FOUND);
    const ordered = ids.map((id) => models.find((model) => model.id === id)!);
    const rows = SPEC_KEYS.map((key) => {
      const values = ordered.map((model) => {
        const value = model[key as keyof ProductModel] as unknown;
        return value === null || value === undefined ? null : String(value);
      });
      if (values.every((value) => value === null)) return null;
      const numeric = values.map((value) => (value === null ? null : Number(value)));
      const direction = BEST[key];
      const present = numeric.filter((value): value is number => value !== null && Number.isFinite(value));
      const bestValue = direction && present.length > 1 ? (direction === 'max' ? Math.max(...present) : Math.min(...present)) : null;
      return {
        key,
        values,
        differs: new Set(values).size > 1,
        best: bestValue === null ? [] : numeric.map((value, index) => (value === bestValue ? index : -1)).filter((index) => index >= 0),
      };
    }).filter(Boolean);
    // TZ 11.13 uskunalar mosligi — hisoblash dvigateli bilan M4 da qo‘shiladi.
    return { models: ordered.map(({ proposedByShopId: _p, rejectReason: _r, ...model }) => model), rows, compatibility: null };
  }

  // ───────────── Model taklifi va moderatsiya ─────────────

  async uniqueModelSlug(brand: string, model: string, tx: Prisma.TransactionClient = this.db) {
    const base = slugify(`${brand} ${model}`).slice(0, 180);
    for (let i = 1; i < 100; i += 1) {
      const candidate = i === 1 ? base : `${base}-${i}`;
      if (!(await tx.productModel.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private async assertNoDuplicate(brand: string, model: string, exceptId?: string) {
    const existing = await this.db.productModel.findFirst({
      where: { brand: { equals: brand.trim(), mode: 'insensitive' }, model: { equals: model.trim(), mode: 'insensitive' }, status: { not: 'MERGED' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true, slug: true, status: true },
    });
    if (existing) throw new DomainException(HttpStatus.CONFLICT, 'PRODUCT_MODEL_EXISTS', ERRORS.PRODUCT_MODEL_EXISTS);
  }

  async propose(shopId: string, actorId: string, dto: ProposeModelDto) {
    const category = await this.db.category.findFirst({ where: { id: dto.categoryId, active: true }, select: { id: true } });
    if (!category) throw new NotFoundException(ERRORS.CATEGORY_NOT_FOUND);
    await this.assertNoDuplicate(dto.brand, dto.model);
    return this.db.$transaction(async (tx) => {
      const created = await tx.productModel.create({
        data: {
          ...(specData(dto) as Prisma.ProductModelUncheckedCreateInput),
          categoryId: dto.categoryId,
          brand: dto.brand.trim(),
          model: dto.model.trim(),
          slug: await this.uniqueModelSlug(dto.brand, dto.model, tx),
          status: 'PENDING',
          proposedByShopId: shopId,
        },
      });
      await tx.auditLog.create({ data: { actorId, action: 'PRODUCT_MODEL_PROPOSED', targetType: 'ProductModel', targetId: created.id, after: { shopId, brand: created.brand, model: created.model } } });
      return created;
    });
  }

  /** Model qidiruvi (do‘kon «Mahsulot qo‘shish» avto-taklifi): APPROVED + shu do‘kon taklif qilgan PENDING. */
  async searchForShop(shopId: string, q: string) {
    const term = q.trim();
    if (term.length < 2) return [];
    return this.db.productModel.findMany({
      where: {
        OR: [{ status: 'APPROVED' }, { status: 'PENDING', proposedByShopId: shopId }],
        AND: term.split(/\s+/).slice(0, 4).map((part) => ({ OR: [{ brand: { contains: part, mode: 'insensitive' as const } }, { model: { contains: part, mode: 'insensitive' as const } }] })),
      },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
      take: 15,
      select: MODEL_CARD,
    });
  }

  async adminModels(query: AdminModelQueryDto) {
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const q = query.q?.trim();
    const where: Prisma.ProductModelWhereInput = {
      status: query.status,
      categoryId: query.categoryId,
      ...(q ? { OR: [{ brand: { contains: q, mode: 'insensitive' } }, { model: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const [items, total, counts] = await Promise.all([
      this.db.productModel.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { category: { select: { id: true, slug: true, nameI18n: true } }, proposedByShop: { select: { id: true, name: true, slug: true } }, mergedInto: { select: { id: true, slug: true, brand: true, model: true } }, _count: { select: { shopProducts: true } } },
      }),
      this.db.productModel.count({ where }),
      this.db.productModel.groupBy({ by: ['status'], _count: true }),
    ]);
    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), counts: Object.fromEntries(counts.map((row) => [row.status, row._count])) };
  }

  /** Admin: xususiyatlarni tahrirlash, tasdiqlash yoki rad etish (sabab majburiy). */
  async adminUpdateModel(adminId: string, id: string, dto: AdminUpdateModelDto) {
    const current = await this.db.productModel.findUnique({ where: { id } });
    if (!current || current.status === 'MERGED') throw new NotFoundException(ERRORS.PRODUCT_MODEL_NOT_FOUND);
    if (dto.status === 'REJECTED' && !dto.rejectReason?.trim()) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', 'Rad etish sababini kiriting');
    if (dto.brand || dto.model) await this.assertNoDuplicate(dto.brand ?? current.brand, dto.model ?? current.model, id);
    if (dto.categoryId && !(await this.db.category.findUnique({ where: { id: dto.categoryId }, select: { id: true } }))) throw new NotFoundException(ERRORS.CATEGORY_NOT_FOUND);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.productModel.update({
        where: { id },
        data: {
          ...specData(dto),
          categoryId: dto.categoryId,
          brand: dto.brand?.trim(),
          model: dto.model?.trim(),
          status: dto.status,
          rejectReason: dto.status === 'REJECTED' ? dto.rejectReason!.trim() : dto.status === 'APPROVED' ? null : undefined,
        },
      });
      const action = dto.status && dto.status !== current.status ? `PRODUCT_MODEL_${dto.status}` : 'PRODUCT_MODEL_UPDATED';
      await tx.auditLog.create({ data: { actorId: adminId, action, reason: dto.rejectReason ?? null, targetType: 'ProductModel', targetId: id, before: { status: current.status, brand: current.brand, model: current.model }, after: { status: updated.status, brand: updated.brand, model: updated.model } } });
      if (dto.status && dto.status !== current.status && current.proposedByShopId) {
        const owner = await tx.shopMember.findFirst({ where: { shopId: current.proposedByShopId, memberRole: 'OWNER' }, select: { userId: true } });
        if (owner) {
          const approved = dto.status === 'APPROVED';
          await this.outbox.emit(tx, {
            eventName: approved ? 'product_model.approved' : 'product_model.rejected',
            aggregateType: 'ProductModel',
            aggregateId: id,
            payload: { userId: owner.userId, title: approved ? 'Model tasdiqlandi' : 'Model rad etildi', body: approved ? `${updated.brand} ${updated.model} katalogga qo‘shildi.` : `${updated.brand} ${updated.model}: ${dto.rejectReason}` },
            createdById: adminId,
          });
        }
      }
      return updated;
    });
  }

  /**
   * Dublikatni birlashtirish: manba MERGED bo‘ladi, do‘kon mahsulotlari asosiy modelga ko‘chiriladi.
   * Do‘konda ikkala model ham bo‘lsa — manba takliflari asosiy mahsulotga o‘tkaziladi, manba mahsulot o‘chiriladi.
   */
  async merge(adminId: string, sourceId: string, targetId: string) {
    if (sourceId === targetId) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', 'Modelni o‘ziga birlashtirib bo‘lmaydi');
    const [source, target] = await Promise.all([this.db.productModel.findUnique({ where: { id: sourceId } }), this.db.productModel.findUnique({ where: { id: targetId } })]);
    if (!source || source.status === 'MERGED' || !target || target.status !== 'APPROVED') throw new NotFoundException(ERRORS.PRODUCT_MODEL_NOT_FOUND);
    return this.db.$transaction(async (tx) => {
      const products = await tx.shopProduct.findMany({ where: { productModelId: sourceId }, select: { id: true, shopId: true } });
      let moved = 0;
      let combined = 0;
      for (const product of products) {
        const existing = await tx.shopProduct.findUnique({ where: { shopId_productModelId: { shopId: product.shopId, productModelId: targetId } }, select: { id: true } });
        if (existing) {
          await tx.productOffer.updateMany({ where: { shopProductId: product.id }, data: { shopProductId: existing.id } });
          await tx.shopProduct.delete({ where: { id: product.id } });
          combined += 1;
        } else {
          await tx.shopProduct.update({ where: { id: product.id }, data: { productModelId: targetId, version: { increment: 1 } } });
          moved += 1;
        }
      }
      await tx.productModel.update({ where: { id: sourceId }, data: { status: 'MERGED', mergedIntoId: targetId } });
      await tx.productModel.updateMany({ where: { mergedIntoId: sourceId }, data: { mergedIntoId: targetId } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'PRODUCT_MODEL_MERGED', targetType: 'ProductModel', targetId: sourceId, before: { status: source.status }, after: { mergedIntoId: targetId, moved, combined } } });
      return { sourceId, targetId, moved, combined };
    });
  }
}
