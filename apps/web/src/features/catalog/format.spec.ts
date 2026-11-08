import { describe, expect, it } from 'vitest';
import { keySpecs, priceWithRate, specValue } from './format';
import { useCompare } from './compare-store';
import { openNow } from '@/pages/catalog/ShopProfilePage.helpers';

describe('specValue', () => {
  it('formats with units and converts DoD fraction to percent', () => {
    expect(specValue('nominalPowerW', 580)).toMatch(/^580 W$/);
    expect(specValue('batteryUsableDod', '0.95')).toMatch(/^95 %$/);
    expect(specValue('batteryChemistry', 'LiFePO4')).toBe('LiFePO4');
    expect(specValue('vocV', null)).toBe('—');
  });
});

describe('keySpecs', () => {
  it('picks panel / inverter / battery highlights', () => {
    expect(keySpecs({ nominalPowerW: 580, efficiencyPct: '22.5' })[0]).toContain('580');
    expect(keySpecs({ inverterAcKw: '8' })[0]).toContain('8');
    expect(keySpecs({ batteryCapacityKwh: '4.8', batteryChemistry: 'LiFePO4' })).toHaveLength(2);
  });
});

describe('priceWithRate', () => {
  const rate = { currency: 'USD' as const, rateToUzs: '12066.22', rateDate: '2026-10-30', source: 'cbu', stale: false };
  it('shows USD with the sum equivalent and the CBU rate date', () => {
    const result = priceWithRate('1250', 'USD', '15082775.00', rate);
    expect(result.main).toContain('$');
    expect(result.note).toContain('30.10.2026');
  });
  it('shows UZS without a note', () => {
    expect(priceWithRate('1450000', 'UZS', '1450000', rate).note).toBeNull();
  });
});

describe('compare store', () => {
  it('keeps at most 4 models and toggles off', () => {
    const store = useCompare.getState();
    store.clear();
    for (let i = 0; i < 4; i += 1) expect(useCompare.getState().toggle({ id: `m${i}`, slug: `m${i}`, label: `M${i}` })).toBe(true);
    expect(useCompare.getState().toggle({ id: 'm9', slug: 'm9', label: 'M9' })).toBe(false);
    useCompare.getState().toggle({ id: 'm0', slug: 'm0', label: 'M0' });
    expect(useCompare.getState().items.map((item) => item.id)).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('openNow', () => {
  const hours = { fri: [['09:00', '18:00']] as Array<[string, string]> };
  it('uses Tashkent time', () => {
    // 2026-10-30 (juma) 10:00 Toshkent = 05:00 UTC
    expect(openNow(hours, new Date('2026-10-30T05:00:00Z'))).toBe(true);
    expect(openNow(hours, new Date('2026-10-30T14:30:00Z'))).toBe(false);
    expect(openNow(null)).toBeNull();
  });
});
