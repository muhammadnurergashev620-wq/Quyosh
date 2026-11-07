import { describe, expect, it } from 'vitest';
import { billMonth, chooseInverterKw, DEFAULT_PANEL, kwhFromBill, loanSchedule, maxPanelsForArea, recommendBatteryKwh, recommendSize, rowPitchM, simplePayback, type SizingInput, type Tariff } from './index';

/**
 * TZ 11 / 17.1 — golden to‘plam: “tayyor kirish → kutilgan chiqish”.
 * Kutilgan qiymatlar TZ formulalari bo‘yicha qo‘lda (kalkulyatorda) hisoblangan va kodga bog‘liq emas.
 */

const TIERED: Tariff = {
  fixedChargeMonthly: 0,
  touEnabled: false,
  touPeriods: [],
  tiers: [
    { seasonMonths: [], touPeriod: 'ALL', minKwh: 0, maxKwh: 200, ratePerKwh: 600 },
    { seasonMonths: [], touPeriod: 'ALL', minKwh: 200, maxKwh: 1000, ratePerKwh: 1000 },
    { seasonMonths: [], touPeriod: 'ALL', minKwh: 1000, maxKwh: null, ratePerKwh: 1500 },
  ],
};

const sizing = (over: Partial<SizingInput> = {}): SizingInput => ({
  systemType: 'ON_GRID',
  annualLoadKwh: 4200,
  monthlyLoadKwh: Array(12).fill(350),
  specificYieldKwhPerKwp: 1500,
  monthlySpecificYield: Array(12).fill(125),
  exportCompensated: false,
  maxPanelsByArea: null,
  gridMaxKw: null,
  dcAcRatio: 1.2,
  budget: null,
  pricePerKwp: null,
  panel: DEFAULT_PANEL,
  ...over,
});

describe('golden: geometry (TZ 11.3)', () => {
  it('G01 row pitch — Tashkent 41,3°, β 25°, L 2,278 m → αmin 25,26°, pitch ≈ 4,105 m', () => {
    expect(rowPitchM(2.278, 25, 41.3)).toBeCloseTo(4.1049, 3);
  });

  it('G02 pitched roof 30 m² usable, panel 2,278×1,134 → floor(30 / 2,583 × 0,90) = 10 panels', () => {
    expect(maxPanelsForArea({ roofShape: 'PITCHED', usableAreaM2: 30 }, DEFAULT_PANEL, 41.3)).toBe(10);
  });

  it('G03 empty or negative usable area → 0 panels (no crash)', () => {
    expect(maxPanelsForArea({ roofShape: 'PITCHED', usableAreaM2: 0 }, DEFAULT_PANEL, 41.3)).toBe(0);
    expect(maxPanelsForArea({ roofShape: 'FLAT', usableAreaM2: -5 }, DEFAULT_PANEL, 41.3)).toBe(0);
  });
});

describe('golden: sizing (TZ 11.4)', () => {
  it('G04 4 200 kWh/yil, 1 500 kWh/kWp, eksport kompensatsiyasiz (0,8) → 2,24 kWp → 4 × 550 W = 2,2 kWp; Tejamkor 2 panel', () => {
    const r = recommendSize(sizing());
    expect(r.limits.needed).toBeCloseTo(2.24, 6);
    expect(r.panelCount).toBe(4);
    expect(r.recommendedKwp).toBeCloseTo(2.2, 6);
    expect(r.limitingFactor).toBe('CONSUMPTION');
    expect(r.options.find((o) => o.key === 'ECONOMY')).toMatchObject({ panelCount: 2, kwp: 1.1 });
  });

  it('G05 eksport tasdiqlangan (1,0) → 2,8 kWp → 5 panel', () => {
    expect(recommendSize(sizing({ exportCompensated: true })).panelCount).toBe(5);
  });

  it('G06 tom maydoni 3 panelga yetadi → AREA cheklaydi, 1,65 kWp', () => {
    const r = recommendSize(sizing({ maxPanelsByArea: 3 }));
    expect(r.limitingFactor).toBe('AREA');
    expect(r.panelCount).toBe(3);
    expect(r.recommendedKwp).toBeCloseTo(1.65, 6);
  });

  it('G07a OFF_GRID: eng yomon oy (dekabr 60 kWh/kWp) — 350 × 1,15 / 60 = 6,71 kWp → 12 panel; ulanish limiti qo‘llanmaydi', () => {
    const yieldByMonth = [150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 60];
    const r = recommendSize(sizing({ systemType: 'OFF_GRID', monthlySpecificYield: yieldByMonth, specificYieldKwhPerKwp: 1710, gridMaxKw: 3 }));
    expect(r.limits.needed).toBeCloseTo((350 / 31) * 1.15 / (60 / 31), 6);
    expect(r.panelCount).toBe(12);
    expect(r.limits.grid).toBeNull();
  });

  it('G07b tekis tom 100 m²: qatorlar orasidagi soyasiz masofa tufayli qiya tomdagidan kam panel, lekin > 0', () => {
    const flat = maxPanelsForArea({ roofShape: 'FLAT', usableAreaM2: 100 }, DEFAULT_PANEL, 41.3);
    const pitched = maxPanelsForArea({ roofShape: 'PITCHED', usableAreaM2: 100 }, DEFAULT_PANEL, 41.3);
    expect(pitched).toBe(34); // floor(100 / 2,583 × 0,90)
    expect(flat).toBeGreaterThan(0);
    expect(flat).toBeLessThan(pitched);
    // To‘rtburchak o‘lchami berilsa — shu bo‘yicha (20 × 5 m).
    expect(maxPanelsForArea({ roofShape: 'FLAT', usableAreaM2: 100, rectWidthM: 20, rectLengthM: 5 }, DEFAULT_PANEL, 41.3)).toBeGreaterThan(0);
  });

  it('G07 iste’mol 0 → kamida 1 panel, sabab MIN_ONE_PANEL', () => {
    const r = recommendSize(sizing({ annualLoadKwh: 0, monthlyLoadKwh: Array(12).fill(0) }));
    expect(r.panelCount).toBe(1);
    expect(r.limitingFactor).toBe('MIN_ONE_PANEL');
  });
});

