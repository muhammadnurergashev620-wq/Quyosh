import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import { tashkentDate } from '../../common/utils/tashkent-date';
import { numAt } from '../../common/utils/json-path';

const DAY = 86_400_000;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Bosh panellar: mijoz (U10.1), do‘kon (U11.2), admin navbatlari (U12.1). */
@Injectable()
export class DashboardService {
  constructor(private readonly db: PrismaService) {}

  /** U10.1: avval "Sizdan kutilayotgan amallar", keyin takliflar, so‘rovlar, hisoblar, tizim kartasi, eslatmalar. */
  async customer(userId: string) {
    const now = new Date();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const [quotes, installs, visits, systems, requests, calcs, reminders, site] = await Promise.all([
      this.db.quote.findMany({ where: { request: { userId, status: 'OPEN' }, status: { in: ['SENT', 'VIEWED'] } }, orderBy: { sentAt: 'desc' }, take: 10, select: { id: true, status: true, total: true, viewedAt: true, validUntil: true, currentRevision: true, shop: { select: { name: true } }, request: { select: { id: true, number: true } } } }),
      this.db.installation.findMany({ where: { userId, status: 'INSTALLED' }, select: { id: true, shop: { select: { name: true } } } }),
      this.db.siteVisit.findMany({ where: { status: 'PROPOSED', requestShop: { request: { userId } } }, select: { id: true, requestShopId: true, requestShop: { select: { shop: { select: { name: true } } } } } }),
      this.db.installedSystem.findMany({ where: { userId, archivedAt: null }, orderBy: { installedAt: 'desc' }, select: { id: true, title: true, systemPowerKw: true, expectedMonthlyKwhJson: true, installedAt: true, installation: { select: { shop: { select: { name: true } } } }, readings: { orderBy: { periodMonth: 'desc' }, take: 1, select: { periodMonth: true, generatedKwh: true } } } }),
      this.db.quoteRequest.findMany({ where: { userId, status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, number: true, title: true, createdAt: true, _count: { select: { quotes: { where: { status: { in: ['SENT', 'VIEWED'] } } } } } } }),
      this.db.calculation.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, title: true, createdAt: true, systemType: true, outputSummaryJson: true } }),
      this.db.maintenanceReminder.findMany({ where: { active: true, installedSystem: { userId, archivedAt: null }, nextAt: { lte: new Date(now.getTime() + 30 * DAY) } }, orderBy: { nextAt: 'asc' }, take: 5, select: { id: true, type: true, nextAt: true, installedSystemId: true } }),
      this.db.customerSite.findFirst({ where: { userId, archivedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true } }),
    ]);
    // Oy boshida (1–10-kun) o‘tgan oy ko‘rsatkichi kiritilmagan tizimlar.
    const needReading = now.getUTCDate() <= 10 ? systems.filter((s) => s.installedAt < lastMonth && !(s.readings[0] && s.readings[0].periodMonth >= lastMonth)) : [];
    const actions = [
      ...quotes.filter((q) => !q.viewedAt).map((q) => ({ kind: 'QUOTE' as const, id: q.id, title: q.shop.name, requestNumber: q.request.number })),
      ...installs.map((i) => ({ kind: 'ACCEPT_INSTALLATION' as const, id: i.id, title: i.shop.name })),
      ...visits.map((v) => ({ kind: 'SITE_VISIT' as const, id: v.requestShopId, title: v.requestShop.shop.name })),
      ...needReading.map((s) => ({ kind: 'READING' as const, id: s.id, title: s.title ?? s.installation?.shop.name ?? null, period: lastMonth.toISOString().slice(0, 7) })),
    ];
    const month = now.getUTCMonth();
    return {
      actions,
      newQuotes: quotes,
      openRequests: requests.map((r) => ({ id: r.id, number: r.number, title: r.title, createdAt: r.createdAt, quotes: r._count.quotes })),
      calculations: calcs.map((c) => {
        const savings = numAt(c.outputSummaryJson, 'money.savings');
        return { id: c.id, title: c.title, createdAt: c.createdAt, systemType: c.systemType, systemPowerKw: numAt(c.outputSummaryJson, 'systemPowerKw'), monthlySaving: savings !== null ? Math.round(savings / 12) : null };
      }),
      system: systems[0]
        ? (() => {
            const s = systems[0];
            const exp = Array.isArray(s.expectedMonthlyKwhJson) ? (s.expectedMonthlyKwhJson as number[]) : null;
            const reading = s.readings[0];
            return { id: s.id, title: s.title ?? s.installation?.shop.name ?? null, systemPowerKw: s.systemPowerKw, expectedThisMonthKwh: exp ? exp[month] ?? null : null, lastReading: reading ? { period: reading.periodMonth.toISOString().slice(0, 7), generatedKwh: Number(reading.generatedKwh), expectedKwh: exp ? exp[reading.periodMonth.getUTCMonth()] ?? null : null } : null };
          })()
        : null,
      reminders,
      site,
      empty: !calcs.length && !requests.length && !systems.length,
    };
  }

  /** U11.2: KPI (30 kun) va "Bugun javob bering" — SLA bo‘yicha eng eskilari birinchi. */
  async shop(ctx: ShopContext) {
    const since = new Date(Date.now() - 30 * DAY);
    const shopId = ctx.shopId;
    const [views, leads, waiting, quotes, installs, shop] = await Promise.all([
      this.db.analyticsEvent.count({ where: { shopId, eventType: 'shop_view', occurredAt: { gte: since } } }),
      this.db.quoteRequestShop.findMany({ where: { shopId, sentAt: { gte: since } }, select: { sentAt: true, firstResponseAt: true, status: true } }),
      this.db.quoteRequestShop.findMany({
        where: { shopId, firstResponseAt: null, status: { in: ['SENT', 'VIEWED'] }, request: { status: 'OPEN' } },
        orderBy: { sentAt: 'asc' },
        take: 10,
        select: { id: true, sentAt: true, status: true, request: { select: { number: true, systemType: true, requiredCapacityKw: true, regionCode: true, user: { select: { firstName: true } } } } },
      }),
      this.db.quote.findMany({ where: { shopId, sentAt: { gte: since } }, select: { status: true } }),
      this.db.installation.findMany({ where: { shopId, status: 'CONFIRMED', confirmedAt: { gte: since } }, select: { checklistResultJson: true } }),
      this.db.shop.findUniqueOrThrow({ where: { id: shopId }, select: { avgResponseMinutes: true, ratingAvg: true, ratingCount: true, status: true, verificationStatus: true } }),
    ]);
    const responded = leads.filter((l) => l.firstResponseAt).map((l) => (l.firstResponseAt!.getTime() - l.sentAt.getTime()) / 60_000);
    const accepted = quotes.filter((q) => q.status === 'ACCEPTED').length;
    const clean = installs.filter((i) => !((i.checklistResultJson as Array<{ status: string }> | null) ?? []).some((a) => a.status === 'ISSUE')).length;
    const [products, branches, services, projects, certs] = await Promise.all([
      this.db.shopProduct.count({ where: { shopId, status: 'ACTIVE' } }),
      this.db.shopBranch.count({ where: { shopId, archivedAt: null } }),
      this.db.service.count({ where: { shopId, active: true } }),
      this.db.shopProject.count({ where: { shopId } }),
      this.db.shopCertification.count({ where: { shopId, status: 'APPROVED' } }),
    ]);
    return {
      shop,
      kpis: {
        views,
        newRequests: leads.length,
        waiting: waiting.length,
        quotesSent: quotes.length,
        selectionRate: quotes.length ? Math.round((accepted / quotes.length) * 100) / 100 : null,
        medianResponseMinutes: median(responded) === null ? null : Math.round(median(responded)!),
        cleanAcceptanceShare: installs.length ? Math.round((clean / installs.length) * 100) / 100 : null,
      },
      replyToday: waiting.map((w) => ({ id: w.id, sentAt: w.sentAt, status: w.status, number: w.request.number, systemType: w.request.systemType, requiredCapacityKw: w.request.requiredCapacityKw, regionCode: w.request.regionCode, customerFirstName: w.request.user.firstName, overdue: Date.now() - w.sentAt.getTime() > DAY })),
      profile: { products, branches, services, projects, certifications: certs },
    };
  }

  /** U12.1: navbatlar (har birida huquq kaliti — UI faqat ruxsat etilganlarini ko‘rsatadi). */
  async adminQueues() {
    const now = new Date();
    const today = new Date(`${tashkentDate()}T00:00:00Z`);
    const [models, reviews, complaints, disputes, ticketsOpen, ticketsBreaching, tariffsExpiring, rate] = await Promise.all([
      this.db.productModel.count({ where: { status: 'PENDING' } }),
      this.db.review.count({ where: { moderationStatus: 'PENDING' } }),
      this.db.complaint.count({ where: { status: 'OPEN' } }),
      this.db.installation.count({ where: { status: 'DISPUTED' } }),
      this.db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, firstRespondedAt: null, firstResponseDueAt: { lte: now } } }),
      this.db.tariffSchedule.count({ where: { status: 'PUBLISHED', effectiveUntil: { gte: today, lte: new Date(today.getTime() + 30 * DAY) } } }),
      this.db.exchangeRate.findFirst({ where: { currency: 'USD' }, orderBy: { rateDate: 'desc' }, select: { rateDate: true, rateToUzs: true } }),
    ]);
    return {
      queues: [
        { key: 'models', permission: 'CATALOG', count: models, to: '/admin/katalog' },
        { key: 'reviews', permission: 'REVIEWS', count: reviews, to: '/admin/sharhlar' },
        { key: 'complaints', permission: 'REVIEWS', count: complaints, to: '/admin/sharhlar' },
        { key: 'disputes', permission: 'REVIEWS', count: disputes, to: '/admin/sharhlar' },
        { key: 'support', permission: 'SUPPORT', count: ticketsOpen, breaching: ticketsBreaching, to: '/admin/yordam' },
        { key: 'tariffs', permission: 'TARIFFS', count: tariffsExpiring, to: '/admin/tariflar' },
      ],
      exchangeRate: rate ? { rateDate: rate.rateDate, rateToUzs: rate.rateToUzs, stale: today.getTime() - rate.rateDate.getTime() > 3 * DAY } : null,
    };
  }
}
