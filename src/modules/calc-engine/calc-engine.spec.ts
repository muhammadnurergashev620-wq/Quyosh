import { describe, expect, it } from 'vitest';
import {
  billMonth, checkCompatibility, chooseInverterKw, computeBills, DEFAULT_SETTINGS, estimate, HOURS, irr, kwhFromBill, loanSchedule, maxPanelsForArea, MONTH_OF_HOUR,
  HOUR_OF_DAY, outage, pvSeriesFromIrradiance, recommendBatteryKwh, seriesFromMonthlyYield, simulateBalance, splitByTou, sumByMonth, total, utcToLocal,
  type EngineData, type EngineInput, type ExportRule, type LoadProfile, type Tariff,
} from './index';

// ───────── Fiksturalar ─────────

const flatProfile: LoadProfile = { code: 'FLAT', monthlyFactors: new Array(12).fill(1), hourlyFactors: Array.from({ length: 12 }, () => new Array(24).fill(1 / 24)) };

/** Pog‘onali tarif: [0,200) — 600, [200,∞) — 1000 so‘m/kWh. */
const tiered: Tariff = {
  fixedChargeMonthly: 0,
  touEnabled: false,
  touPeriods: [],
  tiers: [
    { seasonMonths: [], touPeriod: 'ALL', minKwh: 0, maxKwh: 200, ratePerKwh: 600 },
    { seasonMonths: [], touPeriod: 'ALL', minKwh: 200, maxKwh: null, ratePerKwh: 1000 },
  ],
};

/** Toshkentga yaqin 1 kWp qatori (≈1500 kWh/kWp/yil, yo‘qotishlarsiz) — DEFAULT usuli bilan sintetik. */
const TASHKENT_MONTHLY = [70, 85, 120, 145, 175, 190, 200, 190, 160, 125, 80, 60];
const yield1kWp = seriesFromMonthlyYield(TASHKENT_MONTHLY, 41.3, 69.24);

const data = (over: Partial<EngineData> = {}): EngineData => ({
  settings: DEFAULT_SETTINGS,
  yield1kWp,
  productionMethod: 'DEFAULT',
  loadProfile: flatProfile,
  tariff: tiered,
  exportRule: null,
  gridMaxKw: null,
  ...over,
});

const input = (over: Partial<EngineInput> = {}): EngineInput => ({
  systemType: 'ON_GRID',
  latitude: 41.3,
  consumption: { kind: 'MONTHLY_AVG', kwh: 400 },
  area: null,
  shadingLevel: 'NONE',
  ...over,
});

// ───────── Testlar (TZ 17.1) ─────────

describe('time axis', () => {
  it('has 8760 hours and maps Jan 31 23:00 → January, Feb 1 02:00 → February (Asia/Tashkent)', () => {
    expect(HOURS).toBe(8760);
    const jan31_23 = 30 * 24 + 23;
    const feb1_02 = 31 * 24 + 2;
    expect(MONTH_OF_HOUR[jan31_23]).toBe(0);
    expect(MONTH_OF_HOUR[feb1_02]).toBe(1);
    expect(HOUR_OF_DAY[feb1_02]).toBe(2);
  });

  it('shifts UTC provider series by +5 h: Jan 31 18:00 UTC → January, 19:00 UTC → February', () => {
    const at = (utcIndex: number) => {
      const utc = new Float64Array(HOURS);
      utc[utcIndex] = 1;
      const index = utcToLocal(utc).findIndex((v) => v === 1);
      return { month: MONTH_OF_HOUR[index], hour: HOUR_OF_DAY[index] };
    };
    expect(at(30 * 24 + 18)).toEqual({ month: 0, hour: 23 });
    expect(at(30 * 24 + 19)).toEqual({ month: 1, hour: 0 });
  });
});

