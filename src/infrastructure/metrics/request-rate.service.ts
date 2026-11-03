import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { loadJson, metricsFile, saveJson } from './metrics-store';

export type TrafficWindow = '1h' | '24h' | '7d' | '30d';

export interface TrafficBucket {
  /** ISO vaqt yorlig'i (bucket boshlanishi). */
  at: string;
  count: number;
  errors: number;
  /** 95-protsentil javob vaqti (ms); so‘rov bo‘lmasa null. */
  p95Ms: number | null;
}

export interface TrafficSummary {
  requests: number;
  perMinute: number;
  errors: number;
  errorRate: number;
  p95Ms: number | null;
  /** Oldingi shunday davr bilan solishtirish (ma’lumot bo‘lmasa null). */
  previous: { perMinute: number; errorRate: number; p95Ms: number | null } | null;
}

interface Bucket {
  n: number;
  err: number;
  /** Javob vaqti gistogrammasi (LATENCY_BOUNDS bo‘yicha). */
  lat: number[];
  /** Modul (birinchi yo‘l bo‘lagi) bo‘yicha so‘rovlar. */
  routes: Record<string, number>;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const KEEP_MINUTES = 180; // 1 soatlik ko‘rinish va oldingi soat bilan solishtirish
const KEEP_HOURS = 24 * 60; // 30 kun va oldingi 30 kun bilan solishtirish
const LATENCY_BOUNDS = [5, 10, 15, 25, 40, 60, 90, 130, 200, 300, 450, 700, 1000, 1600, 2500, 4000, Infinity];
const FILE = 'devops-traffic.json';
const MAX_ROUTES_PER_BUCKET = 40;

const newBucket = (): Bucket => ({ n: 0, err: 0, lat: new Array(LATENCY_BOUNDS.length).fill(0), routes: {} });

function percentile95(hist: number[]): number | null {
  const total = hist.reduce((sum, value) => sum + value, 0);
  if (total === 0) return null;
  const target = total * 0.95;
  let seen = 0;
  for (let i = 0; i < hist.length; i++) {
    const count = hist[i]!;
    if (seen + count >= target && count > 0) {
      const low = i === 0 ? 0 : LATENCY_BOUNDS[i - 1]!;
      const high = Number.isFinite(LATENCY_BOUNDS[i]!) ? LATENCY_BOUNDS[i]! : low * 1.5;
      return Math.round(low + ((target - seen) / count) * (high - low));
    }
    seen += count;
  }
  return null;
}

function merge(buckets: Array<Bucket | undefined>): Bucket {
  const out = newBucket();
  for (const bucket of buckets) {
    if (!bucket) continue;
    out.n += bucket.n;
    out.err += bucket.err;
    bucket.lat.forEach((value, i) => (out.lat[i]! += value));
    for (const [route, count] of Object.entries(bucket.routes)) out.routes[route] = (out.routes[route] ?? 0) + count;
  }
  return out;
}

/** Har bir API so'rovini xotirada (daqiqa/soat bo'yicha) hisoblab boradi: soni, 5xx xatolar, javob vaqti va eng ko‘p ishlatilgan modullar. Fayl orqali qayta ishga tushganda ham saqlanadi. */
@Injectable()
export class RequestRateService implements OnModuleInit, OnModuleDestroy {
  private readonly perMinute = new Map<number, Bucket>();
  private readonly perHour = new Map<number, Bucket>();
  private firstAt = Date.now();
  private timer: NodeJS.Timeout | null = null;

