import { computeBills, production, simulateBalance, type BalanceResult, type BatterySpec, type BillResult, type ExportRule, type Losses } from './balance';
import { lifetime, loanSchedule, simplePayback, type LifetimeResult, type LoanResult, type PaymentType } from './finance';
import { HOUR_OF_DAY, HOURS, MONTH_OF_HOUR, round, sumByDay, sumByMonth, sumByWeek, total } from './hours';
import { buildInsights, type Insight } from './insights';
import { dayShareOf, hourlyFromAppliances, hourlyFromMonthly, monthlyFromAverage, type ApplianceItem, type ConsumptionInput, type ConsumptionProvenance, type LoadProfile } from './load';
import { outage, type OutageResult } from './outage';
import { chooseInverterKw, DEFAULT_PANEL, maxPanelsForArea, recommendBatteryKwh, recommendSize, type LimitingFactor, type PanelSpec, type SizingOption, type SystemType } from './sizing';
import { kwhFromBill, type Tariff } from './tariff';

export const MODEL_VERSION = 'calc-1.0.0';

/** CalculationSettings.parametersJson (TZ 7.5) — admin versiyalaydi; bular dvigatelning standart qiymatlari. */
export interface CalcSettings {
  systemLoss: number;
  soilingLoss: number;
  shading: Record<'NONE' | 'LIGHT' | 'HEAVY', number>;
  dcAcRatio: number;
  panelDegradation: number;
  discountRate: number;
  tariffGrowth: number;
  opexPctOfCapex: number;
  opexGrowth: number;
  co2KgPerKwh: number;
  inverterReplacementYear: number;
  inverterReplacementFactor: number;
  batteryReplacementFactor: number;
  batteryRoundTrip: number;
  batterySocMin: number;
  batterySocMax: number;
  batteryCycles: number;
  batteryCRate: number;
  tMin: number;
  tMaxCell: number;
  surgeFactor: number;
  lifetimeYears: number;
  autonomyDays: number;
  backupHoursDefault: number;
  flatTiltDeg: number;
  scenarios: Record<'low' | 'high', { yield: number; loss: number; tariffGrowth: number }>;
  defaultCosts: { panelPerKwp: number; installationPerKwp: number; inverterPerKw: number; batteryPerKwh: number; deliveryFixed: number };
  quickAreaPresets: Record<'SMALL' | 'MEDIUM' | 'LARGE', number>;
}

export const DEFAULT_SETTINGS: CalcSettings = {
  systemLoss: 0.08,
  soilingLoss: 0.04,
  shading: { NONE: 0, LIGHT: 0.07, HEAVY: 0.18 },
  dcAcRatio: 1.2,
  panelDegradation: 0.005,
  discountRate: 0.14,
  tariffGrowth: 0.1,
  opexPctOfCapex: 0.01,
  opexGrowth: 0.08,
  co2KgPerKwh: 0.47,
  inverterReplacementYear: 12,
  inverterReplacementFactor: 0.8,
  batteryReplacementFactor: 0.8,
  batteryRoundTrip: 0.9,
  batterySocMin: 0.1,
  batterySocMax: 1,
  batteryCycles: 6000,
  batteryCRate: 0.5,
  tMin: -15,
  tMaxCell: 70,
  surgeFactor: 3,
  lifetimeYears: 25,
  autonomyDays: 1.5,
  backupHoursDefault: 4,
  flatTiltDeg: 25,
  scenarios: { low: { yield: -0.1, loss: 0.03, tariffGrowth: -0.02 }, high: { yield: 0.05, loss: -0.02, tariffGrowth: 0.02 } },
  defaultCosts: { panelPerKwp: 5_500_000, installationPerKwp: 1_200_000, inverterPerKw: 1_600_000, batteryPerKwh: 3_800_000, deliveryFixed: 300_000 },
  quickAreaPresets: { SMALL: 20, MEDIUM: 40, LARGE: 80 },
};

export type ProductionMethod = 'A_PV_YIELD' | 'B_IRRADIANCE' | 'DEFAULT';
export type CostProvenance = 'QUOTE' | 'CATALOG_MEDIAN' | 'SETTINGS_DEFAULT' | 'USER';

