import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import type { RangeDto, TrackEventsDto } from './dto/analytics.dto';

const DAY = 86_400_000;

export interface TrackInput {
  eventType: string;
  userId?: string | null;
  anonymousId?: string | null;
  shopId?: string | null;
  entityId?: string | null;
  regionCode?: string | null;
  properties?: Record<string, unknown>;
}

/** Xususiyatlar: faqat oddiy qiymatlar, 10 ta kalit, qisqa satrlar; telefon/email ko‘rinishidagi qiymatlar tashlanadi. */
function sanitize(props: Record<string, unknown> | undefined): Prisma.InputJsonValue {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props ?? {}).slice(0, 10)) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && !/@|\+?\d[\d\s-]{7,}/.test(v)) out[k] = v.slice(0, 100);
  }
  return out;
}

/** Oraliq: standart 30 kun, max 366 kun (U11.14). */
export function range(dto: RangeDto) {
  const to = dto.to ? new Date(dto.to) : new Date();
  const from = dto.from ? new Date(dto.from) : new Date(to.getTime() - 30 * DAY);
  const days = (to.getTime() - from.getTime()) / DAY;
  if (!(days > 0) || days > 366) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'ANALYTICS_RANGE_INVALID', ERRORS.ANALYTICS_RANGE_INVALID);
  return { from, to };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Funnel va do‘kon analitikasi (TZ 7.7 AnalyticsEvent, U11.14, U12.10). */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly db: PrismaService) {}

  /** Server hodisasi — xato asosiy oqimni to‘xtatmaydi. */
  async track(input: TrackInput, db: Prisma.TransactionClient | PrismaService = this.db) {
    try {
      await db.analyticsEvent.create({
        data: { eventType: input.eventType, userId: input.userId ?? null, anonymousId: input.anonymousId ?? null, shopId: input.shopId ?? null, entityId: input.entityId ?? null, regionCode: input.regionCode ?? null, propertiesJson: sanitize(input.properties) },
      });
    } catch (error) {
      this.logger.warn(`Analitika hodisasi yozilmadi (${input.eventType}): ${(error as Error).message}`);
    }
  }

  async ingest(dto: TrackEventsDto, userId: string | null) {
    await this.db.analyticsEvent.createMany({
      data: dto.events.map((e) => ({ eventType: e.eventType, userId, anonymousId: dto.anonymousId, shopId: e.shopId ?? null, entityId: e.entityId ?? null, regionCode: e.regionCode ?? null, propertiesJson: sanitize(e.properties) })),
    });
    return { accepted: dto.events.length };
  }

  /** U11.14: ko‘rishlar, so‘rovlar, javob vaqti, voronka, mahsulot ko‘rishlari, hududlar. */
  async shop(ctx: ShopContext, dto: RangeDto) {
    const { from, to } = range(dto);
    const shopId = ctx.shopId;
    const [views, productViews, leads, quotes, installs] = await Promise.all([
      this.db.$queryRaw<Array<{ day: string; n: bigint }>>`
        SELECT to_char(occurred_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day, COUNT(*) AS n
        FROM analytics_events WHERE shop_id = ${shopId}::uuid AND event_type = 'shop_view' AND occurred_at BETWEEN ${from} AND ${to}
        GROUP BY 1 ORDER BY 1`,
      this.db.$queryRaw<Array<{ entity_id: string; n: bigint }>>`
        SELECT entity_id, COUNT(*) AS n FROM analytics_events
        WHERE shop_id = ${shopId}::uuid AND event_type = 'product_view' AND entity_id IS NOT NULL AND occurred_at BETWEEN ${from} AND ${to}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      this.db.quoteRequestShop.findMany({ where: { shopId, sentAt: { gte: from, lte: to } }, select: { status: true, sentAt: true, viewedAt: true, firstResponseAt: true, request: { select: { regionCode: true, source: true } } } }),
      this.db.quote.findMany({ where: { shopId, sentAt: { gte: from, lte: to } }, select: { status: true } }),
      this.db.installation.findMany({ where: { shopId, confirmedAt: { gte: from, lte: to } }, select: { checklistResultJson: true } }),
    ]);
    const models = productViews.length ? await this.db.productModel.findMany({ where: { id: { in: productViews.map((p) => p.entity_id) } }, select: { id: true, brand: true, model: true } }) : [];
    const byDay = new Map<string, { requests: number; responseMinutes: number[] }>();
    const dayOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
    for (const l of leads) {
      const k = dayOf(l.sentAt);
      const v = byDay.get(k) ?? { requests: 0, responseMinutes: [] };
      v.requests += 1;
      if (l.firstResponseAt) v.responseMinutes.push((l.firstResponseAt.getTime() - l.sentAt.getTime()) / 60_000);
      byDay.set(k, v);
    }
    const regions = new Map<string, number>();
    for (const l of leads) regions.set(l.request.regionCode ?? 'unknown', (regions.get(l.request.regionCode ?? 'unknown') ?? 0) + 1);
    const responded = leads.filter((l) => l.firstResponseAt).map((l) => (l.firstResponseAt!.getTime() - l.sentAt.getTime()) / 60_000);
    const clean = installs.filter((i) => !((i.checklistResultJson as Array<{ status: string }> | null) ?? []).some((a) => a.status === 'ISSUE')).length;
    return {
      from, to,
      totals: {
        views: views.reduce((s, v) => s + Number(v.n), 0),
        requests: leads.length,
        widgetRequests: leads.filter((l) => l.request.source === 'WIDGET').length,
        medianResponseMinutes: median(responded) === null ? null : Math.round(median(responded)!),
        quotesSent: quotes.length,
        selected: quotes.filter((q) => q.status === 'ACCEPTED').length,
        installationsConfirmed: installs.length,
        cleanAcceptanceShare: installs.length ? Math.round((clean / installs.length) * 100) / 100 : null,
      },
      funnel: [
        { step: 'REQUESTS', count: leads.length },
        { step: 'VIEWED', count: leads.filter((l) => l.viewedAt).length },
        { step: 'QUOTED', count: quotes.length },
        { step: 'SELECTED', count: quotes.filter((q) => q.status === 'ACCEPTED').length },
        { step: 'INSTALLED', count: installs.length },
      ],
      daily: [...new Set([...views.map((v) => v.day), ...byDay.keys()])].sort().map((day) => ({
        day,
        views: Number(views.find((v) => v.day === day)?.n ?? 0),
        requests: byDay.get(day)?.requests ?? 0,
        medianResponseMinutes: median(byDay.get(day)?.responseMinutes ?? []),
      })),
      products: productViews.map((p) => ({ productModelId: p.entity_id, name: (() => { const m = models.find((x) => x.id === p.entity_id); return m ? `${m.brand} ${m.model}` : p.entity_id; })(), views: Number(p.n) })),
      regions: [...regions.entries()].map(([regionCode, count]) => ({ regionCode, count })).sort((a, b) => b.count - a.count),
    };
  }

  /** CSV (UTF-8 BOM; Excel uchun). */
  async shopCsv(ctx: ShopContext, dto: RangeDto) {
    const data = await this.shop(ctx, dto);
    const lines = ['Kun,Ko‘rishlar,So‘rovlar,Javob vaqti (median, daq)', ...data.daily.map((d) => [d.day, d.views, d.requests, d.medianResponseMinutes === null ? '' : Math.round(d.medianResponseMinutes)].join(','))];
    return `﻿${lines.join('\r\n')}\r\n`;
  }

  /**
   * U12.10 funnel: bosh sahifa → hisob boshlandi → natija → saqlandi → so‘rov → taklif → tanlandi → montaj tasdiqlandi.
   * Veb bosqichlar — noyob anonim/foydalanuvchi soni; keyingilari — DB yozuvlari.
   */
  async funnel(dto: RangeDto) {
    const { from, to } = range(dto);
    const region = dto.region ?? null;
    const distinct = async (eventType: string) => {
      const rows = await this.db.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(DISTINCT COALESCE(user_id::text, anonymous_id)) AS n FROM analytics_events
        WHERE event_type = ${eventType} AND occurred_at BETWEEN ${from} AND ${to} AND (${region}::text IS NULL OR region_code = ${region})`;
      return Number(rows[0]?.n ?? 0);
    };
    const reqWhere: Prisma.QuoteRequestWhereInput = { createdAt: { gte: from, lte: to }, ...(region ? { regionCode: region } : {}) };
    const [home, started, result, saved, requests, quoted, selected, installed] = await Promise.all([
      distinct('home_view'),
      distinct('calc_started'),
      distinct('calc_result'),
      this.db.calculation.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.db.quoteRequest.count({ where: reqWhere }),
      this.db.quoteRequest.count({ where: { ...reqWhere, quotes: { some: { sentAt: { not: null } } } } }),
      this.db.quoteRequest.count({ where: { ...reqWhere, status: 'CLOSED_SELECTED' } }),
      this.db.installation.count({ where: { status: 'CONFIRMED', confirmedAt: { gte: from, lte: to }, ...(region ? { quote: { request: { regionCode: region } } } : {}) } }),
    ]);
    const steps = [
      ['HOME', home], ['CALC_STARTED', started], ['CALC_RESULT', result], ['CALC_SAVED', saved], ['REQUEST', requests], ['QUOTED', quoted], ['SELECTED', selected], ['INSTALLED', installed],
    ] as const;
    return { from, to, region, steps: steps.map(([step, count], i) => ({ step, count, conversion: i === 0 || !steps[i - 1]![1] ? null : Math.round((count / steps[i - 1]![1]) * 1000) / 10 })) };
  }
}
