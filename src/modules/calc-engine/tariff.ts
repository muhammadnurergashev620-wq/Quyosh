import { HOUR_OF_DAY, HOURS, MONTH_OF_HOUR } from './hours';

/** TZ 11.8: tarif tuzilmasi (TariffSchedule + TariffTier + TouPeriod). Pul — so‘m. */
export type TouPeriod = 'ALL' | 'DAY' | 'NIGHT';

export interface TariffTier {
  /** 1..12; bo‘sh — butun yil. */
  seasonMonths: number[];
  touPeriod: TouPeriod;
  minKwh: number;
  /** null — chegarasiz. Oraliq [min, max). */
  maxKwh: number | null;
  ratePerKwh: number;
}

export interface Tariff {
  id?: string;
  version?: number;
  fixedChargeMonthly: number;
  touEnabled: boolean;
  tiers: TariffTier[];
  /** Kun/tun: [startHour, endHour) mahalliy vaqt, yarim tundan o‘tishi mumkin (22→6). */
  touPeriods: Array<{ touPeriod: 'DAY' | 'NIGHT'; startHour: number; endHour: number }>;
}

export type KwhByTou = Partial<Record<TouPeriod, number>>;

const inRange = (hour: number, start: number, end: number) => (start <= end ? hour >= start && hour < end : hour >= start || hour < end);

/** Soat qaysi TOU davriga tegishli. TOU o‘chiq bo‘lsa — ALL. Davrlar qamramagan soat — DAY. */
export function touOfHour(tariff: Tariff, hour: number): TouPeriod {
  if (!tariff.touEnabled) return 'ALL';
  for (const period of tariff.touPeriods) if (inRange(hour, period.startHour, period.endHour)) return period.touPeriod;
  return 'DAY';
}

/** Oyma-oy, TOU bo‘yicha kWh (soatlik qatordan). month — 0..11. */
export function splitByTou(tariff: Tariff, series: ArrayLike<number>): KwhByTou[] {
  const out: KwhByTou[] = Array.from({ length: 12 }, () => ({}));
  const touByHour = Array.from({ length: 24 }, (_, h) => touOfHour(tariff, h));
  for (let t = 0; t < HOURS; t += 1) {
    const bucket = out[MONTH_OF_HOUR[t]!]!;
    const tou = touByHour[HOUR_OF_DAY[t]!]!;
    bucket[tou] = (bucket[tou] ?? 0) + series[t]!;
  }
  return out;
}

/**
 * Oylik to‘lov (TZ 11.8.2): qat’iy to‘lov + har TOU davri uchun pog‘onalar kumulyativ.
 * month — 0..11. Pog‘ona: min(max(kWh − min, 0), max − min) × rate.
 */
export function billMonth(tariff: Tariff, kwh: KwhByTou, month: number, rateFactor = 1): number {
  let bill = tariff.fixedChargeMonthly;
  for (const [tou, amount] of Object.entries(kwh) as Array<[TouPeriod, number]>) {
    if (!amount || amount <= 0) continue;
    const tiers = tariff.tiers.filter((tier) => tier.touPeriod === tou && (tier.seasonMonths.length === 0 || tier.seasonMonths.includes(month + 1)));
    for (const tier of tiers) {
      const width = tier.maxKwh === null ? Infinity : tier.maxKwh - tier.minKwh;
      bill += Math.min(Math.max(amount - tier.minKwh, 0), width) * tier.ratePerKwh * rateFactor;
    }
  }
  return bill;
}

/**
 * Billdan kWh ni teskari hisoblash (TZ 11.8.3): billMonth monoton o‘suvchi — binar qidiruv 0..100 000 kWh, 0,1 kWh aniqlik.
 * dayShare — kun/tun tarifida LoadProfile bo‘yicha kunduzgi ulush.
 */
export function kwhFromBill(tariff: Tariff, amount: number, month: number, dayShare = 1): number | null {
  const split = (kwh: number): KwhByTou => (tariff.touEnabled ? { DAY: kwh * dayShare, NIGHT: kwh * (1 - dayShare) } : { ALL: kwh });
  if (amount <= tariff.fixedChargeMonthly) return 0;
  if (billMonth(tariff, split(100_000), month) < amount) return null;
  let lo = 0;
  let hi = 100_000;
  while (hi - lo > 0.1) {
    const mid = (lo + hi) / 2;
    if (billMonth(tariff, split(mid), month) < amount) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}