describe('golden: inverter and battery (TZ 11.5)', () => {
  it.each([
    [6.6, 6], // 6,6 / 1,2 = 5,5 → 6
    [3.3, 3], // 2,75 → 3
    [60, 50], // 50 → 50
    [70, 59], // 58,3 → qatordan tashqarida → yuqoriga butun
  ])('G08 DC %s kWp, dcAc 1,2 → invertor %s kW', (dc, ac) => {
    expect(chooseInverterKw(dc, 1.2)).toBe(ac);
  });

  it('G09 akkumulyator: HYBRID 1,5 kW × 4 soat / (0,9 × 0,9) = 7,41 → 7,5 kWh; OFF_GRID 10 kWh/kun × 1,5 kun → 20 kWh; ON_GRID → 0', () => {
    expect(recommendBatteryKwh({ systemType: 'HYBRID', usableDod: 0.9, efficiency: 0.9, criticalLoadKw: 1.5, backupHours: 4 })).toBe(7.5);
    expect(recommendBatteryKwh({ systemType: 'OFF_GRID', usableDod: 0.9, efficiency: 0.9, dailyLoadKwh: 10, autonomyDays: 1.5 })).toBe(20);
    expect(recommendBatteryKwh({ systemType: 'ON_GRID', usableDod: 0.9, efficiency: 0.9, criticalLoadKw: 5, backupHours: 8 })).toBe(0);
  });
});

describe('golden: tariff (TZ 11.8)', () => {
  it('G10 pog‘ona chegarasi [min, max): 200 kWh → faqat 1-pog‘ona = 120 000 so‘m', () => {
    expect(billMonth(TIERED, { ALL: 200 }, 0)).toBe(120_000);
  });

  it('G11 350 kWh → 200 × 600 + 150 × 1 000 = 270 000 so‘m; 1 200 kWh → 1 220 000 so‘m', () => {
    expect(billMonth(TIERED, { ALL: 350 }, 0)).toBe(270_000);
    expect(billMonth(TIERED, { ALL: 1200 }, 0)).toBe(120_000 + 800_000 + 300_000);
  });

  it('G12 teskari hisob: 270 000 so‘m → 350 kWh (±0,1)', () => {
    expect(kwhFromBill(TIERED, 270_000, 0)).toBeCloseTo(350, 1);
  });

  it('G13 0 kWh → 0 so‘m (manfiy emas)', () => {
    expect(billMonth(TIERED, { ALL: 0 }, 0)).toBe(0);
  });
});

describe('golden: finance (TZ 11.10–11.11)', () => {
  it('G14 qoplanish: 30 mln / 6 mln yiliga = 5 yil; sof foyda ≤ 0 → qoplanish yo‘q', () => {
    expect(simplePayback(30_000_000, 6_000_000)).toEqual({ years: 5, unavailableReason: null });
    expect(simplePayback(30_000_000, 0)).toEqual({ years: null, unavailableReason: 'NON_POSITIVE_BENEFIT' });
    expect(simplePayback(30_000_000, -1)).toEqual({ years: null, unavailableReason: 'NON_POSITIVE_BENEFIT' });
  });

  it('G15 annuitet: 12 mln, 24 % yillik, 12 oy → 1 134 715,16 so‘m/oy (bank formulasi, 1 so‘m aniqlik)', () => {
    const r = loanSchedule({ initialCost: 15_000_000, downPayment: 3_000_000, annualRate: 0.24, termMonths: 12, paymentType: 'ANNUITY' });
    expect(r.financedAmount).toBe(12_000_000);
    expect(Math.abs(r.firstPayment - 1_134_715.16)).toBeLessThan(1);
    expect(Math.abs(r.totalInterest - 1_616_581.91)).toBeLessThan(1);
    expect(r.schedule.at(-1)!.balance).toBeCloseTo(0, 6);
  });

  it('G16 differensial: foizlar yig‘indisi 1 560 000; to‘lovlar = kredit + foiz', () => {
    const r = loanSchedule({ initialCost: 12_000_000, downPayment: 0, annualRate: 0.24, termMonths: 12, paymentType: 'DIFFERENTIATED' });
    expect(r.totalInterest).toBeCloseTo(1_560_000, 2);
    expect(r.schedule.reduce((s, row) => s + row.payment, 0)).toBeCloseTo(13_560_000, 2);
  });

  it('G17 0 % stavka → teng bo‘laklar, ortiqcha to‘lov 0', () => {
    const r = loanSchedule({ initialCost: 12_000_000, downPayment: 0, annualRate: 0, termMonths: 12, paymentType: 'ANNUITY' });
    expect(r.firstPayment).toBe(1_000_000);
    expect(r.totalInterest).toBe(0);
    expect(r.overpayment).toBe(0);
  });

  it('G18 boshlang‘ich to‘lov narxdan katta → moliyalashtiriladigan summa 0 (manfiy emas)', () => {
    const r = loanSchedule({ initialCost: 5_000_000, downPayment: 6_000_000, annualRate: 0.2, termMonths: 6, paymentType: 'ANNUITY' });
    expect(r.financedAmount).toBe(0);
    expect(r.schedule.every((row) => row.payment === 0)).toBe(true);
  });
});
