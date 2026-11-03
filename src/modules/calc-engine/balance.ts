import { HOURS, MONTH_OF_HOUR } from './hours';
import type { SystemType } from './sizing';
import { billMonth, splitByTou, type KwhByTou, type Tariff } from './tariff';

export interface Losses {
  /** Soya: NONE/LIGHT/HEAVY → 0 / 0,07 / 0,18 (settings). */
  shading: number;
  system: number;
  soiling: number;
}

/**
 * TZ 11.6: E_gen = kWp × yield1kWp × (1 − soya) × (1 − tizim) × (1 − chang); E_ac = min(E_gen, inverterKw × 1h).
 * Har yo‘qotish bir marta qo‘llanadi. yieldScale — ssenariy va degradatsiya koeffitsienti.
 */
export function production(yield1kWp: ArrayLike<number>, kwp: number, inverterKw: number, losses: Losses, yieldScale = 1) {
  const gen = new Float64Array(HOURS);
  const ac = new Float64Array(HOURS);
  const factor = kwp * (1 - losses.shading) * (1 - losses.system) * (1 - losses.soiling) * yieldScale;
  let clipping = 0;
  for (let t = 0; t < HOURS; t += 1) {
    const value = Math.max(0, yield1kWp[t]! * factor);
    gen[t] = value;
    ac[t] = Math.min(value, inverterKw);
    clipping += value - ac[t]!;
  }
  return { gen, ac, clippingKwh: clipping };
}

export interface BatterySpec {
  capacityKwh: number;
  maxPowerKw: number;
  roundTripEfficiency: number;
  socMin: number;
  socMax: number;
}

export interface BalanceResult {
  direct: Float64Array;
  charge: Float64Array;
  discharge: Float64Array;
  gridImport: Float64Array;
  gridExport: Float64Array;
  curtailment: Float64Array;
  soc: Float64Array;
  totals: { generation: number; load: number; direct: number; charge: number; discharge: number; gridImport: number; gridExport: number; curtailment: number; selfConsumed: number };
  /** Invariant buzilgan soatlar soni (0 bo‘lishi shart — testlarda tekshiriladi). */
  invariantViolations: number;
}

const EPS = 1e-6;

/**
 * TZ 11.9: soatlik balans. Akkumulyator faqat quyoshdan zaryadlanadi (tarmoqdan emas), boshlang‘ich SOC 50 %,
 * η_c = η_d = √(round-trip). OFF_GRID da ortiqcha — curtailment, eksport 0.
 */
export function simulateBalance(acGen: ArrayLike<number>, load: ArrayLike<number>, systemType: SystemType, battery: BatterySpec | null): BalanceResult {
  const direct = new Float64Array(HOURS);
  const charge = new Float64Array(HOURS);
  const discharge = new Float64Array(HOURS);
  const gridImport = new Float64Array(HOURS);
  const gridExport = new Float64Array(HOURS);
  const curtailment = new Float64Array(HOURS);
  const soc = new Float64Array(HOURS);
  const hasBattery = !!battery && battery.capacityKwh > 0 && systemType !== 'ON_GRID';
  const C = hasBattery ? battery!.capacityKwh : 0;
  const eta = hasBattery ? Math.sqrt(battery!.roundTripEfficiency) : 1;
  let state = hasBattery ? Math.min(Math.max(0.5, battery!.socMin), battery!.socMax) : 0;
  let violations = 0;
  const totals = { generation: 0, load: 0, direct: 0, charge: 0, discharge: 0, gridImport: 0, gridExport: 0, curtailment: 0, selfConsumed: 0 };

  for (let t = 0; t < HOURS; t += 1) {
    const e = Math.max(0, acGen[t]!);
    const l = Math.max(0, load[t]!);
    const d = Math.min(e, l);
    const surplus = e - d;
    const deficit = l - d;
    let c = 0;
    let dis = 0;
    if (hasBattery) {
      c = Math.max(0, Math.min(surplus, battery!.maxPowerKw, ((battery!.socMax - state) * C) / eta));
      dis = Math.max(0, Math.min(deficit, battery!.maxPowerKw, (state - battery!.socMin) * C * eta));
      state = state + (c * eta - dis / eta) / C;
    }
    const excess = surplus - c;
    direct[t] = d;
    charge[t] = c;
    discharge[t] = dis;
    gridImport[t] = deficit - dis;
    if (systemType === 'OFF_GRID') curtailment[t] = excess;
    else gridExport[t] = excess;
    soc[t] = state;
    if (Math.abs(e - (d + c + gridExport[t]! + curtailment[t]!)) > EPS || Math.abs(l - (d + dis + gridImport[t]!)) > EPS || (hasBattery && (state < battery!.socMin - EPS || state > battery!.socMax + EPS))) violations += 1;
    totals.generation += e;
    totals.load += l;
    totals.direct += d;
    totals.charge += c;
    totals.discharge += dis;
    totals.gridImport += gridImport[t]!;
    totals.gridExport += gridExport[t]!;
    totals.curtailment += curtailment[t]!;
  }
  totals.selfConsumed = totals.direct + totals.discharge;
  return { direct, charge, discharge, gridImport, gridExport, curtailment, soc, totals, invariantViolations: violations };
}

