import { describe, expect, it } from 'vitest';
import { calcBrief } from './quote-request.service';

describe('calcBrief (do‘konga ko‘rinadigan hisob xulosasi)', () => {
  it('reads the real result/input shape: usableAreaM2 at top level, bill under consumption.billAmount', () => {
    const output = { systemType: 'HYBRID', systemPowerKw: 5.2, panelCountEstimate: 9, usableAreaM2: 16, load: { annual: 4800 }, generation: { annual: 7100 }, money: { initialCost: 52_000_000, simplePaybackYears: 6.1 } };
    const input = { mode: 'QUICK', consumption: { billAmount: 450_000 } };
    expect(calcBrief(output, input)).toMatchObject({ systemPowerKw: 5.2, panelCount: 9, usableAreaM2: 16, annualLoadKwh: 4800, annualGenerationKwh: 7100, monthlyBill: 450_000, initialCost: 52_000_000 });
  });

  it('falls back to the entered area and tolerates junk', () => {
    expect(calcBrief({ systemPowerKw: 'x' }, { areaM2: 40 })).toMatchObject({ systemPowerKw: null, usableAreaM2: 40, monthlyBill: null });
    expect(calcBrief(null, null)).toBeNull();
  });
});