export interface EngineInput {
  systemType: SystemType;
  latitude: number;
  consumption: ConsumptionInput;
  /** Maydon (obyekt yoki Tez hisob preseti). null — maydon cheklovi yo‘q. */
  area: { roofShape: 'FLAT' | 'PITCHED'; usableAreaM2: number; projectedAreaM2?: number; surfaceAreaM2?: number } | null;
  shadingLevel: 'NONE' | 'LIGHT' | 'HEAVY';
  panel?: PanelSpec;
  /** Foydalanuvchi tanlagan quvvat (variantlardan); bo‘lmasa tavsiya. */
  kwp?: number | null;
  inverterKw?: number | null;
  batteryKwh?: number | null;
  budget?: number | null;
  criticalItems?: ApplianceItem[];
  backupHours?: number | null;
  /** Mijoz o‘zgartirgan tarif o‘sishi (TZ 11.10). */
  tariffGrowth?: number | null;
  costs?: Partial<{ equipmentCost: number; installationCost: number; deliveryCost: number; otherCost: number }> | null;
  financing?: { annualRate: number; termMonths: number; paymentType: PaymentType; downPayment: number; oneTimeFeePct?: number; monthlyFee?: number; allowedTerms?: number[] } | null;
}

export interface EngineData {
  settings: CalcSettings;
  /** 1 kWp mahalliy soatlik AC/DC qatori, yo‘qotishlarsiz (provider loss=0). */
  yield1kWp: ArrayLike<number>;
  productionMethod: ProductionMethod;
  loadProfile: LoadProfile;
  tariff: Tariff | null;
  exportRule: ExportRule | null;
  gridMaxKw: number | null;
  priceBook?: Partial<CalcSettings['defaultCosts']> & { source?: CostProvenance };
}

interface ScenarioParams { yieldScale: number; lossDelta: number; tariffGrowth: number }

export interface ScenarioSummary {
  annualGenerationKwh: number;
  saving: number | null;
  exportIncome: number | null;
  simplePaybackYears: number | null;
  npv: number | null;
  irr: number | null;
  assumptions: { yieldDelta: number; lossDelta: number; tariffGrowth: number };
}

export interface EngineResult {
  modelVersion: string;
  status: 'OK' | 'TARIFF_NOT_FOUND';
  systemType: SystemType;
  systemPowerKw: number;
  panelCountEstimate: number;
  panel: PanelSpec;
  inverterKw: number;
  batteryKwh: number;
  projectedAreaM2: number | null;
  surfaceAreaM2: number | null;
  usableAreaM2: number | null;
  limitingFactor: LimitingFactor;
  sizingOptions: SizingOption[];
  generation: { daily: number[]; weekly: number[]; monthly: number[]; annual: number; specificYield: number };
  clippingLossKwh: number;
  curtailmentKwh: number;
  load: { monthly: number[]; annual: number; provenance: ConsumptionProvenance };
  energy: { selfConsumedKwh: number; batteryThroughputKwh: number; gridImportKwh: number; gridExportKwh: number; monthlyImport: number[]; monthlyExport: number[]; selfSufficiency: number };
  money: {
    billWithoutSolar: number | null;
    billWithSolar: number | null;
    savings: number | null;
    monthlySavings: number[] | null;
    monthlyBillWithout: number[] | null;
    monthlyBillWith: number[] | null;
    exportIncome: { status: 'VERIFIED' | 'UNVERIFIED' | 'NOT_APPLICABLE'; value: number | null; exportKwh: number };
    annualOpex: number;
    initialCost: number;
    costBreakdown: { equipment: number; installation: number; delivery: number; other: number };
    costProvenance: CostProvenance;
    simplePaybackYears: number | null;
    paybackUnavailableReason: 'NON_POSITIVE_BENEFIT' | 'TARIFF_NOT_FOUND' | null;
  };
  lifetime: (Omit<LifetimeResult, 'years'> & { years: LifetimeResult['years'] }) | null;
  financing: LoanResult | null;
  outage: OutageResult | null;
  /** «Quyosh kuni» grafigi (U8.10): 4 mavsum oyining o‘rtacha soatlik ishlab chiqarish va iste’moli (kWh). */
  typicalDays: Array<{ month: number; generation: number[]; load: number[] }>;
  insights: Insight[];
  scenarios: { low: ScenarioSummary; base: ScenarioSummary; high: ScenarioSummary };
  productionMethod: ProductionMethod;
  assumptions: string[];
  warnings: string[];
}

