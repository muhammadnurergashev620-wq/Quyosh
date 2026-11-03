import { DAYS_IN_MONTH, HOUR_OF_DAY, HOURS, MONTH_OF_HOUR } from './hours';
import type { ApplianceItem } from './load';
import type { SystemType } from './sizing';

export interface OutageInput {
  systemType: SystemType;
  criticalItems: ApplianceItem[];
  batteryKwh: number;
  socMin: number;
  socMax: number;
  roundTripEfficiency: number;
  inverterKw: number;
  /** Datasheet bo‘lsa; aks holda inverterKw × 2. */
  inverterSurgeKw?: number | null;
  defaultSurgeFactor?: number;
  /** Soatlik AC ishlab chiqarish (kunduzgi zaxira uchun), bo‘lmasa kunduz ham faqat akkumulyator. */
  acGeneration?: ArrayLike<number>;
}

export interface OutageMonth { month: number; backupHoursNight: number | null; dayUnlimited: boolean; backupHoursDay: number | null }

export interface OutageResult {
  applicable: boolean;
  criticalLoadKw: number;
  peakStartKw: number;
  usableBatteryKwh: number;
  backupHoursNight: number | null;
  backupHoursDay: number | null;
  dayUnlimited: boolean;
  inverterOk: boolean;
  inverterSurgeKw: number;
  months: OutageMonth[];
  warnings: string[];
}

/** TZ 11.12. ON_GRID — zaxira yo‘q (raqam sifatida 0 ko‘rsatilmaydi: applicable=false). */
export function outage(input: OutageInput): OutageResult {
  const surgeDefault = input.defaultSurgeFactor ?? 3;
  const criticalLoadKw = input.criticalItems.reduce((sum, item) => sum + item.powerW * item.count, 0) / 1000;
  const peakStartKw = input.criticalItems.reduce((sum, item) => sum + item.powerW * item.count * (item.isMotorLoad ? (item.surgeFactor ?? surgeDefault) : 1), 0) / 1000;
  const inverterSurgeKw = input.inverterSurgeKw ?? input.inverterKw * 2;
  const warnings: string[] = [];
  if (input.systemType === 'ON_GRID') {
    warnings.push('ON_GRID_NO_BACKUP');
    return { applicable: false, criticalLoadKw, peakStartKw, usableBatteryKwh: 0, backupHoursNight: null, backupHoursDay: null, dayUnlimited: false, inverterOk: false, inverterSurgeKw, months: [], warnings };
  }
  const eta = Math.sqrt(input.roundTripEfficiency);
  const usable = input.batteryKwh * (input.socMax - input.socMin) * eta;
  const inverterOk = input.inverterKw >= criticalLoadKw && inverterSurgeKw >= peakStartKw;
  if (!inverterOk) warnings.push('INVERTER_TOO_SMALL');
  const night = criticalLoadKw > 0 ? usable / criticalLoadKw : null;

  // Kunduzgi (09:00–17:00) o‘rtacha quyosh quvvati — oyma-oy.
  const daySum = new Array<number>(12).fill(0);
  if (input.acGeneration) for (let t = 0; t < HOURS; t += 1) { const h = HOUR_OF_DAY[t]!; if (h >= 9 && h < 17) daySum[MONTH_OF_HOUR[t]!] += input.acGeneration[t]!; }
  const months: OutageMonth[] = daySum.map((sum, m) => {
    const avgSolarKw = sum / (DAYS_IN_MONTH[m]! * 8);
    const unlimited = criticalLoadKw > 0 && avgSolarKw >= criticalLoadKw;
    const dayHours = criticalLoadKw > 0 ? (unlimited ? null : usable / (criticalLoadKw - avgSolarKw)) : null;
    return { month: m + 1, backupHoursNight: night, dayUnlimited: unlimited, backupHoursDay: dayHours };
  });
  const yearAvgSolar = daySum.reduce((a, b) => a + b, 0) / (365 * 8);
  const dayUnlimited = criticalLoadKw > 0 && yearAvgSolar >= criticalLoadKw;
  return {
    applicable: true,
    criticalLoadKw,
    peakStartKw,
    usableBatteryKwh: usable,
    backupHoursNight: night,
    backupHoursDay: criticalLoadKw > 0 ? (dayUnlimited ? null : usable / (criticalLoadKw - yearAvgSolar)) : null,
    dayUnlimited,
    inverterOk,
    inverterSurgeKw,
    months,
    warnings,
  };
}
