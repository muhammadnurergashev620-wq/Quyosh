import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

/** Admin boshqaruv paneli (TZ U12.1). Navbat kartalari modellar qo‘shilgan sari (sharh, shikoyat, murojaat) to‘ldiriladi. */
@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService) {}

  async getDashboard(query: DashboardQueryDto) {
    const range = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
    const createdAt = Object.keys(range).length ? range : undefined;
    const [users, newUsers, shops] = await Promise.all([
      this.db.user.count({ where: { deletedAt: null, status: { not: UserStatus.DELETED } } }),
      this.db.user.count({ where: { deletedAt: null, createdAt } }),
      this.db.shop.count({ where: { archivedAt: null } }),
    ]);
    return { users: { total: users, new: newUsers }, shops: { total: shops } };
  }

  /**
   * Boshqaruv paneli uchun kengaytirilgan ko‘rinish: davr (7–90 kun) bo‘yicha KPI (oldingi davr bilan solishtirib),
   * kunlik seriyalar (Toshkent vaqti), holat taqsimotlari va taklif narxi/quvvati nuqtalari.
   */
  async getOverview(daysInput?: number) {
    const days = Math.min(90, Math.max(7, Math.floor(daysInput ?? 30)));
    const DAY = 86_400_000;
    const now = new Date();
    const since = new Date(now.getTime() - days * DAY);
    const prevSince = new Date(since.getTime() - days * DAY);
    const period = { gte: since };
    const prev = { gte: prevSince, lt: since };

    const labels: string[] = [];
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' });
    for (let i = days - 1; i >= 0; i--) labels.push(fmt.format(new Date(now.getTime() - i * DAY)));
    const daily = async (table: 'users' | 'calculations' | 'quote_requests' | 'quotes' | 'installations' | 'reviews' | 'support_tickets'): Promise<number[]> => {
      const rows = await this.db.$queryRaw<Array<{ d: string; c: number }>>(
        Prisma.sql`SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD') AS d, count(*)::int AS c FROM ${Prisma.raw(`"${table}"`)} WHERE "createdAt" >= ${since} GROUP BY 1`,
      );
      const map = new Map(rows.map((row) => [row.d, Number(row.c)]));
      return labels.map((label) => map.get(label) ?? 0);
    };
    const grouped = async <T extends string>(rows: Promise<Array<{ key: T | null; count: number }>>) => Object.fromEntries((await rows).map((row) => [row.key ?? 'NONE', row.count]));

    const userWhere = { deletedAt: null, status: { not: UserStatus.DELETED } } as const;
    const [
      users, usersNew, usersPrev, shops, shopsActive, calcs, calcsNew, calcsPrev, requests, requestsNew, requestsPrev, quotes, quotesNew, quotesPrev,
      installs, installsNew, installsPrev, reviews, reviewAvg, ticketsOpen, ticketsNew,
      sUsers, sCalcs, sRequests, sQuotes, sInstalls, sReviews, sTickets,
      roles, shopStatus, requestStatus, installStatus, quoteStatus, calcType, requestRegion, ratingDist, quotePoints,
    ] = await Promise.all([
      this.db.user.count({ where: userWhere }),
      this.db.user.count({ where: { ...userWhere, createdAt: period } }),
      this.db.user.count({ where: { ...userWhere, createdAt: prev } }),
      this.db.shop.count({ where: { archivedAt: null } }),
      this.db.shop.count({ where: { archivedAt: null, status: 'ACTIVE' } }),
      this.db.calculation.count(),
      this.db.calculation.count({ where: { createdAt: period } }),
      this.db.calculation.count({ where: { createdAt: prev } }),
      this.db.quoteRequest.count(),
      this.db.quoteRequest.count({ where: { createdAt: period } }),
      this.db.quoteRequest.count({ where: { createdAt: prev } }),
      this.db.quote.count({ where: { status: { not: 'DRAFT' } } }),
      this.db.quote.count({ where: { status: { not: 'DRAFT' }, createdAt: period } }),
      this.db.quote.count({ where: { status: { not: 'DRAFT' }, createdAt: prev } }),
      this.db.installation.count(),
      this.db.installation.count({ where: { createdAt: period } }),
      this.db.installation.count({ where: { createdAt: prev } }),
      this.db.review.count({ where: { moderationStatus: 'PUBLISHED' } }),
      this.db.review.aggregate({ where: { moderationStatus: 'PUBLISHED' }, _avg: { rating: true } }),
      this.db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] } } }),
      this.db.supportTicket.count({ where: { createdAt: period } }),
      daily('users'), daily('calculations'), daily('quote_requests'), daily('quotes'), daily('installations'), daily('reviews'), daily('support_tickets'),
      grouped(this.db.userRole.groupBy({ by: ['role'], _count: { _all: true }, where: { user: userWhere } }).then((rows) => rows.map((row) => ({ key: row.role as string, count: row._count._all })))),
      grouped(this.db.shop.groupBy({ by: ['status'], _count: { _all: true }, where: { archivedAt: null } }).then((rows) => rows.map((row) => ({ key: row.status as string, count: row._count._all })))),
      grouped(this.db.quoteRequest.groupBy({ by: ['status'], _count: { _all: true } }).then((rows) => rows.map((row) => ({ key: row.status as string, count: row._count._all })))),
      grouped(this.db.installation.groupBy({ by: ['status'], _count: { _all: true } }).then((rows) => rows.map((row) => ({ key: row.status as string, count: row._count._all })))),
      grouped(this.db.quote.groupBy({ by: ['status'], _count: { _all: true }, where: { status: { not: 'DRAFT' } } }).then((rows) => rows.map((row) => ({ key: row.status as string, count: row._count._all })))),
      grouped(this.db.calculation.groupBy({ by: ['systemType'], _count: { _all: true } }).then((rows) => rows.map((row) => ({ key: row.systemType as string, count: row._count._all })))),
      this.db.quoteRequest.groupBy({ by: ['regionCode'], _count: { _all: true }, orderBy: { _count: { regionCode: 'desc' } }, take: 8 }).then((rows) => rows.map((row) => ({ region: row.regionCode ?? 'NONE', count: row._count._all }))),
      this.db.review.groupBy({ by: ['rating'], _count: { id: true }, where: { moderationStatus: 'PUBLISHED' } }).then((rows) => rows.map((row) => ({ rating: row.rating, count: row._count.id }))),
      this.db.quote.findMany({ where: { status: { not: 'DRAFT' }, systemPowerKw: { not: null }, total: { gt: 0 } }, orderBy: { createdAt: 'desc' }, take: 80, select: { systemPowerKw: true, total: true, status: true } }),
    ]);

    const delta = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
    return {
      days,
      labels,
      kpis: {
        users: { total: users, period: usersNew, delta: delta(usersNew, usersPrev) },
        shops: { total: shops, active: shopsActive },
        calculations: { total: calcs, period: calcsNew, delta: delta(calcsNew, calcsPrev) },
        requests: { total: requests, period: requestsNew, delta: delta(requestsNew, requestsPrev) },
        quotes: { total: quotes, period: quotesNew, delta: delta(quotesNew, quotesPrev) },
        installations: { total: installs, period: installsNew, delta: delta(installsNew, installsPrev) },
        reviews: { total: reviews, avg: reviewAvg._avg.rating ? Math.round(reviewAvg._avg.rating * 10) / 10 : null },
        tickets: { open: ticketsOpen, period: ticketsNew },
      },
      series: { users: sUsers, calculations: sCalcs, requests: sRequests, quotes: sQuotes, installations: sInstalls, reviews: sReviews, tickets: sTickets },
      distributions: { roles, shopStatus, requestStatus, installStatus, quoteStatus, calcType, requestRegion, ratingDist },
      quotePoints: quotePoints.map((row) => ({ kw: Number(row.systemPowerKw), total: Number(row.total), status: row.status })),
    };
  }
}
