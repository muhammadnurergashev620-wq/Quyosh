import { describe, expect, it } from 'vitest';
import { dayShareOf, hourlyFromAppliances, hourlyFromMonthly, irr, lifetime, loanSchedule, monthlyFromAverage, npv, total, type LoadProfile } from './index';

const FLAT: LoadProfile = { code: 'FLAT', monthlyFactors: Array(12).fill(1), hourlyFactors: Array.from({ length: 12 }, () => Array(24).fill(1)) };

/** TZ 11.7 (yuklama) va 11.10–11.11 (moliya) — qo‘lda hisoblangan qiymatlar. */
describe('load profile (TZ 11.7)', () => {
  it('monthly average keeps the annual total = avg × 12 and follows the monthly factors', () => {
    const winterHeavy: LoadProfile = { ...FLAT, monthlyFactors: [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2] };
    const months = monthlyFromAverage(300, winterHeavy);
    expect(months.reduce((a, b) => a + b, 0)).toBeCloseTo(3600, 6);
    expect(months[0]).toBeCloseTo(2 * months[5]!, 6);
  });

  it('monthly kWh → 8760 hourly values that add back up to the same total', () => {
    const series = hourlyFromMonthly(Array(12).fill(310), FLAT);
    expect(series.length).toBe(8760);
    expect(total(series)).toBeCloseTo(3720, 3);
  });

  it('appliances: power × count × hours × 1,10, only in selected months; 0 W items are ignored', () => {
    const series = hourlyFromAppliances([
      { powerW: 1000, count: 2, hoursPerDay: 5, months: [] }, // 10 kWh/kun butun yil
      { powerW: 2000, count: 1, hoursPerDay: 30, months: [7] }, // soat 24 bilan cheklanadi, faqat iyul
      { powerW: 0, count: 5, hoursPerDay: 10, months: [] },
    ], FLAT);
    expect(total(series)).toBeCloseTo((10 * 365 + 48 * 31) * 1.1, 3);
  });

  it('appliance own hourly usage overrides the profile', () => {
    const night = Array(24).fill(0);
    night[2] = 1;
    const series = hourlyFromAppliances([{ powerW: 500, count: 1, hoursPerDay: 2, months: [], hourlyUsage: night }], FLAT);
    expect(series[2]).toBeCloseTo(1 * 1.1, 6); // 1-yanvar 02:00
    expect(series[14]).toBe(0);
  });

  it('day share (07:00–22:00) of a flat profile is 15/24', () => {
    expect(dayShareOf(FLAT, 0)).toBeCloseTo(15 / 24, 9);
  });
});

describe('finance (TZ 11.10)', () => {
  it('NPV and IRR of a simple project', () => {
    expect(npv(0.1, [-1000, 1100])).toBeCloseTo(0, 9);
    expect(irr([-1000, 1100])).toBeCloseTo(0.1, 6);
    expect(irr([1000, 500])).toBeNull(); // ishorasi o‘zgarmasa — hisoblanmaydi
  });

  it('IRR falls back to bisection when Newton leaves the range (deeply negative return)', () => {
    const flows = [-1000, 100]; // IRR = −90 %
    const r = irr(flows)!;
    expect(r).toBeCloseTo(-0.9, 6);
    expect(Math.abs(npv(r, flows))).toBeLessThan(1e-3);
  });

  it('25-year model: replacements, OPEX growth, discounted payback, LCOE and CO₂', () => {
    const r = lifetime({
      years: 25,
      initialCost: 30_000_000,
      perYear: Array.from({ length: 25 }, () => ({ productionKwh: 9000, saving: 6_000_000, exportIncome: 0 })),
      opex1: 300_000,
      opexGrowth: 0.05,
      discountRate: 0.12,
      replacements: [{ year: 12, cost: 8_000_000 }],
      co2KgPerKwh: 0.5,
    });
    expect(r.years).toHaveLength(25);
    expect(r.years[11]!.replacement).toBe(8_000_000);
    expect(r.years[1]!.opex).toBeCloseTo(300_000 * 1.05, 2);
    expect(r.discountedPayback).not.toBeNull();
    expect(r.irr).toBeGreaterThan(0.12);
    expect(r.npv).toBeGreaterThan(0);
    expect(r.co2Kg).toBeCloseTo(9000 * 25 * 0.5, 3);
    expect(r.lcoe).toBeGreaterThan(0);
  });

  it('never pays back when yearly saving is below OPEX', () => {
    const r = lifetime({ years: 10, initialCost: 10_000_000, perYear: Array.from({ length: 10 }, () => ({ productionKwh: 100, saving: 100_000, exportIncome: 0 })), opex1: 200_000, opexGrowth: 0, discountRate: 0.1, replacements: [], co2KgPerKwh: 0.5 });
    expect(r.discountedPayback).toBeNull();
    expect(r.irr).toBeNull();
  });
});

describe('financing with savings (TZ 11.11)', () => {
  const base = { initialCost: 24_000_000, downPayment: 0, annualRate: 0.24, termMonths: 24, paymentType: 'ANNUITY' as const };

  it('break-even month and out-of-pocket per month when savings are given', () => {
    const r = loanSchedule({ ...base, monthlySaving: Array(12).fill(1_000_000) });
    expect(r.schedule[0]!.saving).toBe(1_000_000);
    expect(r.schedule[0]!.net).toBeCloseTo(r.schedule[0]!.payment - 1_000_000, 6);
    expect(r.breakEvenMonth).toBeGreaterThan(24); // tejash to‘lovdan kam — kredit tugagach qoplanadi
  });

  it('shortest self-funding term: the first allowed term whose payment ≤ average saving', () => {
    const r = loanSchedule({ ...base, monthlySaving: Array(12).fill(1_500_000), allowedTerms: [6, 12, 24, 36] });
    expect(r.shortestSelfFundingTerm).toBe(24);
  });

  it('fees: one-time % of financed amount and a monthly fee are added to the total', () => {
    const r = loanSchedule({ ...base, oneTimeFeePct: 0.01, monthlyFee: 10_000 });
    expect(r.totalFees).toBeCloseTo(240_000 + 24 * 10_000, 6);
    expect(r.totalPaid).toBeCloseTo(r.schedule.reduce((s, row) => s + row.payment, 0) + r.totalFees, 4);
  });
});