function loadSeries(input: EngineInput, data: EngineData, warnings: string[]): { hourly: Float64Array; provenance: ConsumptionProvenance } {
  const c = input.consumption;
  switch (c.kind) {
    case 'MONTHLY_AVG':
      return { hourly: hourlyFromMonthly(monthlyFromAverage(c.kwh, data.loadProfile), data.loadProfile), provenance: 'USER_KWH' };
    case 'TWELVE_MONTHS':
      return { hourly: hourlyFromMonthly(c.months.slice(0, 12), data.loadProfile), provenance: 'USER_12_MONTHS' };
    case 'APPLIANCES':
      return { hourly: hourlyFromAppliances(c.items, data.loadProfile), provenance: 'FROM_APPLIANCES' };
    case 'BILL': {
      if (!data.tariff) {
        warnings.push('TARIFF_NOT_FOUND');
        return { hourly: new Float64Array(HOURS), provenance: 'FROM_BILL' };
      }
      // O‘rtacha oylik summa → har oy uchun teskari hisob; o‘rtacha kWh MONTHLY_AVG kabi taqsimlanadi.
      const months = Array.from({ length: 12 }, (_, m) => kwhFromBill(data.tariff!, c.amount, m, dayShareOf(data.loadProfile, m)) ?? 0);
      const avg = months.reduce((a, b) => a + b, 0) / 12;
      return { hourly: hourlyFromMonthly(monthlyFromAverage(avg, data.loadProfile), data.loadProfile), provenance: 'FROM_BILL' };
    }
  }
}

interface YearRun { balance: BalanceResult; bills: BillResult | null; clipping: number; gen: Float64Array; ac: Float64Array }

/**
 * TZ 11 to‘liq hisob. Deterministik: bir xil kirish va ma’lumot — bir xil natija.
 */
