import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type QuoteRequestShop, type ShopMemberRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import { tashkentDate, tashkentDateTime } from '../../common/utils/tashkent-date';
import type { ShopPermission } from '../../common/constants/shop-permissions';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import type { Panel } from '../../common/utils/panel';
import { ShopService } from '../shop/shop.service';
import { GeoRepository } from '../geo/geo.repository';
import { M6Notifier } from './m6-notifier.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { assertRequestShopTransition, assertRequestTransition, canRequestShopTransition, OPEN_REQUEST_SHOP_STATUSES } from './quote-request-state-machine';
import { CUSTOMER_VISIBLE_QUOTE } from '../quote/quote-state-machine';
import type { AddShopsDto, CreateQuoteRequestDto, DeclineDto, MessagesQueryDto, ProposeSiteVisitDto, SendMessageDto, ShopRequestsQueryDto, UpdateLeadDto, UpdateSiteVisitDto } from './dto/quote-request.dto';
import { numAt, strAt } from '../../common/utils/json-path';

type Tx = Prisma.TransactionClient;
export type Side = 'CUSTOMER' | 'SHOP';

export const REQUEST_LIMITS = { maxShops: 5, maxOpen: 3, maxPerDay: 5 } as const;

/** Chat qatnashchisi: so‘rov egasi (CUSTOMER) yoki qabul qiluvchi do‘kon a’zosi (SHOP). */
export interface Participant {
  side: Side;
  userId: string;
  rs: QuoteRequestShop & { request: { id: string; userId: string; status: string; number: number; title: string } };
  member: { id: string; memberRole: ShopMemberRole; permissions: string[] } | null;
}

const SHOP_CARD = { id: true, slug: true, name: true, logoAssetId: true, ratingAvg: true, ratingCount: true, avgResponseMinutes: true, verificationStatus: true } as const;

/** Tashkent kalendar kunining boshlanishi (UTC). */
function tashkentDayStart(at = new Date()): Date {
  return new Date(`${tashkentDate(at)}T00:00:00+05:00`);
}

/** Hisobdan do‘konga ko‘rinadigan xavfsiz xulosa (13.2: iste’mol, maydon, tizim parametrlari). */
export function calcBrief(output: Prisma.JsonValue | null | undefined, input: Prisma.JsonValue | null | undefined) {
  if (!output || typeof output !== 'object') return null;
  return {
    systemType: strAt(output, 'systemType'),
    systemPowerKw: numAt(output, 'systemPowerKw'),
    panelCount: numAt(output, 'panelCountEstimate'),
    inverterKw: numAt(output, 'inverterKw'),
    batteryKwh: numAt(output, 'batteryKwh'),
    annualLoadKwh: numAt(output, 'load.annual'),
    annualGenerationKwh: numAt(output, 'generation.annual'),
    // Natijada `usableAreaM2` (yuqori daraja); qo‘lda kiritilgan maydon — kiritmada `areaM2`.
    usableAreaM2: numAt(output, 'usableAreaM2') ?? numAt(input, 'areaM2'),
    // Kiritmada oylik to‘lov `consumption.billAmount` (so‘m).
    monthlyBill: numAt(input, 'consumption.billAmount'),
    initialCost: numAt(output, 'money.initialCost'),
    simplePaybackYears: numAt(output, 'money.simplePaybackYears'),
  };
}

/**
 * Taklif so‘rovlari, yozishma va o‘lchov uchrashuvlari (TZ 9.10, 13.1, 13.2).
 * Holat o‘tishlari faqat state machine orqali; kontakt siyosati do‘kon ko‘rinishida qo‘llanadi.
 */
@Injectable()
export class QuoteRequestService {
  constructor(
    private readonly db: PrismaService,
    private readonly geo: GeoRepository,
    private readonly notify: M6Notifier,
    private readonly analytics: AnalyticsService,
  ) {}

  // ───────────── Mijoz ─────────────

  async limits(userId: string) {
    const dayStart = tashkentDayStart();
    const [open, today] = await Promise.all([
      this.db.quoteRequest.count({ where: { userId, status: 'OPEN' } }),
      this.db.quoteRequest.count({ where: { userId, createdAt: { gte: dayStart } } }),
    ]);
    return {
      open,
      maxOpen: REQUEST_LIMITS.maxOpen,
      today,
      maxPerDay: REQUEST_LIMITS.maxPerDay,
      maxShops: REQUEST_LIMITS.maxShops,
      canCreate: open < REQUEST_LIMITS.maxOpen && today < REQUEST_LIMITS.maxPerDay,
      nextAvailableAt: today >= REQUEST_LIMITS.maxPerDay ? new Date(dayStart.getTime() + 86_400_000) : null,
    };
  }