describe('tariff engine (TZ 11.8)', () => {
  it('puts boundary kWh into the correct tier [min, max)', () => {
    expect(billMonth(tiered, { ALL: 200 }, 0)).toBe(200 * 600);
    expect(billMonth(tiered, { ALL: 201 }, 0)).toBe(200 * 600 + 1000);
    expect(billMonth(tiered, { ALL: 0 }, 0)).toBe(0);
  });

  it('applies seasonal tiers only in their months and the fixed charge', () => {
    const seasonal: Tariff = { ...tiered, fixedChargeMonthly: 5000, tiers: [{ seasonMonths: [6, 7, 8], touPeriod: 'ALL', minKwh: 0, maxKwh: null, ratePerKwh: 800 }, { seasonMonths: [1, 2, 3, 4, 5, 9, 10, 11, 12], touPeriod: 'ALL', minKwh: 0, maxKwh: null, ratePerKwh: 700 }] };
    expect(billMonth(seasonal, { ALL: 100 }, 6)).toBe(5000 + 80000);
    expect(billMonth(seasonal, { ALL: 100 }, 0)).toBe(5000 + 70000);
  });

  it('splits day/night by TOU periods across midnight', () => {
    const tou: Tariff = { fixedChargeMonthly: 0, touEnabled: true, touPeriods: [{ touPeriod: 'NIGHT', startHour: 22, endHour: 6 }], tiers: [{ seasonMonths: [], touPeriod: 'DAY', minKwh: 0, maxKwh: null, ratePerKwh: 1000 }, { seasonMonths: [], touPeriod: 'NIGHT', minKwh: 0, maxKwh: null, ratePerKwh: 500 }] };
    const series = new Float64Array(HOURS).fill(1);
    const january = splitByTou(tou, series)[0]!;
    expect(january.NIGHT).toBe(31 * 8);
    expect(january.DAY).toBe(31 * 16);
  });

  it('inverts a bill to kWh by binary search (0.1 kWh)', () => {
    const bill = billMonth(tiered, { ALL: 350.4 }, 0);
    expect(kwhFromBill(tiered, bill, 0)).toBeCloseTo(350.4, 1);
  });

  it('never invents a tariff: missing tariff → TARIFF_NOT_FOUND, money blocks unavailable', () => {
    const result = estimate(input(), data({ tariff: null }));
    expect(result.status).toBe('TARIFF_NOT_FOUND');
    expect(result.money.savings).toBeNull();
    expect(result.money.simplePaybackYears).toBeNull();
    expect(result.money.paybackUnavailableReason).toBe('TARIFF_NOT_FOUND');
    expect(result.lifetime).toBeNull();
  });
});

describe('energy balance (TZ 11.9)', () => {
  const load = new Float64Array(HOURS).fill(0.5);
  const gen = new Float64Array(HOURS);
  for (let t = 0; t < HOURS; t += 1) gen[t] = HOUR_OF_DAY[t]! >= 9 && HOUR_OF_DAY[t]! < 16 ? 3 : 0;
  const battery = { capacityKwh: 10, maxPowerKw: 5, roundTripEfficiency: 0.9, socMin: 0.1, socMax: 1 };

  it('keeps hourly invariants and SOC within limits (HYBRID)', () => {
    const result = simulateBalance(gen, load, 'HYBRID', battery);
    expect(result.invariantViolations).toBe(0);
    expect(Math.min(...result.soc)).toBeGreaterThanOrEqual(0.1 - 1e-9);
    expect(Math.max(...result.soc)).toBeLessThanOrEqual(1 + 1e-9);
    expect(result.totals.discharge).toBeGreaterThan(0);
  });

  it('curtails instead of exporting off-grid', () => {
    const result = simulateBalance(gen, load, 'OFF_GRID', battery);
    expect(result.totals.gridExport).toBe(0);
    expect(result.totals.curtailment).toBeGreaterThan(0);
    expect(result.invariantViolations).toBe(0);
  });

  it('zero generation → zero saving and zero export income', () => {
    const zero = estimate(input(), data({ yield1kWp: new Float64Array(HOURS) }));
    expect(zero.generation.annual).toBe(0);
    expect(zero.money.savings).toBe(0);
    expect(zero.money.exportIncome.value ?? 0).toBe(0);
  });

  it('unverified export rule shows export kWh but no income', () => {
    const rule: ExportRule = { compensationType: 'FEED_IN', ratePerKwh: 500, settlementPeriod: 'MONTH', maxSystemKw: null, verified: false };
    const result = estimate(input({ kwp: 10 }), data({ exportRule: rule }));
    expect(result.energy.gridExportKwh).toBeGreaterThan(0);
    expect(result.money.exportIncome).toMatchObject({ status: 'UNVERIFIED', value: null });
  });

  it('net metering carries surplus month to month and resets at period end', () => {
    // Yanvar: 100 kWh ortiqcha eksport; fevral: 150 kWh import → 50 netlangan.
    const loadSeries = new Float64Array(HOURS);
    const gridImport = new Float64Array(HOURS);
    const gridExport = new Float64Array(HOURS);
    gridExport[10] = 100;
    gridImport[31 * 24 + 10] = 150;
    loadSeries[31 * 24 + 10] = 150;
    const balance = { direct: new Float64Array(HOURS), charge: new Float64Array(HOURS), discharge: new Float64Array(HOURS), gridImport, gridExport, curtailment: new Float64Array(HOURS), soc: new Float64Array(HOURS), totals: { generation: 100, load: 150, direct: 0, charge: 0, discharge: 0, gridImport: 150, gridExport: 100, curtailment: 0, selfConsumed: 0 }, invariantViolations: 0 };
    const flat: Tariff = { ...tiered, tiers: [{ seasonMonths: [], touPeriod: 'ALL', minKwh: 0, maxKwh: null, ratePerKwh: 1000 }] };
    const yearly = computeBills(flat, loadSeries, balance, { compensationType: 'NET_METERING', ratePerKwh: null, settlementPeriod: 'YEAR', maxSystemKw: null, verified: true }, 5);
    expect(yearly.netImportMonthly[1]).toBe(50);
    expect(yearly.monthlyWith[1]).toBe(50_000);
    const monthly = computeBills(flat, loadSeries, balance, { compensationType: 'NET_METERING', ratePerKwh: null, settlementPeriod: 'MONTH', maxSystemKw: null, verified: true }, 5);
    expect(monthly.netImportMonthly[1]).toBe(150);
  });
});