export function estimate(input: EngineInput, data: EngineData): EngineResult {
  const s = data.settings;
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const panel = input.panel ?? DEFAULT_PANEL;
  if (!input.panel) assumptions.push('DEFAULT_PANEL');
  if (data.productionMethod === 'DEFAULT') warnings.push('SOLAR_PROVIDER_UNAVAILABLE_REGION_AVERAGE');

  const { hourly: load, provenance } = loadSeries(input, data, warnings);
  const monthlyLoad = sumByMonth(load);
  const annualLoad = total(load);

  const baseLosses: Losses = { shading: s.shading[input.shadingLevel], system: s.systemLoss, soiling: s.soilingLoss };
  const lossFactor = (1 - baseLosses.shading) * (1 - baseLosses.system) * (1 - baseLosses.soiling);
  const yieldMonthly = sumByMonth(data.yield1kWp).map((v) => v * lossFactor);
  const specificYield = yieldMonthly.reduce((a, b) => a + b, 0);

  const exportCompensated = !!data.exportRule && data.exportRule.verified && data.exportRule.compensationType !== 'NONE';
  const maxPanels = input.area ? maxPanelsForArea({ roofShape: input.area.roofShape, usableAreaM2: input.area.usableAreaM2 }, panel, input.latitude, s.flatTiltDeg) : null;
  const pricePerKwp = (data.priceBook?.panelPerKwp ?? s.defaultCosts.panelPerKwp) + (data.priceBook?.installationPerKwp ?? s.defaultCosts.installationPerKwp) + (data.priceBook?.inverterPerKw ?? s.defaultCosts.inverterPerKw) / s.dcAcRatio;
  const sizing = recommendSize({
    systemType: input.systemType,
    annualLoadKwh: annualLoad,
    monthlyLoadKwh: monthlyLoad,
    specificYieldKwhPerKwp: specificYield,
    monthlySpecificYield: yieldMonthly,
    exportCompensated,
    maxPanelsByArea: maxPanels,
    gridMaxKw: data.gridMaxKw,
    dcAcRatio: s.dcAcRatio,
    budget: input.budget ?? null,
    pricePerKwp,
    panel,
  });
  const panelCount = input.kwp ? Math.max(1, Math.floor((input.kwp * 1000) / panel.powerW + 1e-9)) : sizing.panelCount;
  const kwp = (panelCount * panel.powerW) / 1000;
  if (maxPanels !== null && panelCount > maxPanels) warnings.push('AREA_EXCEEDED');

  // Akkumulyator va invertor (TZ 11.5)
  const critical = input.criticalItems ?? [];
  const criticalKw = critical.reduce((sum, item) => sum + item.powerW * item.count, 0) / 1000;
  const peakStartKw = critical.reduce((sum, item) => sum + item.powerW * item.count * (item.isMotorLoad ? (item.surgeFactor ?? s.surgeFactor) : 1), 0) / 1000;
  const nightLoadPerDay = (() => {
    let sum = 0;
    for (let t = 0; t < HOURS; t += 1) { const h = HOUR_OF_DAY[t]!; if (h >= 18 || h < 7) sum += load[t]!; }
    return sum / 365;
  })();
  const usableDod = s.batterySocMax - s.batterySocMin;
  const batteryKwh = input.systemType === 'ON_GRID' ? 0 : input.batteryKwh ?? recommendBatteryKwh({
    systemType: input.systemType,
    usableDod,
    efficiency: s.batteryRoundTrip,
    criticalLoadKw: criticalKw || undefined,
    backupHours: criticalKw ? input.backupHours ?? s.backupHoursDefault : undefined,
    nightLoadKwhPerDay: nightLoadPerDay,
    dailyLoadKwh: annualLoad / 365,
    autonomyDays: s.autonomyDays,
  });
  const inverterKw = input.inverterKw ?? chooseInverterKw(kwp, s.dcAcRatio, input.systemType === 'ON_GRID' ? 0 : peakStartKw / 2);
  const battery: BatterySpec | null = batteryKwh > 0 ? { capacityKwh: batteryKwh, maxPowerKw: Math.max(batteryKwh * s.batteryCRate, Math.min(inverterKw, batteryKwh)), roundTripEfficiency: s.batteryRoundTrip, socMin: s.batterySocMin, socMax: s.batterySocMax } : null;

  // Xarajatlar (TZ 11.10)
  const prices = { ...s.defaultCosts, ...data.priceBook };
  const costProvenance: CostProvenance = input.costs ? 'USER' : (data.priceBook?.source ?? 'SETTINGS_DEFAULT');
  const equipment = input.costs?.equipmentCost ?? kwp * prices.panelPerKwp + inverterKw * prices.inverterPerKw + batteryKwh * prices.batteryPerKwh;
  const installation = input.costs?.installationCost ?? kwp * prices.installationPerKwp;
  const delivery = input.costs?.deliveryCost ?? prices.deliveryFixed;
  const other = input.costs?.otherCost ?? 0;
  const initialCost = equipment + installation + delivery + other;
  const opex1 = initialCost * s.opexPctOfCapex;
  if (costProvenance !== 'USER' && costProvenance !== 'QUOTE') assumptions.push('ESTIMATED_COSTS');

  const runYear = (params: ScenarioParams, year: number): YearRun => {
    const losses: Losses = { shading: baseLosses.shading, system: Math.min(0.9, Math.max(0, baseLosses.system + params.lossDelta)), soiling: baseLosses.soiling };
    const degradation = (1 - (panel.degradationPctPerYear !== undefined ? panel.degradationPctPerYear / 100 : s.panelDegradation)) ** (year - 1);
    const prod = production(data.yield1kWp, kwp, inverterKw, losses, params.yieldScale * degradation);
    const balance = simulateBalance(prod.ac, load, input.systemType, battery);
    const bills = data.tariff ? computeBills(data.tariff, load, balance, data.exportRule, kwp, (1 + params.tariffGrowth) ** (year - 1)) : null;
    return { balance, bills, clipping: prod.clippingKwh, gen: prod.gen, ac: prod.ac };
  };

  const runScenario = (params: ScenarioParams) => {
    const first = runYear(params, 1);
    const perYear: Array<{ productionKwh: number; saving: number; exportIncome: number }> = [];
    const years = data.tariff ? s.lifetimeYears : 0;
    const throughput = first.balance.totals.discharge;
    for (let y = 1; y <= years; y += 1) {
      const run = y === 1 ? first : runYear(params, y);
      perYear.push({ productionKwh: run.balance.totals.generation, saving: run.bills!.saving, exportIncome: run.bills!.exportStatus === 'VERIFIED' ? run.bills!.exportIncome : 0 });
    }
    const replacements: Array<{ year: number; cost: number }> = [];
    if (s.inverterReplacementYear <= s.lifetimeYears) replacements.push({ year: s.inverterReplacementYear, cost: inverterKw * prices.inverterPerKw * s.inverterReplacementFactor });
    if (battery) {
      const cyclesPerYear = throughput / Math.max(battery.capacityKwh * usableDod, 1e-9);
      const replaceYear = cyclesPerYear > 0 ? Math.ceil(s.batteryCycles / cyclesPerYear) : Infinity;
      for (let y = replaceYear; y <= s.lifetimeYears; y += replaceYear) replacements.push({ year: y, cost: batteryKwh * prices.batteryPerKwh * s.batteryReplacementFactor });
      const calendarYear = 15;
      if (replaceYear > s.lifetimeYears && calendarYear <= s.lifetimeYears) replacements.push({ year: calendarYear, cost: batteryKwh * prices.batteryPerKwh * s.batteryReplacementFactor });
    }
    const life = data.tariff ? lifetime({ years: s.lifetimeYears, initialCost, perYear, opex1, opexGrowth: s.opexGrowth, discountRate: s.discountRate, replacements, co2KgPerKwh: s.co2KgPerKwh }) : null;
    return { first, life };
  };

  const growth = input.tariffGrowth ?? s.tariffGrowth;
  const base = runScenario({ yieldScale: 1, lossDelta: 0, tariffGrowth: growth });
  const low = runScenario({ yieldScale: 1 + s.scenarios.low.yield, lossDelta: s.scenarios.low.loss, tariffGrowth: growth + s.scenarios.low.tariffGrowth });
  const high = runScenario({ yieldScale: 1 + s.scenarios.high.yield, lossDelta: s.scenarios.high.loss, tariffGrowth: growth + s.scenarios.high.tariffGrowth });

  const b = base.first;
  if (b.balance.invariantViolations > 0) warnings.push('BALANCE_INVARIANT_VIOLATION');
  const bills = b.bills;
  if (!bills) warnings.push('TARIFF_NOT_FOUND');
  bills?.warnings.forEach((w) => warnings.push(w));

  const exportIncomeValue = bills && bills.exportStatus === 'VERIFIED' ? bills.exportIncome : null;
  const annualNetBenefit = bills ? bills.saving + (exportIncomeValue ?? 0) - opex1 : 0;
  const payback = bills ? simplePayback(initialCost, annualNetBenefit) : { years: null, unavailableReason: 'TARIFF_NOT_FOUND' as const };

  const summarize = (run: ReturnType<typeof runScenario>, params: { yieldDelta: number; lossDelta: number; tariffGrowth: number }): ScenarioSummary => {
    const scBills = run.first.bills;
    const scExport = scBills && scBills.exportStatus === 'VERIFIED' ? scBills.exportIncome : null;
    return {
      annualGenerationKwh: round(run.first.balance.totals.generation),
      saving: scBills ? round(scBills.saving) : null,
      exportIncome: scExport === null ? null : round(scExport),
      simplePaybackYears: scBills ? ((v) => (v === null ? null : round(v, 1)))(simplePayback(initialCost, scBills.saving + (scExport ?? 0) - opex1).years) : null,
      npv: run.life ? round(run.life.npv) : null,
      irr: run.life?.irr == null ? null : round(run.life.irr, 4),
      assumptions: params,
    };
  };

  const monthlyGeneration = sumByMonth(b.ac);
  const monthlyImport = sumByMonth(b.balance.gridImport);
  const monthlyExport = sumByMonth(b.balance.gridExport);
  const nightLoadMonthly = new Array<number>(12).fill(0);
  for (let t = 0; t < HOURS; t += 1) { const h = HOUR_OF_DAY[t]!; if (h >= 18 || h < 7) nightLoadMonthly[MONTH_OF_HOUR[t]!] += load[t]!; }

  const outageResult = critical.length || input.systemType !== 'ON_GRID'
    ? outage({ systemType: input.systemType, criticalItems: critical, batteryKwh, socMin: s.batterySocMin, socMax: s.batterySocMax, roundTripEfficiency: s.batteryRoundTrip, inverterKw, defaultSurgeFactor: s.surgeFactor, acGeneration: b.ac })
    : null;

  const financing = input.financing
    ? loanSchedule({ initialCost, downPayment: input.financing.downPayment, annualRate: input.financing.annualRate, termMonths: input.financing.termMonths, paymentType: input.financing.paymentType, oneTimeFeePct: input.financing.oneTimeFeePct, monthlyFee: input.financing.monthlyFee, monthlySaving: bills?.monthlySaving, allowedTerms: input.financing.allowedTerms })
    : null;

  const r2 = (values: number[]) => values.map((v) => round(v));
  return {
    modelVersion: MODEL_VERSION,
    status: bills ? 'OK' : 'TARIFF_NOT_FOUND',
    systemType: input.systemType,
    systemPowerKw: round(kwp, 3),
    panelCountEstimate: panelCount,
    panel,
    inverterKw,
    batteryKwh,
    projectedAreaM2: input.area?.projectedAreaM2 ?? null,
    surfaceAreaM2: input.area?.surfaceAreaM2 ?? null,
    usableAreaM2: input.area?.usableAreaM2 ?? null,
    limitingFactor: input.kwp ? 'CONSUMPTION' : sizing.limitingFactor,
    sizingOptions: sizing.options.map((option) => ({ ...option, kwp: round(option.kwp, 3) })),
    generation: { daily: r2(sumByDay(b.ac)), weekly: r2(sumByWeek(b.ac)), monthly: r2(monthlyGeneration), annual: round(b.balance.totals.generation), specificYield: round(kwp > 0 ? b.balance.totals.generation / kwp : 0) },
    clippingLossKwh: round(b.clipping),
    curtailmentKwh: round(b.balance.totals.curtailment),
    load: { monthly: r2(monthlyLoad), annual: round(annualLoad), provenance },
    energy: {
      selfConsumedKwh: round(b.balance.totals.selfConsumed),
      batteryThroughputKwh: round(b.balance.totals.discharge),
      gridImportKwh: round(b.balance.totals.gridImport),
      gridExportKwh: round(b.balance.totals.gridExport),
      monthlyImport: r2(monthlyImport),
      monthlyExport: r2(monthlyExport),
      selfSufficiency: annualLoad > 0 ? round(b.balance.totals.selfConsumed / annualLoad, 4) : 0,
    },
    money: {
      billWithoutSolar: bills ? round(bills.billWithoutSolar) : null,
      billWithSolar: bills ? round(bills.billWithSolar) : null,
      savings: bills ? round(bills.saving) : null,
      monthlySavings: bills ? r2(bills.monthlySaving) : null,
      monthlyBillWithout: bills ? r2(bills.monthlyWithout) : null,
      monthlyBillWith: bills ? r2(bills.monthlyWith) : null,
      exportIncome: { status: bills?.exportStatus ?? 'NOT_APPLICABLE', value: exportIncomeValue === null ? null : round(exportIncomeValue), exportKwh: round(b.balance.totals.gridExport) },
      annualOpex: round(opex1),
      initialCost: round(initialCost),
      costBreakdown: { equipment: round(equipment), installation: round(installation), delivery: round(delivery), other: round(other) },
      costProvenance,
      simplePaybackYears: payback.years === null ? null : round(payback.years, 1),
      paybackUnavailableReason: payback.unavailableReason,
    },
    lifetime: base.life ? { ...base.life, irr: base.life.irr === null ? null : round(base.life.irr, 4), npv: round(base.life.npv), lcoe: base.life.lcoe === null ? null : round(base.life.lcoe), co2Kg: round(base.life.co2Kg), years: base.life.years.map((y) => ({ ...y, productionKwh: round(y.productionKwh), saving: round(y.saving), exportIncome: round(y.exportIncome), opex: round(y.opex), replacement: round(y.replacement), cashFlow: round(y.cashFlow), cumulative: round(y.cumulative), discountedCumulative: round(y.discountedCumulative) })) } : null,
    financing,
    outage: outageResult,
    typicalDays: [0, 3, 6, 9].map((m) => {
      const gen = new Array<number>(24).fill(0);
      const use = new Array<number>(24).fill(0);
      let days = 0;
      for (let t = 0; t < HOURS; t += 1) {
        if (MONTH_OF_HOUR[t] !== m) continue;
        const h = HOUR_OF_DAY[t]!;
        gen[h] += b.ac[t]!;
        use[h] += load[t]!;
        if (h === 0) days += 1;
      }
      return { month: m + 1, generation: gen.map((v) => round(v / days, 3)), load: use.map((v) => round(v / days, 3)) };
    }),
    insights: buildInsights({ monthlySaving: bills?.monthlySaving ?? new Array(12).fill(0), monthlyGeneration, monthlyImport, monthlyExport, monthlyNightLoad: nightLoadMonthly, batteryKwh, hasBattery: input.systemType !== 'ON_GRID' && batteryKwh > 0 }),
    scenarios: {
      low: summarize(low, { yieldDelta: s.scenarios.low.yield, lossDelta: s.scenarios.low.loss, tariffGrowth: growth + s.scenarios.low.tariffGrowth }),
      base: summarize(base, { yieldDelta: 0, lossDelta: 0, tariffGrowth: growth }),
      high: summarize(high, { yieldDelta: s.scenarios.high.yield, lossDelta: s.scenarios.high.loss, tariffGrowth: growth + s.scenarios.high.tariffGrowth }),
    },
    productionMethod: data.productionMethod,
    assumptions,
    warnings: [...new Set(warnings)],
  };
}
