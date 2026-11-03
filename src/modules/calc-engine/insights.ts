/** TZ 11.14: deterministik insight qoidalari. Oylar 1..12. */
export type InsightType = 'BEST_SAVING_MONTH' | 'LOWEST_GENERATION_MONTH' | 'PEAK_IMPORT_MONTH' | 'BATTERY_CRITICAL_MONTH' | 'SUMMER_SURPLUS';
export interface Insight { type: InsightType; month: number | null; value: number }

const argmax = (values: number[]) => values.reduce((best, value, index) => (value > values[best]! ? index : best), 0);
const argmin = (values: number[]) => values.reduce((best, value, index) => (value < values[best]! ? index : best), 0);

export function buildInsights(params: Parameters<typeof rawInsights>[0]): Insight[] {
  return rawInsights(params).map((item) => ({ ...item, value: Math.round(item.value * 100) / 100 }));
}

function rawInsights(params: { monthlySaving: number[]; monthlyGeneration: number[]; monthlyImport: number[]; monthlyExport: number[]; monthlyNightLoad: number[]; batteryKwh: number; hasBattery: boolean }): Insight[] {
  const out: Insight[] = [];
  if (params.monthlySaving.some((v) => v > 0)) {
    const m = argmax(params.monthlySaving);
    out.push({ type: 'BEST_SAVING_MONTH', month: m + 1, value: params.monthlySaving[m]! });
  }
  const maxGen = Math.max(...params.monthlyGeneration);
  if (maxGen > 0) {
    const m = argmin(params.monthlyGeneration);
    const minGen = params.monthlyGeneration[m]!;
    const ratio = minGen > 0 ? maxGen / minGen : Infinity;
    if (ratio >= 1.5) out.push({ type: 'LOWEST_GENERATION_MONTH', month: m + 1, value: minGen });
  }
  if (params.monthlyImport.some((v) => v > 0)) {
    const m = argmax(params.monthlyImport);
    out.push({ type: 'PEAK_IMPORT_MONTH', month: m + 1, value: params.monthlyImport[m]! });
  }
  if (params.hasBattery && params.batteryKwh > 0) {
    const ratios = params.monthlyNightLoad.map((load) => load / params.batteryKwh);
    const m = argmax(ratios);
    out.push({ type: 'BATTERY_CRITICAL_MONTH', month: m + 1, value: ratios[m]! });
  }
  const annualExport = params.monthlyExport.reduce((a, b) => a + b, 0);
  if (annualExport > 0) {
    const summer = params.monthlyExport[5]! + params.monthlyExport[6]! + params.monthlyExport[7]!;
    if (summer / annualExport >= 0.4) out.push({ type: 'SUMMER_SURPLUS', month: null, value: summer / annualExport });
  }
  return out;
}
