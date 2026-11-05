import type { DashboardOverview } from './types';

/** «Namuna ko‘rinish»: ma’lumot kam bo‘lganda dashboard to‘lganda qanday ko‘rinishini ko‘rsatadi (faqat brauzerda, bazaga tegmaydi). */
export function demoOverview(days: number): DashboardOverview {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const wave = (base: number, amp: number, trend = 0) =>
    Array.from({ length: days }, (_, i) => Math.max(0, Math.round(base + trend * i + Math.sin(i / 3.2) * amp + (rnd() - 0.5) * amp * 0.9)));
  const labels = Array.from({ length: days }, (_, i) => new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const users = wave(14, 6, 0.25);
  const calculations = wave(48, 16, 0.6);
  const requests = wave(11, 5, 0.18);
  const quotes = wave(17, 7, 0.25);
  const installations = wave(4, 2, 0.06);
  const reviews = wave(3, 2, 0.04);
  const tickets = wave(6, 3);
  const regions = ['toshkent-shahri', 'samarqand', 'fargona', 'andijon', 'buxoro', 'namangan', 'qashqadaryo', 'xorazm'];
  const points = Array.from({ length: 48 }, () => {
    const kw = Math.round((2 + rnd() * 28) * 10) / 10;
    return { kw, total: Math.round(kw * (9_000_000 + rnd() * 5_500_000)), status: rnd() > 0.7 ? 'ACCEPTED' : 'SENT' };
  });
  return {
    days,
    labels,
    kpis: {
      users: { total: 1284, period: sum(users), delta: 18 },
      shops: { total: 63, active: 54 },
      calculations: { total: 9420, period: sum(calculations), delta: 24 },
      requests: { total: 1750, period: sum(requests), delta: 9 },
      quotes: { total: 4260, period: sum(quotes), delta: 13 },
      installations: { total: 392, period: sum(installations), delta: -4 },
      reviews: { total: 214, avg: 4.6 },
      tickets: { open: 17, period: sum(tickets) },
    },
    series: { users, calculations, requests, quotes, installations, reviews, tickets },
    distributions: {
      roles: { CUSTOMER: 1190, SHOP: 88, ADMIN: 6 },
      shopStatus: { ACTIVE: 54, PENDING_REVIEW: 5, SUSPENDED: 2, DRAFT: 2 },
      requestStatus: { OPEN: 420, CLOSED_SELECTED: 780, CLOSED_NO_SELECTION: 210, EXPIRED: 240, CANCELLED: 100 },
      installStatus: { AGREED: 46, SITE_VISIT_SCHEDULED: 38, INSTALLATION_SCHEDULED: 52, INSTALLED: 30, CONFIRMED: 214, DISPUTED: 6, CANCELLED: 6 },
      quoteStatus: { SENT: 900, VIEWED: 1100, ACCEPTED: 392, REJECTED: 800, EXPIRED: 700, WITHDRAWN: 368 },
      calcType: { ON_GRID: 6100, HYBRID: 2800, OFF_GRID: 520 },
      requestRegion: regions.map((region, i) => ({ region, count: Math.round(430 / (i + 1.4)) })),
      ratingDist: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: [4, 6, 18, 62, 124][rating - 1]! })),
    },
    quotePoints: points,
  };
}