describe('sizing (TZ 11.3–11.5)', () => {
  it('pitched roof: floor(usable / panelArea × 0.9)', () => {
    const panelArea = 2.278 * 1.134;
    expect(maxPanelsForArea({ roofShape: 'PITCHED', usableAreaM2: 50 }, { powerW: 550, widthMm: 1134, heightMm: 2278 }, 41.3)).toBe(Math.floor((50 / panelArea) * 0.9));
  });

  it('chooses the next standard inverter size', () => {
    expect(chooseInverterKw(6.6, 1.2)).toBe(6);
    expect(chooseInverterKw(7.2, 1.2)).toBe(6);
    expect(chooseInverterKw(7.3, 1.2)).toBe(8);
  });

  it('rounds battery up to 2.5 kWh steps', () => {
    expect(recommendBatteryKwh({ systemType: 'HYBRID', usableDod: 0.9, efficiency: 0.9, criticalLoadKw: 0.5, backupHours: 4 })).toBe(2.5);
    expect(recommendBatteryKwh({ systemType: 'ON_GRID', usableDod: 0.9, efficiency: 0.9 })).toBe(0);
  });

  it('reports the limiting factor and three options', () => {
    const result = estimate(input({ area: { roofShape: 'PITCHED', usableAreaM2: 12 } }), data());
    expect(result.limitingFactor).toBe('AREA');
    const wide = estimate(input(), data());
    expect(wide.limitingFactor).toBe('CONSUMPTION');
    expect(wide.sizingOptions.map((o) => o.key)).toEqual(['ECONOMY', 'BALANCED']);
  });
});

describe('finance (TZ 11.10–11.11)', () => {
  it('annuity matches the bank formula to 1 so‘m', () => {
    const loan = loanSchedule({ initialCost: 60_000_000, downPayment: 0, annualRate: 0.24, termMonths: 24, paymentType: 'ANNUITY' });
    const r = 0.02;
    const expected = (60_000_000 * r) / (1 - (1 + r) ** -24);
    expect(Math.abs(loan.firstPayment - expected)).toBeLessThan(1);
    expect(loan.schedule[23]!.balance).toBeCloseTo(0, 2);
  });

  it('0 % rate splits evenly', () => {
    const loan = loanSchedule({ initialCost: 12_000_000, downPayment: 0, annualRate: 0, termMonths: 12, paymentType: 'ANNUITY' });
    expect(loan.firstPayment).toBe(1_000_000);
    expect(loan.totalInterest).toBe(0);
  });

  it('differentiated payments sum to loan + interest', () => {
    const loan = loanSchedule({ initialCost: 30_000_000, downPayment: 6_000_000, annualRate: 0.2, termMonths: 18, paymentType: 'DIFFERENTIATED' });
    const paid = loan.schedule.reduce((sum, row) => sum + row.payment, 0);
    expect(paid).toBeCloseTo(loan.financedAmount + loan.totalInterest, 6);
    expect(loan.firstPayment).toBeGreaterThan(loan.lastPayment);
  });

  it('IRR solves NPV = 0', () => {
    const flows = [-1000, 300, 300, 300, 300, 300];
    const rate = irr(flows)!;
    const npv = flows.reduce((sum, cf, y) => sum + cf / (1 + rate) ** y, 0);
    expect(Math.abs(npv)).toBeLessThan(1e-4);
    expect(irr([-1, -1])).toBeNull();
  });

  it('non-positive net benefit never shows a positive payback', () => {
    const cheapPower: Tariff = { ...tiered, tiers: [{ seasonMonths: [], touPeriod: 'ALL', minKwh: 0, maxKwh: null, ratePerKwh: 1 }] };
    const result = estimate(input({ kwp: 5 }), data({ tariff: cheapPower }));
    expect(result.money.simplePaybackYears).toBeNull();
    expect(result.money.paybackUnavailableReason).toBe('NON_POSITIVE_BENEFIT');
  });

  it('25-year model degrades production and computes NPV/LCOE', () => {
    const result = estimate(input({ kwp: 5 }), data());
    const years = result.lifetime!.years;
    expect(years).toHaveLength(25);
    expect(years[1]!.productionKwh).toBeLessThan(years[0]!.productionKwh);
    expect(years[0]!.productionKwh).toBeCloseTo(result.generation.annual, 0);
    expect(result.lifetime!.lcoe).toBeGreaterThan(0);
    expect(years[11]!.replacement).toBeGreaterThan(0); // 12-yil invertor
  });
});

