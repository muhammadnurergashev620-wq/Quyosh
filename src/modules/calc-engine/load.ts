import { DAYS_IN_MONTH, HOUR_OF_DAY, HOURS, MONTH_OF_HOUR } from './hours';

/** TZ 7.5 LoadProfile: 12 oylik koeffitsient va 12×24 soatlik ulush (har oy yig‘indisi 1). */
export interface LoadProfile {
  code: string;
  monthlyFactors: number[];
  hourlyFactors: number[][];
}

export interface ApplianceItem {
  code?: string;
  powerW: number;
  count: number;
  hoursPerDay: number;
  /** 1..12; bo‘sh — butun yil. */
  months: number[];
  /** 24 ta ulush (yig‘indi 1); bo‘lmasa yuklama profilining soatlik ulushi. */
  hourlyUsage?: number[];
  isCritical?: boolean;
  isMotorLoad?: boolean;
  surgeFactor?: number;
}

export type ConsumptionInput =
  | { kind: 'MONTHLY_AVG'; kwh: number }
  | { kind: 'TWELVE_MONTHS'; months: number[] }
  | { kind: 'APPLIANCES'; items: ApplianceItem[]; templateCode?: string }
  /** So‘m bo‘yicha — tarifdan teskari hisoblangan oylik kWh (orkestratorda) MONTHLY_AVG ga aylantiriladi. */
  | { kind: 'BILL'; amount: number };

export type ConsumptionProvenance = 'USER_KWH' | 'USER_12_MONTHS' | 'FROM_BILL' | 'FROM_APPLIANCES';

/** Hisobga olinmagan mayda iste’mol (TZ 11.7). */
export const APPLIANCE_OVERHEAD = 1.1;

const normalize = (values: number[]) => {
  const sum = values.reduce((a, b) => a + b, 0);
  return sum > 0 ? values.map((v) => v / sum) : values.map(() => 1 / values.length);
};

/** Oylik kWh: o‘rtacha kiritilsa — monthlyFactors bilan, yillik yig‘indi = o‘rtacha × 12 bo‘ladigan qilib. */
export function monthlyFromAverage(avgKwh: number, profile: LoadProfile): number[] {
  const factors = normalize(profile.monthlyFactors);
  return factors.map((f) => avgKwh * 12 * f);
}

/** Oylik kWh → soatlik qator (har oyda kunlar teng, soatlar profil bo‘yicha). */
export function hourlyFromMonthly(monthly: number[], profile: LoadProfile): Float64Array {
  const out = new Float64Array(HOURS);
  const shares = profile.hourlyFactors.map(normalize);
  for (let t = 0; t < HOURS; t += 1) {
    const m = MONTH_OF_HOUR[t]!;
    out[t] = (monthly[m]! / DAYS_IN_MONTH[m]!) * shares[m]![HOUR_OF_DAY[t]!]!;
  }
  return out;
}

/** Maishiy texnika ro‘yxati → soatlik qator (TZ 11.7): power × count × hours, tanlangan oylarda, × 1,10. */
export function hourlyFromAppliances(items: ApplianceItem[], profile: LoadProfile): Float64Array {
  const out = new Float64Array(HOURS);
  for (const item of items) {
    const dailyKwh = (item.powerW * item.count * Math.min(item.hoursPerDay, 24)) / 1000;
    if (dailyKwh <= 0) continue;
    const usage = item.hourlyUsage?.length === 24 ? normalize(item.hourlyUsage) : null;
    for (let t = 0; t < HOURS; t += 1) {
      const m = MONTH_OF_HOUR[t]!;
      if (item.months.length && !item.months.includes(m + 1)) continue;
      const share = usage ? usage[HOUR_OF_DAY[t]!]! : normalize(profile.hourlyFactors[m]!)[HOUR_OF_DAY[t]!]!;
      out[t] += dailyKwh * share * APPLIANCE_OVERHEAD;
    }
  }
  return out;
}

/** Kunduzgi ulush (07:00–22:00) — kun/tun tarifida billdan teskari hisob uchun. */
export function dayShareOf(profile: LoadProfile, month: number, dayStart = 7, nightStart = 22): number {
  const shares = normalize(profile.hourlyFactors[month]!);
  return shares.reduce((sum, v, h) => (h >= dayStart && h < nightStart ? sum + v : sum), 0);
}