  onModuleInit(): void {
    const saved = loadJson<{ firstAt: number; minutes: Record<string, Bucket>; hours: Record<string, Bucket> }>(metricsFile(FILE));
    if (saved && saved.minutes && saved.hours) {
      for (const [key, bucket] of Object.entries(saved.minutes)) this.perMinute.set(Number(key), bucket);
      for (const [key, bucket] of Object.entries(saved.hours)) this.perHour.set(Number(key), bucket);
      if (Number.isFinite(saved.firstAt)) this.firstAt = saved.firstAt;
      this.prune();
    }
    this.timer = setInterval(() => this.persist(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.persist();
  }

  private persist(): void {
    saveJson(metricsFile(FILE), { firstAt: this.firstAt, minutes: Object.fromEntries(this.perMinute), hours: Object.fromEntries(this.perHour) });
  }

  record(info: { route?: string; status?: number; durationMs?: number } = {}): void {
    const now = Date.now();
    for (const [map, key] of [[this.perMinute, Math.floor(now / MINUTE_MS)], [this.perHour, Math.floor(now / HOUR_MS)]] as const) {
      let bucket = map.get(key);
      if (!bucket) {
        bucket = newBucket();
        map.set(key, bucket);
      }
      bucket.n += 1;
      if ((info.status ?? 0) >= 500) bucket.err += 1;
      if (info.durationMs !== undefined) {
        const index = LATENCY_BOUNDS.findIndex((bound) => info.durationMs! <= bound);
        bucket.lat[index === -1 ? LATENCY_BOUNDS.length - 1 : index]! += 1;
      }
      if (info.route && (info.route in bucket.routes || Object.keys(bucket.routes).length < MAX_ROUTES_PER_BUCKET)) {
        bucket.routes[info.route] = (bucket.routes[info.route] ?? 0) + 1;
      }
    }
    this.prune();
  }

  /** Oynadagi (joriy) bucket'lar: [boshlanish, oxir] oralig‘idagi har bir qadam uchun. */
  private slots(window: TrafficWindow, offset = 0): Array<{ at: number; bucket: Bucket }> {
    const now = Date.now();
    const out: Array<{ at: number; bucket: Bucket }> = [];
    if (window === '1h') {
      const current = Math.floor(now / MINUTE_MS) - offset * 60;
      for (let i = 59; i >= 0; i--) out.push({ at: (current - i) * MINUTE_MS, bucket: this.perMinute.get(current - i) ?? newBucket() });
      return out;
    }
    const hours = window === '24h' ? 24 : window === '7d' ? 168 : 720;
    const current = Math.floor(now / HOUR_MS) - offset * hours;
    const step = window === '30d' ? 6 : 1;
    for (let i = hours - step; i >= 0; i -= step) {
      const keys = Array.from({ length: step }, (_, k) => current - i - (step - 1) + k);
      out.push({ at: keys[0]! * HOUR_MS, bucket: merge(keys.map((key) => this.perHour.get(key))) });
    }
    return out;
  }

  series(window: TrafficWindow): TrafficBucket[] {
    return this.slots(window).map(({ at, bucket }) => ({ at: new Date(at).toISOString(), count: bucket.n, errors: bucket.err, p95Ms: percentile95(bucket.lat) }));
  }

  summary(window: TrafficWindow): TrafficSummary {
    const windowMinutes = window === '1h' ? 60 : window === '24h' ? 1440 : window === '7d' ? 10080 : 43200;
    // Yangi ishga tushgan bo‘lsa, o‘rtacha kamida 5 daqiqaga bo‘linadi (aks holda bir zumda yolg‘on yuqori ko‘rsatkich chiqadi).
    const coveredMinutes = Math.max(Math.min(5, windowMinutes), Math.min(windowMinutes, (Date.now() - this.firstAt) / MINUTE_MS));
    const stats = (offset: number, covered: number) => {
      const all = merge(this.slots(window, offset).map((slot) => slot.bucket));
      return { all, perMinute: Math.round((all.n / covered) * 10) / 10, errorRate: all.n ? Math.round((all.err / all.n) * 1000) / 10 : 0, p95Ms: percentile95(all.lat) };
    };
    const current = stats(0, coveredMinutes);
    // Oldingi davr faqat to‘liq yig‘ilgan bo‘lsa solishtiriladi.
    const hasPrevious = Date.now() - this.firstAt >= windowMinutes * MINUTE_MS * 1.5 && (window !== '1h' || this.perMinute.size > 0);
    const prev = hasPrevious ? stats(1, windowMinutes) : null;
    return {
      requests: current.all.n,
      perMinute: current.perMinute,
      errors: current.all.err,
      errorRate: current.errorRate,
      p95Ms: current.p95Ms,
      previous: prev ? { perMinute: prev.perMinute, errorRate: prev.errorRate, p95Ms: prev.p95Ms } : null,
    };
  }

  topEndpoints(window: TrafficWindow, limit = 6): Array<{ route: string; count: number; percent: number }> {
    const all = merge(this.slots(window).map((slot) => slot.bucket));
    // Monitoring so‘rovlari (eski saqlangan ma’lumotlarda ham) hisobga olinmaydi.
    delete all.routes['/api/health'];
    delete all.routes['/api/metrics'];
    const total = Object.values(all.routes).reduce((sum, value) => sum + value, 0);
    return Object.entries(all.routes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([route, count]) => ({ route, count, percent: total ? Math.round((count / total) * 1000) / 10 : 0 }));
  }

  private prune(): void {
    const now = Date.now();
    const minCutoff = Math.floor(now / MINUTE_MS) - KEEP_MINUTES;
    const hourCutoff = Math.floor(now / HOUR_MS) - KEEP_HOURS;
    for (const key of this.perMinute.keys()) if (key < minCutoff) this.perMinute.delete(key);
    for (const key of this.perHour.keys()) if (key < hourCutoff) this.perHour.delete(key);
  }
}