  private async assertShopsAcceptRequests(tx: Tx, shopIds: string[]) {
    const ok = await tx.shop.count({ where: { id: { in: shopIds }, ...ShopService.publicWhere() } });
    if (ok !== shopIds.length) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'QUOTE_REQUEST_SHOP_UNAVAILABLE', ERRORS.QUOTE_REQUEST_SHOP_UNAVAILABLE);
  }

  async create(userId: string, dto: CreateQuoteRequestDto, source: 'PLATFORM' | 'WIDGET' = 'PLATFORM') {
    const shopIds = [...new Set(dto.shopIds)];
    if (shopIds.length < 1 || shopIds.length > REQUEST_LIMITS.maxShops) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'QUOTE_REQUEST_SHOPS_RANGE', ERRORS.QUOTE_REQUEST_SHOPS_RANGE);
    if (!dto.calculationId && !dto.siteId) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'QUOTE_REQUEST_BASIS_REQUIRED', ERRORS.QUOTE_REQUEST_BASIS_REQUIRED);

    const calc = dto.calculationId
      ? await this.db.calculation.findFirst({ where: { id: dto.calculationId, userId, archivedAt: null }, select: { id: true, siteId: true, title: true, systemType: true, outputSummaryJson: true } })
      : null;
    if (dto.calculationId && !calc) throw new NotFoundException(ERRORS.CALCULATION_NOT_FOUND);
    const siteId = dto.siteId ?? calc?.siteId ?? null;
    const site = siteId ? await this.db.customerSite.findFirst({ where: { id: siteId, userId, archivedAt: null }, select: { id: true, title: true, regionCode: true, districtCode: true } }) : null;
    if (siteId && !site) throw new NotFoundException(ERRORS.SITE_NOT_FOUND);
    const calcPower = numAt(calc?.outputSummaryJson, 'systemPowerKw');
    const capacity = dto.requiredCapacityKw ?? (calcPower !== null ? Math.round(calcPower * 100) / 100 : undefined);

    return this.db.$transaction(
      async (tx) => {
        // Limitlar tranzaksiya ichida, foydalanuvchi bo‘yicha qulf bilan (parallel so‘rovlar chegarani aylanib o‘tmasin).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'quote-request:' + userId}))`;
        const [open, today] = await Promise.all([
          tx.quoteRequest.count({ where: { userId, status: 'OPEN' } }),
          tx.quoteRequest.count({ where: { userId, createdAt: { gte: tashkentDayStart() } } }),
        ]);
        if (open >= REQUEST_LIMITS.maxOpen) throw new DomainException(HttpStatus.CONFLICT, 'QUOTE_REQUEST_OPEN_LIMIT', ERRORS.QUOTE_REQUEST_OPEN_LIMIT);
        if (today >= REQUEST_LIMITS.maxPerDay) throw new DomainException(HttpStatus.TOO_MANY_REQUESTS, 'QUOTE_REQUEST_DAILY_LIMIT', ERRORS.QUOTE_REQUEST_DAILY_LIMIT);
        await this.assertShopsAcceptRequests(tx, shopIds);

        const request = await tx.quoteRequest.create({
          data: {
            userId,
            siteId: site?.id ?? null,
            calculationId: calc?.id ?? null,
            title: dto.title?.trim() || calc?.title || site?.title || 'Quyosh tizimi',
            systemType: dto.systemType,
            requiredCapacityKw: capacity ?? null,
            batteryNeeded: dto.batteryNeeded ?? dto.systemType !== 'ON_GRID',
            installationNeeded: dto.installationNeeded ?? true,
            financingInterest: dto.financingInterest ?? false,
            notes: dto.notes?.trim() || null,
            // Obyektsiz hisob: hudud hisob natijasidan (meta.regionCode) — aniq nuqta emas, faqat viloyat.
            regionCode: site?.regionCode ?? strAt(calc?.outputSummaryJson, 'meta.regionCode'),
            districtCode: site?.districtCode ?? null,
            source,
            shops: { create: shopIds.map((shopId) => ({ shopId })) },
          },
          include: { shops: { select: { id: true, shopId: true } } },
        });
        for (const rs of request.shops) {
          await this.notify.toShop(tx, rs.shopId, {
            type: 'QUOTE_REQUEST_RECEIVED',
            title: 'Yangi taklif so‘rovi',
            body: `№${request.number}: ${capacity ? `${capacity} kVt, ` : ''}${dto.systemType}. Javob bering — mijozlar tez javobni qadrlaydi.`,
            entityType: 'RequestShop',
            entityId: rs.id,
          }, { actorId: userId });
        }
        for (const rs of request.shops) await this.analytics.track({ eventType: 'request_created', userId, shopId: rs.shopId, entityId: request.id, regionCode: request.regionCode, properties: { source } }, tx);
        return { id: request.id, number: request.number, shopCount: request.shops.length };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async listMine(userId: string) {
    const rows = await this.db.quoteRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, number: true, title: true, systemType: true, requiredCapacityKw: true, status: true, createdAt: true, closedAt: true,
        shops: { select: { id: true, status: true, shop: { select: { id: true, name: true, logoAssetId: true } } } },
        quotes: { where: { status: { in: CUSTOMER_VISIBLE_QUOTE } }, select: { id: true, total: true, status: true } },
      },
    });
    const unread = await this.unreadByRequestShop(rows.flatMap((row) => row.shops.map((shop) => shop.id)), 'CUSTOMER');
    return rows.map((row) => ({
      ...row,
      quoteCount: row.quotes.length,
      minTotal: row.quotes.length ? row.quotes.reduce((min, q) => (q.total.lt(min) ? q.total : min), row.quotes[0].total) : null,
      unread: row.shops.reduce((sum, shop) => sum + (unread.get(shop.id) ?? 0), 0),
      quotes: undefined,
    }));
  }

  private async ownRequest(userId: string, requestId: string) {
    const request = await this.db.quoteRequest.findFirst({ where: { id: requestId, userId } });
    if (!request) throw new NotFoundException(ERRORS.QUOTE_REQUEST_NOT_FOUND);
    return request;
  }

  async getForCustomer(userId: string, requestId: string) {
    const request = await this.ownRequest(userId, requestId);
    const shops = await this.db.quoteRequestShop.findMany({
      where: { requestId },
      orderBy: { sentAt: 'asc' },
      include: {
        shop: { select: SHOP_CARD },
        siteVisits: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    });
    const quotes = await this.db.quote.findMany({
      where: { requestId, status: { in: CUSTOMER_VISIBLE_QUOTE } },
      select: { id: true, shopId: true, status: true, total: true, currency: true, systemPowerKw: true, currentRevision: true, validUntil: true, durationDays: true, warrantyEquipmentMonths: true, warrantyInstallationMonths: true, sentAt: true, viewedAt: true, updatedAt: true, installation: { select: { id: true, status: true } } },
    });
    const unread = await this.unreadByRequestShop(shops.map((s) => s.id), 'CUSTOMER');
    const calc = request.calculationId ? await this.db.calculation.findUnique({ where: { id: request.calculationId }, select: { id: true, title: true, outputSummaryJson: true, inputSnapshotJson: true } }) : null;
    return {
      ...request,
      calculation: calc ? { id: calc.id, title: calc.title, brief: calcBrief(calc.outputSummaryJson, calc.inputSnapshotJson) } : null,
      limits: { maxShops: REQUEST_LIMITS.maxShops },
      shops: shops.map((rs) => ({
        id: rs.id,
        status: rs.status,
        contactRevealedAt: rs.contactRevealedAt,
        declineReason: rs.declineReason,
        sentAt: rs.sentAt,
        viewedAt: rs.viewedAt,
        shop: rs.shop,
        siteVisits: rs.siteVisits,
        unread: unread.get(rs.id) ?? 0,
        quote: quotes.find((q) => q.shopId === rs.shopId) ?? null,
      })),
    };
  }

  async addShops(userId: string, requestId: string, dto: AddShopsDto) {
    const request = await this.ownRequest(userId, requestId);
    if (request.status !== 'OPEN') throw new DomainException(HttpStatus.CONFLICT, 'QUOTE_REQUEST_NOT_OPEN', ERRORS.QUOTE_REQUEST_NOT_OPEN);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'quote-request:' + userId}))`;
      const existing = await tx.quoteRequestShop.findMany({ where: { requestId }, select: { shopId: true } });
      const fresh = [...new Set(dto.shopIds)].filter((id) => !existing.some((e) => e.shopId === id));
      if (existing.length + fresh.length > REQUEST_LIMITS.maxShops) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'QUOTE_REQUEST_SHOPS_RANGE', ERRORS.QUOTE_REQUEST_SHOPS_RANGE);
      if (fresh.length === 0) return { added: 0 };
      await this.assertShopsAcceptRequests(tx, fresh);
      for (const shopId of fresh) {
        const rs = await tx.quoteRequestShop.create({ data: { requestId, shopId } });
        await this.notify.toShop(tx, shopId, { type: 'QUOTE_REQUEST_RECEIVED', title: 'Yangi taklif so‘rovi', body: `№${request.number}: ${request.systemType}`, entityType: 'RequestShop', entityId: rs.id }, { actorId: userId });
      }
      await tx.quoteRequest.update({ where: { id: requestId }, data: { lastActivityAt: new Date() } });
      return { added: fresh.length };
    });
  }

  /** Kontaktni ochish (13.2) — tugma, o‘lchov tasdig‘i yoki taklif qabul qilinganda. */
  async revealContactTx(tx: Tx, requestShopId: string, actorId: string, reason: 'MANUAL' | 'SITE_VISIT' | 'ACCEPT') {
    const rs = await tx.quoteRequestShop.findUniqueOrThrow({ where: { id: requestShopId } });
    if (rs.contactRevealedAt) return rs.contactRevealedAt;
    const at = new Date();
    await tx.quoteRequestShop.update({ where: { id: requestShopId }, data: { contactRevealedAt: at } });
    const text = reason === 'MANUAL' ? 'Mijoz kontaktini ochdi' : reason === 'SITE_VISIT' ? 'O‘lchov tasdiqlandi — mijoz kontakti ochildi' : 'Taklif tanlandi — mijoz kontakti ochildi';
    await this.systemMessage(tx, requestShopId, 'CONTACT', text);
    void actorId;
    return at;
  }

  async revealContact(userId: string, requestId: string, shopId: string) {
    await this.ownRequest(userId, requestId);
    const rs = await this.db.quoteRequestShop.findUnique({ where: { requestId_shopId: { requestId, shopId } } });
    if (!rs) throw new NotFoundException(ERRORS.REQUEST_SHOP_NOT_FOUND);
    const at = await this.db.$transaction((tx) => this.revealContactTx(tx, rs.id, userId, 'MANUAL'));
    return { contactRevealedAt: at };
  }

  async close(userId: string, requestId: string) {
    const request = await this.ownRequest(userId, requestId);
    assertRequestTransition(request.status, 'CLOSED_NO_SELECTION', 'CUSTOMER');
    await this.db.$transaction(async (tx) => {
      const updated = await tx.quoteRequest.updateMany({ where: { id: requestId, status: 'OPEN' }, data: { status: 'CLOSED_NO_SELECTION', closedAt: new Date() } });
      if (updated.count === 0) throw new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);
      await this.closeOutShops(tx, requestId, null, 'REQUEST_CLOSED');
    });
    return { status: 'CLOSED_NO_SELECTION' };
  }

  /**
   * So‘rov yopilganda/boshqa taklif tanlanganda: qolgan do‘konlar NOT_SELECTED, ularning takliflari REJECTED,
   * do‘konlarga QUOTE_NOT_SELECTED (13.1).
   */
  async closeOutShops(tx: Tx, requestId: string, exceptShopId: string | null, reason: 'REQUEST_CLOSED' | 'OTHER_SELECTED' | 'EXPIRED') {
    const shops = await tx.quoteRequestShop.findMany({ where: { requestId, status: { in: OPEN_REQUEST_SHOP_STATUSES }, ...(exceptShopId ? { shopId: { not: exceptShopId } } : {}) } });
    const request = await tx.quoteRequest.findUniqueOrThrow({ where: { id: requestId }, select: { number: true } });
    for (const rs of shops) {
      if (!canRequestShopTransition(rs.status, 'NOT_SELECTED', 'SYSTEM')) continue;
      await tx.quoteRequestShop.update({ where: { id: rs.id }, data: { status: 'NOT_SELECTED', pipelineStage: 'LOST' } });
      await tx.quote.updateMany({ where: { requestId, shopId: rs.shopId, status: { in: ['SENT', 'VIEWED'] } }, data: { status: 'REJECTED', decidedAt: new Date(), rejectReason: reason } });
      const body = reason === 'OTHER_SELECTED' ? `№${request.number}: mijoz boshqa taklifni tanladi.` : reason === 'EXPIRED' ? `№${request.number}: so‘rov muddati tugadi.` : `№${request.number}: mijoz so‘rovni yopdi.`;
      await this.systemMessage(tx, rs.id, 'STATUS', body);
      await this.notify.toShop(tx, rs.shopId, { type: 'QUOTE_NOT_SELECTED', title: 'So‘rov yopildi', body, entityType: 'RequestShop', entityId: rs.id, newStatus: 'NOT_SELECTED' });
    }
  }

  // ───────────── Do‘kon (inbox, pipeline) ─────────────

  async listForShop(ctx: ShopContext, query: ShopRequestsQueryDto) {
    const limit = query.limit ?? 30;
    const rows = await this.db.quoteRequestShop.findMany({
      where: {
        shopId: ctx.shopId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.stage ? { pipelineStage: query.stage } : {}),
        ...(query.assigned === 'mine' ? { assignedMemberId: ctx.memberId } : {}),
      },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        request: { select: { id: true, number: true, title: true, systemType: true, requiredCapacityKw: true, batteryNeeded: true, installationNeeded: true, financingInterest: true, regionCode: true, districtCode: true, status: true, createdAt: true, user: { select: { firstName: true } } } },
        assignedMember: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
    const items = rows.slice(0, limit);
    const unread = await this.unreadByRequestShop(items.map((r) => r.id), 'SHOP');
    const quotes = await this.db.quote.findMany({ where: { shopId: ctx.shopId, requestId: { in: items.map((r) => r.requestId) }, status: { not: 'WITHDRAWN' } }, select: { id: true, requestId: true, status: true, total: true } });
    return {
      items: items.map((rs) => ({
        id: rs.id,
        status: rs.status,
        pipelineStage: rs.pipelineStage,
        sentAt: rs.sentAt,
        viewedAt: rs.viewedAt,
        firstResponseAt: rs.firstResponseAt,
        contactRevealed: !!rs.contactRevealedAt,
        assignedMember: rs.assignedMember ? { id: rs.assignedMember.id, name: [rs.assignedMember.user.firstName, rs.assignedMember.user.lastName].filter(Boolean).join(' ') } : null,
        request: { ...rs.request, customerFirstName: rs.request.user.firstName ?? null, user: undefined },
        unread: unread.get(rs.id) ?? 0,
        quote: quotes.find((q) => q.requestId === rs.requestId) ?? null,
      })),
      nextCursor: rows.length > limit ? items[items.length - 1].id : null,
    };
  }

  private async shopRequestShop(ctx: ShopContext, requestShopId: string) {
    const rs = await this.db.quoteRequestShop.findFirst({ where: { id: requestShopId, shopId: ctx.shopId } });
    if (!rs) throw new NotFoundException(ERRORS.REQUEST_SHOP_NOT_FOUND);
    return rs;
  }

  /** Do‘kon ko‘rinishi — kontakt siyosati (13.2). Birinchi ochilishda SENT → VIEWED. */
  async getForShop(ctx: ShopContext, requestShopId: string) {
    let rs = await this.shopRequestShop(ctx, requestShopId);
    if (rs.status === 'SENT') {
      const updated = await this.db.quoteRequestShop.updateMany({ where: { id: rs.id, status: 'SENT' }, data: { status: 'VIEWED', viewedAt: new Date() } });
      if (updated.count) rs = await this.shopRequestShop(ctx, requestShopId);
    }
    return this.shopView(rs.id);
  }

  async shopView(requestShopId: string) {
    const rs = await this.db.quoteRequestShop.findUniqueOrThrow({
      where: { id: requestShopId },
      include: {
        request: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } } },
        assignedMember: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        siteVisits: { orderBy: { createdAt: 'desc' } },
        notes: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    const { request } = rs;
    const revealed = !!rs.contactRevealedAt;
    const calc = request.calculationId ? await this.db.calculation.findUnique({ where: { id: request.calculationId }, select: { outputSummaryJson: true, inputSnapshotJson: true } }) : null;
    let site: Record<string, unknown> | null = null;
    if (request.siteId) {
      const row = await this.db.customerSite.findUnique({ where: { id: request.siteId }, select: { id: true, title: true, siteType: true, address: true, regionCode: true, districtCode: true, areas: { select: { id: true, name: true, usableAreaM2: true, projectedAreaM2: true, areaType: true } } } });
      if (row) {
        const usable = row.areas.reduce((sum, a) => sum + Number(a.usableAreaM2), 0);
        site = { siteType: row.siteType, regionCode: row.regionCode, districtCode: row.districtCode, usableAreaM2: Math.round(usable * 10) / 10, areaCount: row.areas.length };
        if (revealed) {
          const [points, geoms] = await Promise.all([this.geo.sitePoints([row.id]), this.geo.areaGeometries([row.id])]);
          site = { ...site, title: row.title, address: row.address, location: points.get(row.id) ?? null, areas: row.areas.map((a) => ({ ...a, polygon: geoms.get(a.id) ?? null })) };
        }
      }
    }
    const authorIds = [...new Set(rs.notes.map((n) => n.authorId))];
    const authors = authorIds.length ? await this.db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
    const quote = await this.db.quote.findFirst({ where: { requestId: request.id, shopId: rs.shopId, status: { not: 'WITHDRAWN' } }, select: { id: true, status: true, total: true, currentRevision: true, validUntil: true, installation: { select: { id: true, status: true } } } });
    return {
      id: rs.id,
      shopId: rs.shopId,
      status: rs.status,
      pipelineStage: rs.pipelineStage,
      declineReason: rs.declineReason,
      sentAt: rs.sentAt,
      viewedAt: rs.viewedAt,
      firstResponseAt: rs.firstResponseAt,
      contactRevealedAt: rs.contactRevealedAt,
      assignedMember: rs.assignedMember ? { id: rs.assignedMember.id, name: [rs.assignedMember.user.firstName, rs.assignedMember.user.lastName].filter(Boolean).join(' ') } : null,
      request: {
        id: request.id, number: request.number, title: request.title, status: request.status, systemType: request.systemType, requiredCapacityKw: request.requiredCapacityKw,
        batteryNeeded: request.batteryNeeded, installationNeeded: request.installationNeeded, financingInterest: request.financingInterest, notes: request.notes,
        regionCode: request.regionCode, districtCode: request.districtCode, createdAt: request.createdAt,
      },
      customer: revealed
        ? { firstName: request.user.firstName, lastName: request.user.lastName, phone: request.user.phone, email: request.user.email, revealed: true }
        : { firstName: request.user.firstName, revealed: false },
      calculation: calc ? calcBrief(calc.outputSummaryJson, calc.inputSnapshotJson) : null,
      site,
      siteVisits: rs.siteVisits,
      notes: rs.notes.map((n) => {
        const a = authors.find((u) => u.id === n.authorId);
        return { id: n.id, body: n.body, createdAt: n.createdAt, author: a ? [a.firstName, a.lastName].filter(Boolean).join(' ') : null };
      }),
      quote,
    };
  }

  async updateLead(ctx: ShopContext, requestShopId: string, dto: UpdateLeadDto, actorId: string) {
    const rs = await this.shopRequestShop(ctx, requestShopId);
    const data: Prisma.QuoteRequestShopUncheckedUpdateInput = {};
    if (dto.pipelineStage) data.pipelineStage = dto.pipelineStage;
    if (dto.unassign || dto.assignedMemberId === null) data.assignedMemberId = null;
    else if (dto.assignedMemberId) {
      const member = await this.db.shopMember.findFirst({ where: { id: dto.assignedMemberId, shopId: ctx.shopId }, select: { id: true } });
      if (!member) throw new NotFoundException(ERRORS.SHOP_MEMBER_NOT_FOUND);
      data.assignedMemberId = member.id;
    }
    await this.db.$transaction(async (tx) => {
      await tx.quoteRequestShop.update({ where: { id: rs.id }, data });
      await tx.auditLog.create({ data: { actorId, action: 'LEAD_UPDATED', targetType: 'QuoteRequestShop', targetId: rs.id, before: { pipelineStage: rs.pipelineStage, assignedMemberId: rs.assignedMemberId }, after: data as Prisma.InputJsonValue } });
    });
    return this.shopView(rs.id);
  }

  async decline(ctx: ShopContext, requestShopId: string, dto: DeclineDto, actorId: string) {
    const rs = await this.shopRequestShop(ctx, requestShopId);
    const reason = dto.reason.trim();
    if (reason.length < 3) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'DECLINE_REASON_REQUIRED', ERRORS.DECLINE_REASON_REQUIRED);
    assertRequestShopTransition(rs.status, 'DECLINED', 'SHOP');
    await this.db.$transaction(async (tx) => {
      const updated = await tx.quoteRequestShop.updateMany({ where: { id: rs.id, status: rs.status }, data: { status: 'DECLINED', declineReason: reason, pipelineStage: 'LOST', firstResponseAt: rs.firstResponseAt ?? new Date() } });
      if (!updated.count) throw new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);
      await tx.quote.updateMany({ where: { requestId: rs.requestId, shopId: rs.shopId, status: 'DRAFT' }, data: { status: 'WITHDRAWN' } });
      await this.systemMessage(tx, rs.id, 'STATUS', `Do‘kon so‘rovni rad etdi: ${reason}`);
      const request = await tx.quoteRequest.findUniqueOrThrow({ where: { id: rs.requestId }, select: { userId: true, number: true } });
      await this.notify.toUser(tx, request.userId, { type: 'NEW_MESSAGE', title: 'Do‘kon so‘rovni rad etdi', body: `№${request.number}: ${reason}`, entityType: 'QuoteRequest', entityId: rs.requestId, newStatus: 'DECLINED' }, actorId);
    });
    return this.shopView(rs.id);
  }

  async addNote(ctx: ShopContext, requestShopId: string, body: string, authorId: string) {
    const rs = await this.shopRequestShop(ctx, requestShopId);
    await this.db.shopLeadNote.create({ data: { requestShopId: rs.id, authorId, body: body.trim() } });
    return (await this.shopView(rs.id)).notes;
  }

  // ───────────── Yozishma (ikki tomon) ─────────────

  /**
   * Qatnashchini aniqlash. Bir foydalanuvchi ham mijoz, ham do‘kon a’zosi bo‘lsa — panel sarlavhasi hal qiladi.
   * Begona — 404 (mavjudlikni oshkor qilmaslik).
   */
  async participant(userId: string, requestShopId: string, panel: Panel | null, need: 'read' | 'write', permission?: ShopPermission): Promise<Participant> {
    const rs = await this.db.quoteRequestShop.findUnique({
      where: { id: requestShopId },
      include: { request: { select: { id: true, userId: true, status: true, number: true, title: true } }, shop: { select: { status: true, archivedAt: true } } },
    });
    if (!rs) throw new NotFoundException(ERRORS.REQUEST_SHOP_NOT_FOUND);
    const isOwner = rs.request.userId === userId;
    const member = await this.db.shopMember.findUnique({ where: { shopId_userId: { shopId: rs.shopId, userId } }, select: { id: true, memberRole: true, permissions: true } });
    const asShop = member && !rs.shop.archivedAt && (panel === 'SHOP' || !isOwner);
    const { shop, ...plain } = rs;
    if (asShop) {
      const required: ShopPermission = permission ?? (need === 'write' ? 'messages.write' : 'requests.read');
      const allowed = member.memberRole === 'OWNER' || member.permissions.includes(required) || (need === 'read' && member.permissions.includes('messages.write'));
      if (!allowed) throw new ForbiddenException(ERRORS.SHOP_PERMISSION_REQUIRED);
      if (need === 'write' && shop.status === 'SUSPENDED') throw new DomainException(HttpStatus.LOCKED, 'SHOP_SUSPENDED', ERRORS.SHOP_SUSPENDED);
      return { side: 'SHOP', userId, rs: plain, member };
    }
    if (isOwner) return { side: 'CUSTOMER', userId, rs: plain, member: null };
    throw new NotFoundException(ERRORS.REQUEST_SHOP_NOT_FOUND);
  }

  async conversation(userId: string, requestShopId: string, panel: Panel | null) {
    const p = await this.participant(userId, requestShopId, panel, 'read');
    if (p.side === 'SHOP') return { side: p.side, ...(await this.shopView(p.rs.id)) };
    const shop = await this.db.shop.findUniqueOrThrow({ where: { id: p.rs.shopId }, select: SHOP_CARD });
    const [request, quote, visits] = await Promise.all([
      this.db.quoteRequest.findUniqueOrThrow({ where: { id: p.rs.requestId }, select: { id: true, number: true, title: true, status: true, systemType: true, requiredCapacityKw: true } }),
      this.db.quote.findFirst({ where: { requestId: p.rs.requestId, shopId: p.rs.shopId, status: { in: CUSTOMER_VISIBLE_QUOTE } }, select: { id: true, status: true, total: true, currentRevision: true } }),
      this.db.siteVisit.findMany({ where: { requestShopId: p.rs.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { side: p.side, id: p.rs.id, status: p.rs.status, contactRevealedAt: p.rs.contactRevealedAt, shop, request, quote, siteVisits: visits };
  }

  async messages(userId: string, requestShopId: string, panel: Panel | null, query: MessagesQueryDto) {
    const p = await this.participant(userId, requestShopId, panel, 'read');
    const limit = query.limit ?? 50;
    const rows = await this.db.conversationMessage.findMany({
      where: { requestShopId: p.rs.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, limit);
    const fileIds = [...new Set(items.flatMap((m) => m.attachmentFileIds))];
    const files = fileIds.length ? await this.db.mediaAsset.findMany({ where: { id: { in: fileIds } }, select: { id: true, originalName: true, detectedMimeType: true, sizeBytes: true, status: true } }) : [];
    return {
      side: p.side,
      items: items.map((m) => ({
        id: m.id,
        senderSide: m.senderSide,
        mine: m.senderUserId === userId && m.senderSide === p.side,
        body: m.body,
        systemKind: m.systemKind,
        clientId: m.clientId,
        readAt: m.readAt,
        createdAt: m.createdAt,
        attachments: m.attachmentFileIds.map((id) => {
          const f = files.find((x) => x.id === id);
          return f ? { id, name: f.originalName, mime: f.detectedMimeType, size: Number(f.sizeBytes), status: f.status } : { id, name: null, mime: null, size: 0, status: 'FAILED' };
        }),
      })),
      nextCursor: rows.length > limit ? items[items.length - 1].id : null,
    };
  }

  async sendMessage(userId: string, requestShopId: string, panel: Panel | null, dto: SendMessageDto) {
    const p = await this.participant(userId, requestShopId, panel, 'write');
    const body = dto.body?.trim() ?? '';
    const attachmentIds = [...new Set(dto.attachmentIds ?? [])];
    if (!body && attachmentIds.length === 0) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'MESSAGE_EMPTY', ERRORS.MESSAGE_EMPTY);
    if (attachmentIds.length > 5) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'MESSAGE_ATTACHMENTS_LIMIT', ERRORS.MESSAGE_ATTACHMENTS_LIMIT);
    if (attachmentIds.length) {
      const ok = await this.db.mediaAsset.count({ where: { id: { in: attachmentIds }, uploaderId: userId, kind: 'MESSAGE_ATTACHMENT', linkedResourceType: 'RequestShop', linkedResourceId: p.rs.id, status: { notIn: ['REJECTED', 'FAILED'] } } });
      if (ok !== attachmentIds.length) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'MESSAGE_ATTACHMENT_INVALID', ERRORS.MESSAGE_ATTACHMENT_INVALID);
    }
    if (dto.clientId) {
      const dup = await this.db.conversationMessage.findUnique({ where: { requestShopId_clientId: { requestShopId: p.rs.id, clientId: dto.clientId } } });
      if (dup) return dup;
    }
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const message = await tx.conversationMessage.create({
        data: { requestShopId: p.rs.id, senderUserId: userId, senderSide: p.side, body, attachmentFileIds: attachmentIds, clientId: dto.clientId ?? null },
      });
      const rsUpdate: Prisma.QuoteRequestShopUpdateInput = {};
      if (p.side === 'SHOP') {
        if (!p.rs.firstResponseAt) rsUpdate.firstResponseAt = now;
        if (p.rs.status === 'SENT') {
          rsUpdate.status = 'VIEWED';
          rsUpdate.viewedAt = p.rs.viewedAt ?? now;
        }
        // Savol (13.1): faqat jadvalda ruxsat etilgan holatlardan; aks holda (allaqachon savol yoki taklif yuborilgan) — oddiy xabar.
        if (dto.asClarification && canRequestShopTransition(p.rs.status, 'CLARIFICATION_REQUESTED', 'SHOP')) {
          rsUpdate.status = 'CLARIFICATION_REQUESTED';
        }
        if (p.rs.pipelineStage === 'NEW') rsUpdate.pipelineStage = 'CONTACTED';
      } else if (p.rs.status === 'CLARIFICATION_REQUESTED') {
        assertRequestShopTransition('CLARIFICATION_REQUESTED', 'VIEWED', 'CUSTOMER');
        rsUpdate.status = 'VIEWED';
      }
      if (Object.keys(rsUpdate).length) await tx.quoteRequestShop.update({ where: { id: p.rs.id }, data: rsUpdate });
      if (attachmentIds.length) await tx.mediaAsset.updateMany({ where: { id: { in: attachmentIds } }, data: { linkedResourceType: 'RequestShop', linkedResourceId: p.rs.id } });
      await tx.quoteRequest.update({ where: { id: p.rs.requestId }, data: { lastActivityAt: now } });
      const preview = body ? (body.length > 120 ? `${body.slice(0, 117)}…` : body) : 'Fayl yubordi';
      if (p.side === 'SHOP') {
        const shop = await tx.shop.findUniqueOrThrow({ where: { id: p.rs.shopId }, select: { name: true } });
        await this.notify.toUser(tx, p.rs.request.userId, { type: 'NEW_MESSAGE', title: `${shop.name}: yangi xabar`, body: preview, entityType: 'RequestShop', entityId: p.rs.id }, userId);
      } else {
        await this.notify.toShop(tx, p.rs.shopId, { type: 'NEW_MESSAGE', title: `So‘rov №${p.rs.request.number}: yangi xabar`, body: preview, entityType: 'RequestShop', entityId: p.rs.id }, { actorId: userId, permission: 'messages.write', assignedMemberId: p.rs.assignedMemberId });
      }
      return message;
    });
  }

  async markRead(userId: string, requestShopId: string, panel: Panel | null) {
    const p = await this.participant(userId, requestShopId, panel, 'read');
    const result = await this.db.conversationMessage.updateMany({ where: { requestShopId: p.rs.id, senderSide: { not: p.side }, readAt: null }, data: { readAt: new Date() } });
    return { count: result.count };
  }

  async systemMessage(tx: Tx, requestShopId: string, kind: string, body: string) {
    await tx.conversationMessage.create({ data: { requestShopId, senderSide: 'SYSTEM', systemKind: kind, body } });
  }

  private async unreadByRequestShop(ids: string[], side: Side) {
    const map = new Map<string, number>();
    if (!ids.length) return map;
    const groups = await this.db.conversationMessage.groupBy({
      by: ['requestShopId'],
      where: { requestShopId: { in: ids }, readAt: null, senderSide: side === 'CUSTOMER' ? 'SHOP' : 'CUSTOMER' },
      _count: { _all: true },
    });
    for (const g of groups) map.set(g.requestShopId, g._count._all);
    return map;
  }

  /** Mijozning barcha suhbatlari (U9.3 chap ustun). */
  async customerConversations(userId: string) {
    const rows = await this.db.quoteRequestShop.findMany({
      where: { request: { userId } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        shop: { select: { id: true, name: true, logoAssetId: true } },
        request: { select: { id: true, number: true, title: true, status: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, senderSide: true, createdAt: true, attachmentFileIds: true } },
      },
    });
    const unread = await this.unreadByRequestShop(rows.map((r) => r.id), 'CUSTOMER');
    return rows
      .map((rs) => ({ id: rs.id, status: rs.status, shop: rs.shop, request: rs.request, last: rs.messages[0] ?? null, unread: unread.get(rs.id) ?? 0 }))
      .sort((a, b) => (b.last?.createdAt.getTime() ?? 0) - (a.last?.createdAt.getTime() ?? 0));
  }

  // ───────────── O‘lchov uchrashuvi (U9.4) ─────────────

  async proposeSiteVisit(userId: string, requestShopId: string, panel: Panel | null, dto: ProposeSiteVisitDto) {
    const p = await this.participant(userId, requestShopId, panel, 'write');
    if (p.side !== 'SHOP') throw new ForbiddenException(ERRORS.SHOP_PERMISSION_REQUIRED);
    if (p.rs.request.status !== 'OPEN' && !(await this.hasActiveInstallation(p.rs.requestId, p.rs.shopId))) {
      throw new DomainException(HttpStatus.CONFLICT, 'QUOTE_REQUEST_NOT_OPEN', ERRORS.QUOTE_REQUEST_NOT_OPEN);
    }
    const now = Date.now();
    const slots = dto.slots.map((s) => ({ start: new Date(s.start), end: new Date(s.end) }));
    if (slots.some((s) => !(s.start.getTime() > now) || !(s.end > s.start) || s.end.getTime() - s.start.getTime() > 12 * 3_600_000)) {
      throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'SITE_VISIT_SLOTS_INVALID', ERRORS.SITE_VISIT_SLOTS_INVALID);
    }
    return this.db.$transaction(async (tx) => {
      // Oldingi taklif qilingan (tasdiqlanmagan) uchrashuvlar bekor bo‘ladi — bir vaqtda bitta ochiq taklif.
      await tx.siteVisit.updateMany({ where: { requestShopId: p.rs.id, status: 'PROPOSED' }, data: { status: 'CANCELLED', cancelReason: 'REPLACED' } });
      const visit = await tx.siteVisit.create({
        data: { requestShopId: p.rs.id, proposedSlotsJson: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })), notes: dto.notes?.trim() || null, proposedById: userId },
      });
      const rsData: Prisma.QuoteRequestShopUpdateInput = { pipelineStage: p.rs.pipelineStage === 'NEW' || p.rs.pipelineStage === 'CONTACTED' ? 'SITE_VISIT' : p.rs.pipelineStage };
      if (!p.rs.firstResponseAt) rsData.firstResponseAt = new Date();
      if (p.rs.status === 'SENT') {
        rsData.status = 'VIEWED';
        rsData.viewedAt = new Date();
      }
      await tx.quoteRequestShop.update({ where: { id: p.rs.id }, data: rsData });
      await this.systemMessage(tx, p.rs.id, 'SITE_VISIT', `Do‘kon o‘lchov uchrashuvi uchun ${slots.length} ta vaqt taklif qildi`);
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: p.rs.shopId }, select: { name: true } });
      await this.notify.toUser(tx, p.rs.request.userId, { type: 'SITE_VISIT_PROPOSED', title: 'O‘lchov uchrashuvi taklifi', body: `${shop.name} o‘lchov uchun vaqt taklif qildi — birini tanlang.`, entityType: 'RequestShop', entityId: p.rs.id }, userId);
      return visit;
    });
  }

  private async hasActiveInstallation(requestId: string, shopId: string) {
    return (await this.db.installation.count({ where: { requestId, shopId, status: { in: ['AGREED', 'SITE_VISIT_SCHEDULED', 'INSTALLATION_SCHEDULED'] } } })) > 0;
  }

  async updateSiteVisit(userId: string, requestShopId: string, visitId: string, panel: Panel | null, dto: UpdateSiteVisitDto) {
    const p = await this.participant(userId, requestShopId, panel, 'write');
    const visit = await this.db.siteVisit.findFirst({ where: { id: visitId, requestShopId: p.rs.id } });
    if (!visit) throw new NotFoundException(ERRORS.SITE_VISIT_NOT_FOUND);
    const invalid = () => new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);

    return this.db.$transaction(async (tx) => {
      switch (dto.action) {
        case 'CONFIRM': {
          if (p.side !== 'CUSTOMER' || visit.status !== 'PROPOSED') throw invalid();
          const slots = visit.proposedSlotsJson as Array<{ start: string; end: string }>;
          const slot = slots[dto.slotIndex ?? -1];
          if (!slot) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'SITE_VISIT_SLOT_NOT_OFFERED', ERRORS.SITE_VISIT_SLOT_NOT_OFFERED);
          if (new Date(slot.start).getTime() <= Date.now()) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'SITE_VISIT_SLOTS_INVALID', ERRORS.SITE_VISIT_SLOTS_INVALID);
          const updated = await tx.siteVisit.updateMany({ where: { id: visit.id, status: 'PROPOSED' }, data: { status: 'CONFIRMED', confirmedStart: new Date(slot.start), confirmedEnd: new Date(slot.end) } });
          if (!updated.count) throw invalid();
          await this.revealContactTx(tx, p.rs.id, userId, 'SITE_VISIT');
          // Montaj AGREED bo‘lsa — SITE_VISIT_SCHEDULED (13.1).
          const inst = await tx.installation.findFirst({ where: { requestId: p.rs.requestId, shopId: p.rs.shopId, status: 'AGREED' } });
          if (inst) {
            const history = [...((inst.historyJson as unknown[]) ?? []), { status: 'SITE_VISIT_SCHEDULED', at: new Date().toISOString(), side: 'CUSTOMER', note: tashkentDateTime(slot.start) }];
            await tx.installation.update({ where: { id: inst.id }, data: { status: 'SITE_VISIT_SCHEDULED', historyJson: history as Prisma.InputJsonValue, version: { increment: 1 } } });
          }
          await this.systemMessage(tx, p.rs.id, 'SITE_VISIT', `O‘lchov uchrashuvi tasdiqlandi: ${tashkentDateTime(slot.start)}`);
          await this.notify.toShop(tx, p.rs.shopId, { type: 'SITE_VISIT_CONFIRMED', title: 'O‘lchov tasdiqlandi', body: `So‘rov №${p.rs.request.number}: mijoz vaqtni tasdiqladi, kontakt ochildi.`, entityType: 'RequestShop', entityId: p.rs.id }, { actorId: userId, assignedMemberId: p.rs.assignedMemberId });
          break;
        }
        case 'REQUEST_OTHER': {
          if (p.side !== 'CUSTOMER' || visit.status !== 'PROPOSED') throw invalid();
          await tx.siteVisit.update({ where: { id: visit.id }, data: { status: 'CANCELLED', cancelReason: dto.reason?.trim() || 'OTHER_TIME' } });
          await this.systemMessage(tx, p.rs.id, 'SITE_VISIT', `Mijoz boshqa vaqt so‘radi${dto.reason?.trim() ? `: ${dto.reason.trim()}` : ''}`);
          await this.notify.toShop(tx, p.rs.shopId, { type: 'NEW_MESSAGE', title: 'Mijoz boshqa vaqt so‘radi', body: dto.reason?.trim() || `So‘rov №${p.rs.request.number}`, entityType: 'RequestShop', entityId: p.rs.id }, { actorId: userId, assignedMemberId: p.rs.assignedMemberId });
          break;
        }
        case 'CANCEL': {
          if (!['PROPOSED', 'CONFIRMED'].includes(visit.status)) throw invalid();
          const reason = dto.reason?.trim();
          if (!reason) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'CANCEL_REASON_REQUIRED', ERRORS.CANCEL_REASON_REQUIRED);
          await tx.siteVisit.update({ where: { id: visit.id }, data: { status: 'CANCELLED', cancelReason: reason } });
          await this.systemMessage(tx, p.rs.id, 'SITE_VISIT', `O‘lchov uchrashuvi bekor qilindi: ${reason}`);
          if (p.side === 'SHOP') await this.notify.toUser(tx, p.rs.request.userId, { type: 'SITE_VISIT_CONFIRMED', title: 'O‘lchov bekor qilindi', body: reason, entityType: 'RequestShop', entityId: p.rs.id }, userId);
          else await this.notify.toShop(tx, p.rs.shopId, { type: 'SITE_VISIT_CONFIRMED', title: 'O‘lchov bekor qilindi', body: reason, entityType: 'RequestShop', entityId: p.rs.id }, { actorId: userId, assignedMemberId: p.rs.assignedMemberId });
          break;
        }
        case 'DONE': {
          if (p.side !== 'SHOP' || visit.status !== 'CONFIRMED') throw invalid();
          await tx.siteVisit.update({ where: { id: visit.id }, data: { status: 'DONE' } });
          await this.systemMessage(tx, p.rs.id, 'SITE_VISIT', 'O‘lchov bajarildi');
          break;
        }
      }
      return tx.siteVisit.findUniqueOrThrow({ where: { id: visit.id } });
    });
  }

  /** "Kalendarga qo‘shish" (.ics) — faqat tasdiqlangan uchrashuv. */
  async siteVisitIcs(userId: string, requestShopId: string, visitId: string, panel: Panel | null) {
    const p = await this.participant(userId, requestShopId, panel, 'read');
    const visit = await this.db.siteVisit.findFirst({ where: { id: visitId, requestShopId: p.rs.id, status: 'CONFIRMED' } });
    if (!visit?.confirmedStart) throw new NotFoundException(ERRORS.SITE_VISIT_NOT_FOUND);
    const shop = await this.db.shop.findUniqueOrThrow({ where: { id: p.rs.shopId }, select: { name: true } });
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = visit.confirmedEnd ?? new Date(visit.confirmedStart.getTime() + 3_600_000);
    const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Quyosh//Site visit//UZ', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:${visit.id}@quyosh`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(visit.confirmedStart)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:${esc(`O‘lchov: ${shop.name} — so‘rov №${p.rs.request.number}`)}`,
      ...(visit.notes ? [`DESCRIPTION:${esc(visit.notes)}`] : []),
      'END:VEVENT', 'END:VCALENDAR', '',
    ].join('\r\n');
  }
}
