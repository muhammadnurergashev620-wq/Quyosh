import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { ShopService } from './shop.service';
import { maskPhone } from '../../common/utils/phone';
import { tashkentDate } from '../../common/utils/tashkent-date';
import { PublicShopQueryDto } from './dto/shop.dto';
import { activeCertWhere } from '../shop-content/cert-filter';

const PUBLIC_SELECT = {
  id: true, slug: true, name: true, description: true, logoAssetId: true, coverAssetId: true, ratingAvg: true, ratingCount: true, avgResponseMinutes: true, createdAt: true, verificationStatus: true,
} as const;

/** Mijoz uchun ochiq do‘konlar (TZ 3.5: faqat ACTIVE + VERIFIED + egasi bor). */
@Injectable()
export class PublicShopsService {
  constructor(private readonly db: PrismaService) {}

  async list(query: PublicShopQueryDto) {
    const limit = Math.min(query.limit ?? 20, 50);
    const offset = query.cursor && /^\d+$/.test(query.cursor) ? Number(query.cursor) : 0;
    const search = query.search?.trim();
    const where: Prisma.ShopWhereInput = {
      ...ShopService.publicWhere(),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
      ...(query.service ? { services: { some: { serviceType: query.service, active: true } } } : {}),
      ...(query.region ? { branches: { some: { regionCode: query.region, archivedAt: null } } } : {}),
      ...(query.cert ? { certifications: { some: { certType: query.cert, ...activeCertWhere() } } } : {}),
    };
    const orderBy: Prisma.ShopOrderByWithRelationInput[] =
      query.sort === 'new' ? [{ createdAt: 'desc' }] : query.sort === 'name' ? [{ name: 'asc' }] : [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }];
    const rows = await this.db.shop.findMany({
      where,
      orderBy: [...orderBy, { id: 'asc' }],
      skip: offset,
      take: limit + 1,
      select: {
        ...PUBLIC_SELECT,
        services: { where: { active: true }, select: { serviceType: true }, distinct: ['serviceType'] },
        branches: { where: { archivedAt: null }, select: { regionCode: true, address: true }, take: 3 },
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
        certifications: { where: activeCertWhere(), select: { certType: true, brand: true } },
      },
    });
    const items = rows.slice(0, limit).map(({ services, _count, ...shop }) => ({ ...shop, serviceTypes: services.map((item) => item.serviceType), productCount: _count.products }));
    return { items, nextCursor: rows.length > limit ? String(offset + limit) : null };
  }

  async bySlug(slug: string) {
    const shop = await this.db.shop.findFirst({
      where: { ...ShopService.publicWhere(), slug },
      select: {
        ...PUBLIC_SELECT,
        phone: true,
        email: true,
        branches: { where: { archivedAt: null, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, address: true, regionCode: true, phone: true, openingHoursJson: true, holidayExceptionsJson: true, status: true } },
        services: { where: { active: true }, select: { id: true, serviceType: true, pricingModel: true, price: true, currency: true, descriptionI18n: true, warrantyMonths: true, branchId: true } },
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
        certifications: { where: activeCertWhere(), select: { certType: true, brand: true, issuer: true, validUntil: true } },
      },
    });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    const { _count, phone, email: _email, ...rest } = shop;
    // U7.4: guest uchun telefon yashirilgan; to‘liq raqam — kirgandan keyin /contact orqali.
    return { ...rest, phoneMasked: phone ? maskPhone(phone) : null, productCount: _count.products };
  }

  async contact(slug: string) {
    const shop = await this.db.shop.findFirst({ where: { ...ShopService.publicWhere(), slug }, select: { phone: true, email: true } });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    return shop;
  }

  /** Profil «Mahsulotlar» tabi: do‘konning faol mahsulotlari va eng past faol narxi. */
  async products(slug: string, page = 1) {
    const shop = await this.db.shop.findFirst({ where: { ...ShopService.publicWhere(), slug }, select: { id: true } });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    const today = new Date(tashkentDate());
    const where: Prisma.ShopProductWhereInput = { shopId: shop.id, status: 'ACTIVE', productModel: { status: 'APPROVED' } };
    const [rows, total] = await Promise.all([
      this.db.shopProduct.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * 24,
        take: 24,
        select: {
          id: true,
          description: true,
          productModel: { select: { id: true, slug: true, brand: true, model: true, nominalPowerW: true, efficiencyPct: true, inverterAcKw: true, batteryCapacityKwh: true, batteryChemistry: true, batteryCycles: true, warrantyMonths: true, category: { select: { id: true, slug: true, nameI18n: true } } } },
          offers: {
            where: { stockStatus: { not: 'OUT_OF_STOCK' }, validFrom: { lte: today }, OR: [{ validUntil: null }, { validUntil: { gte: today } }] },
            orderBy: { price: 'asc' },
            select: { id: true, price: true, currency: true, stockStatus: true, vatIncluded: true, branch: { select: { id: true, name: true } } },
          },
        },
      }),
      this.db.shopProduct.count({ where }),
    ]);
    return { items: rows, total, page, pages: Math.max(1, Math.ceil(total / 24)) };
  }
}
