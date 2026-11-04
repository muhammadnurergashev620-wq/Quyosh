import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import { tashkentDate } from '../../common/utils/tashkent-date';
import { MediaService } from '../media/media.service';
import { ShopService } from '../shop/shop.service';
import { M6Notifier } from '../quote-request/m6-notifier.service';
import { activeCertWhere } from './cert-filter';
import type { AdminBadgeDto, ProjectDto } from './dto/shop-content.dto';

const DAY = 86_400_000;
const unprocessable = (code: keyof typeof ERRORS) => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, code, ERRORS[code] as string);
const dateOnly = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);

/** Portfolio va do‘kon belgilari (TZ 4.11, 7.3, U11.10, U12.11). */
@Injectable()
export class ShopContentService {
  constructor(
    private readonly db: PrismaService,
    private readonly media: MediaService,
    private readonly notify: M6Notifier,
  ) {}

  // ───────────── Portfolio ─────────────

  private async assertImages(shopId: string, ids: string[]) {
    if (!ids.length) return;
    const ok = await this.db.mediaAsset.count({ where: { id: { in: ids }, kind: 'PORTFOLIO', linkedResourceType: 'Shop', linkedResourceId: shopId, status: { notIn: ['REJECTED', 'FAILED'] } } });
    if (ok !== new Set(ids).size) throw unprocessable('PROJECT_IMAGE_INVALID');
  }

  private async assertInstallation(shopId: string, installationId: string | null | undefined) {
    if (!installationId) return;
    const inst = await this.db.installation.findFirst({ where: { id: installationId, shopId, status: 'CONFIRMED' }, select: { id: true } });
    if (!inst) throw new NotFoundException(ERRORS.INSTALLATION_NOT_FOUND);
  }