export type CompensationType = 'NONE' | 'NET_METERING' | 'NET_BILLING' | 'FEED_IN';

export interface ExportRule {
  id?: string;
  version?: number;
  compensationType: CompensationType;
  ratePerKwh: number | null;
  settlementPeriod: 'MONTH' | 'YEAR';
  maxSystemKw: number | null;
  verified: boolean;
}

export type ExportStatus = 'VERIFIED' | 'UNVERIFIED' | 'NOT_APPLICABLE';

export interface BillResult {
  monthlyWithout: number[];
  monthlyWith: number[];
  monthlySaving: number[];
  billWithoutSolar: number;
  billWithSolar: number;
  saving: number;
  exportIncome: number;
  exportStatus: ExportStatus;
  netImportMonthly: number[];
  warnings: string[];
}

const sumTou = (value: KwhByTou) => (value.ALL ?? 0) + (value.DAY ?? 0) + (value.NIGHT ?? 0);

/** NET_METERING: netlangan kWh ni TOU davrlariga proporsional taqsimlash. */
function scaleTou(value: KwhByTou, target: number): KwhByTou {
  const total = sumTou(value);
  if (total <= 0 || target <= 0) return {};
  const k = target / total;
  return Object.fromEntries(Object.entries(value).map(([key, kwh]) => [key, (kwh ?? 0) * k])) as KwhByTou;
}

/**
 * TZ 11.8.2 + 11.9: to‘lovlar va eksport kompensatsiyasi. rateFactor — tarif o‘sishi (25 yillik model uchun).
 * Tasdiqlanmagan qoida yoki maxSystemKw dan katta tizim — eksport puli hisoblanmaydi.
 */
export function computeBills(tariff: Tariff, load: ArrayLike<number>, balance: BalanceResult, rule: ExportRule | null, systemKw: number, rateFactor = 1): BillResult {
  const warnings: string[] = [];
  const loadTou = splitByTou(tariff, load);
  const importTou = splitByTou(tariff, balance.gridImport);
  const exportMonthly = new Array<number>(12).fill(0);
  for (let t = 0; t < HOURS; t += 1) exportMonthly[MONTH_OF_HOUR[t]!] += balance.gridExport[t]!;

  let compensation: CompensationType = 'NONE';
  let exportStatus: ExportStatus = 'NOT_APPLICABLE';
  if (rule && rule.compensationType !== 'NONE') {
    if (!rule.verified) exportStatus = 'UNVERIFIED';
    else if (rule.maxSystemKw !== null && systemKw > rule.maxSystemKw) {
      exportStatus = 'NOT_APPLICABLE';
      warnings.push('EXPORT_RULE_SYSTEM_TOO_LARGE');
    } else {
      exportStatus = 'VERIFIED';
      compensation = rule.compensationType;
    }
  } else if (balance.totals.gridExport > 0) exportStatus = 'UNVERIFIED';

  const monthlyWithout: number[] = [];
  const monthlyWith: number[] = [];
  const netImportMonthly: number[] = [];
  let carry = 0;
  let exportIncome = 0;
  for (let m = 0; m < 12; m += 1) {
    monthlyWithout.push(billMonth(tariff, loadTou[m]!, m, rateFactor));
    let importKwh = importTou[m]!;
    if (compensation === 'NET_METERING') {
      const imported = sumTou(importKwh);
      const credit = exportMonthly[m]! + carry;
      const net = Math.max(imported - credit, 0);
      carry = Math.max(credit - imported, 0);
      importKwh = scaleTou(importKwh, net);
      if (rule!.settlementPeriod === 'MONTH') carry = 0;
    } else if (compensation === 'NET_BILLING' || compensation === 'FEED_IN') {
      exportIncome += exportMonthly[m]! * (rule!.ratePerKwh ?? 0) * rateFactor;
    }
    netImportMonthly.push(sumTou(importKwh));
    monthlyWith.push(billMonth(tariff, importKwh, m, rateFactor));
  }
  const billWithoutSolar = monthlyWithout.reduce((a, b) => a + b, 0);
  const billWithSolar = monthlyWith.reduce((a, b) => a + b, 0);
  return {
    monthlyWithout,
    monthlyWith,
    monthlySaving: monthlyWithout.map((value, m) => value - monthlyWith[m]!),
    billWithoutSolar,
    billWithSolar,
    saving: billWithoutSolar - billWithSolar,
    exportIncome,
    exportStatus,
    netImportMonthly,
    warnings,
  };
}