describe('outage (TZ 11.12)', () => {
  it('ON_GRID has no backup hours as a number', () => {
    const result = outage({ systemType: 'ON_GRID', criticalItems: [{ powerW: 500, count: 1, hoursPerDay: 24, months: [] }], batteryKwh: 0, socMin: 0.1, socMax: 1, roundTripEfficiency: 0.9, inverterKw: 5 });
    expect(result.applicable).toBe(false);
    expect(result.backupHoursNight).toBeNull();
  });

  it('HYBRID: night backup = usable kWh / critical kW; motor surge checked', () => {
    const result = outage({ systemType: 'HYBRID', criticalItems: [{ powerW: 200, count: 1, hoursPerDay: 24, months: [], isMotorLoad: true }, { powerW: 300, count: 1, hoursPerDay: 24, months: [] }], batteryKwh: 5, socMin: 0.1, socMax: 1, roundTripEfficiency: 0.9, inverterKw: 3 });
    const usable = 5 * 0.9 * Math.sqrt(0.9);
    expect(result.backupHoursNight).toBeCloseTo(usable / 0.5, 6);
    expect(result.peakStartKw).toBeCloseTo(0.9, 6);
    expect(result.inverterOk).toBe(true);
  });
});

describe('compatibility (TZ 11.13)', () => {
  it('flags cold Voc above inverter max as ERROR, missing data as UNKNOWN', () => {
    const result = checkCompatibility({ panel: { vocV: 50, vmpV: 42, impA: 13, tempCoeffPmaxPctPerC: -0.3, nominalPowerW: 550 }, inverter: { inverterMaxDcV: 500, mpptMinV: 150, mpptMaxV: 500, mpptMaxCurrentA: 13, inverterAcKw: 5 }, seriesCount: 10, parallelStrings: 1 });
    expect(result.checks.find((c) => c.code === 'VOC_COLD_MAX_DC')!.status).toBe('ERROR');
    expect(result.status).toBe('ERROR');
    const unknown = checkCompatibility({ panel: {}, inverter: {}, seriesCount: 10, parallelStrings: 1 });
    expect(unknown.status).toBe('UNKNOWN');
  });
});

describe('PV model B vs default yield', () => {
  it('produces a plausible annual specific yield for Tashkent from clear-sky-like irradiance', () => {
    const hours = Array.from({ length: HOURS }, (_, t) => {
      const h = HOUR_OF_DAY[t]!;
      const ghi = h >= 7 && h <= 18 ? 650 * Math.sin((Math.PI * (h - 6.5)) / 12.5) : 0;
      return { ghi: Math.max(0, ghi), tAir: 18 };
    });
    const series = pvSeriesFromIrradiance(hours, { lat: 41.3, lon: 69.24, tiltDeg: 30, azimuthDeg: 180 });
    const annual = total(series);
    expect(annual).toBeGreaterThan(1200);
    expect(annual).toBeLessThan(2400);
    const months = sumByMonth(series);
    expect(months.every((v) => v > 0)).toBe(true);
  });
});

describe('determinism, insights and performance', () => {
  it('same input → same output and insights', () => {
    const a = estimate(input({ systemType: 'HYBRID' }), data());
    const b = estimate(input({ systemType: 'HYBRID' }), data());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.insights.map((i) => i.type)).toContain('LOWEST_GENERATION_MONTH');
  });

  it('runs a full estimate (3 scenarios × 25 years) within budget', () => {
    const start = performance.now();
    estimate(input({ systemType: 'HYBRID', kwp: 6 }), data());
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