  private async withImageUrls<T extends { images: Array<{ fileId: string; sortOrder: number }> }>(rows: T[], apiBase: string) {
    const urls = await this.media.signMany(rows.flatMap((r) => r.images.map((i) => i.fileId)), apiBase);
    return rows.map((r) => ({ ...r, images: r.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ fileId: i.fileId, url: urls.get(i.fileId)?.medium ?? urls.get(i.fileId)?.original ?? null, thumb: urls.get(i.fileId)?.thumbnail ?? null })) }));
  }

  async projects(ctx: ShopContext, apiBase: string) {
    const rows = await this.db.shopProject.findMany({ where: { shopId: ctx.shopId }, orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }], include: { images: true } });
    const confirmed = await this.db.installation.findMany({
      where: { shopId: ctx.shopId, status: 'CONFIRMED' },
      select: { id: true, confirmedAt: true, quote: { select: { systemPowerKw: true, systemType: true, request: { select: { number: true, regionCode: true } } } } },
      orderBy: { confirmedAt: 'desc' },
      take: 100,
    });
    return { items: await this.withImageUrls(rows, apiBase), confirmedInstallations: confirmed };
  }

  private async writeImages(tx: Prisma.TransactionClient, projectId: string, ids: string[]) {
    await tx.shopProjectImage.deleteMany({ where: { projectId } });
    if (ids.length) await tx.shopProjectImage.createMany({ data: ids.map((fileId, sortOrder) => ({ projectId, fileId, sortOrder })) });
  }

  async createProject(ctx: ShopContext, dto: ProjectDto) {
    await this.assertImages(ctx.shopId, dto.imageIds ?? []);
    await this.assertInstallation(ctx.shopId, dto.installationId);
    return this.db.$transaction(async (tx) => {
      const project = await tx.shopProject.create({
        data: {
          shopId: ctx.shopId, title: dto.title.trim(), city: dto.city?.trim() || null, systemPowerKw: dto.systemPowerKw ?? null, systemType: dto.systemType ?? null,
          completedAt: dto.completedAt ? dateOnly(dto.completedAt) : null, installationId: dto.installationId ?? null, description: dto.description?.trim() || null, published: dto.published ?? true,
        },
      });
      await this.writeImages(tx, project.id, [...new Set(dto.imageIds ?? [])]);
      return project;
    });
  }

  async updateProject(ctx: ShopContext, id: string, dto: ProjectDto) {
    const project = await this.db.shopProject.findFirst({ where: { id, shopId: ctx.shopId } });
    if (!project) throw new NotFoundException(ERRORS.PROJECT_NOT_FOUND);
    await this.assertImages(ctx.shopId, dto.imageIds ?? []);
    await this.assertInstallation(ctx.shopId, dto.installationId);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.shopProject.update({
        where: { id },
        data: {
          title: dto.title.trim(), city: dto.city?.trim() || null, systemPowerKw: dto.systemPowerKw ?? null, systemType: dto.systemType ?? null,
          completedAt: dto.completedAt ? dateOnly(dto.completedAt) : null, installationId: dto.installationId ?? null, description: dto.description?.trim() || null, published: dto.published ?? project.published,
        },
      });
      if (dto.imageIds) await this.writeImages(tx, id, [...new Set(dto.imageIds)]);
      return updated;
    });
  }

  async deleteProject(ctx: ShopContext, id: string) {
    const res = await this.db.shopProject.deleteMany({ where: { id, shopId: ctx.shopId } });
    if (!res.count) throw new NotFoundException(ERRORS.PROJECT_NOT_FOUND);
    return { deleted: true };
  }

  async publicProjects(slug: string, apiBase: string) {
    const shop = await this.db.shop.findFirst({ where: { slug, ...ShopService.publicWhere() }, select: { id: true } });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    const rows = await this.db.shopProject.findMany({ where: { shopId: shop.id, published: true }, orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }], take: 60, include: { images: true } });
    return (await this.withImageUrls(rows, apiBase)).map((r) => ({
      id: r.id, title: r.title, city: r.city, systemPowerKw: r.systemPowerKw, systemType: r.systemType, completedAt: r.completedAt, description: r.description,
      verifiedInstallation: !!r.installationId, images: r.images,
    }));
  }

  // ───────────── Belgilar (v3.1: faqat admin qo‘yadi) ─────────────

  private validateBadge(certType: string, brand: string | undefined, validFrom: string, validUntil?: string) {
    if (certType === 'OFFICIAL_DEALER' && !brand?.trim()) throw unprocessable('CERTIFICATION_BRAND_REQUIRED');
    if (validUntil && dateOnly(validUntil) <= dateOnly(validFrom)) throw unprocessable('CERTIFICATION_DATES_INVALID');
  }

  /** Do‘kon belgisi (rasmiy diler, sertifikatli montajchi, litsenziya): admin qo‘yadi, darhol APPROVED; hujjat shart emas. */
  async addBadge(adminId: string, shopId: string, dto: AdminBadgeDto) {
    const shop = await this.db.shop.findFirst({ where: { id: shopId, archivedAt: null }, select: { id: true } });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    const validFrom = dto.validFrom ?? tashkentDate();
    this.validateBadge(dto.certType, dto.brand, validFrom, dto.validUntil);
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      const row = await tx.shopCertification.create({
        data: {
          shopId: shop.id, certType: dto.certType, brand: dto.brand?.trim() || null, issuer: dto.issuer?.trim() || 'Quyosh.uz',
          certNumber: dto.certNumber?.trim() || null, validFrom: dateOnly(validFrom), validUntil: dto.validUntil ? dateOnly(dto.validUntil) : null,
          status: 'APPROVED', reviewerId: adminId, reviewedAt: now,
        },
      });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SHOP_BADGE_SET', targetType: 'Shop', targetId: shop.id, after: { badgeId: row.id, certType: row.certType, brand: row.brand, validUntil: row.validUntil } } });
      return row;
    });
  }

  async removeBadge(adminId: string, shopId: string, badgeId: string) {
    const row = await this.db.shopCertification.findFirst({ where: { id: badgeId, shopId } });
    if (!row) throw new NotFoundException(ERRORS.SHOP_BADGE_NOT_FOUND);
    await this.db.$transaction(async (tx) => {
      await tx.shopCertification.delete({ where: { id: badgeId } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SHOP_BADGE_REMOVED', targetType: 'Shop', targetId: shopId, before: { badgeId, certType: row.certType, brand: row.brand } } });
    });
    return { deleted: true };
  }

  async publicCertifications(shopIds: string[]) {
    if (!shopIds.length) return new Map<string, Array<{ certType: string; brand: string | null; validUntil: Date | null }>>();
    const rows = await this.db.shopCertification.findMany({ where: { shopId: { in: shopIds }, ...activeCertWhere() }, select: { shopId: true, certType: true, brand: true, validUntil: true, issuer: true } });
    const map = new Map<string, Array<{ certType: string; brand: string | null; validUntil: Date | null; issuer: string }>>();
    for (const r of rows) map.set(r.shopId, [...(map.get(r.shopId) ?? []), r]);
    return map;
  }

  /** Job certification-expiry (14.1, kunlik): 30 kun qolganda eslatma; o‘tganda EXPIRED (belgi yashiriladi). */
  async certificationExpiry(now = new Date()) {
    const today = dateOnly(tashkentDate(now));
    const expired = await this.db.shopCertification.findMany({ where: { status: 'APPROVED', validUntil: { lt: today } }, select: { id: true, shopId: true } });
    for (const c of expired) {
      await this.db.$transaction(async (tx) => {
        const res = await tx.shopCertification.updateMany({ where: { id: c.id, status: 'APPROVED' }, data: { status: 'EXPIRED' } });
        if (!res.count) return;
        await this.notify.toShop(tx, c.shopId, { type: 'CERTIFICATION_EXPIRING', title: 'Belgi muddati o‘tdi', body: 'Belgi profildan yashirildi. Yangilash uchun administratorga murojaat qiling.', entityType: 'ShopCertification', entityId: c.id }, { permission: 'shop.profile' });
      });
    }
    const soon = await this.db.shopCertification.findMany({ where: { status: 'APPROVED', expiringNotifiedAt: null, validUntil: { gte: today, lte: new Date(today.getTime() + 30 * DAY) } }, select: { id: true, shopId: true, validUntil: true } });
    for (const c of soon) {
      await this.db.$transaction(async (tx) => {
        const res = await tx.shopCertification.updateMany({ where: { id: c.id, expiringNotifiedAt: null }, data: { expiringNotifiedAt: now } });
        if (!res.count) return;
        await this.notify.toShop(tx, c.shopId, { type: 'CERTIFICATION_EXPIRING', title: 'Belgi muddati tugayapti', body: `Muddati: ${c.validUntil!.toISOString().slice(0, 10)}. Yangilash uchun administratorga murojaat qiling, aks holda belgi yashiriladi.`, entityType: 'ShopCertification', entityId: c.id }, { permission: 'shop.profile' });
      });
    }
    return { expired: expired.length, warned: soon.length };
  }
}
