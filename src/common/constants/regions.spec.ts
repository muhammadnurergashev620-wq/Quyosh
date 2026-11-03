import { describe, expect, it } from 'vitest';
import { REGIONS, regionName, regionOf } from './regions';

describe('regionOf', () => {
  it('maps city centres to their region', () => {
    expect(regionOf(41.311, 69.279)).toBe('toshkent-shahri');
    expect(regionOf(39.654, 66.96)).toBe('samarqand');
    expect(regionOf(39.768, 64.421)).toBe('buxoro');
    expect(regionOf(42.46, 59.61)).toBe('qoraqalpogiston');
    expect(regionOf(37.224, 67.278)).toBe('surxondaryo');
    expect(regionOf(40.783, 72.344)).toBe('andijon');
    expect(regionOf(41.0, 71.67)).toBe('namangan');
  });

  it('separates the city of Tashkent from the Tashkent region', () => {
    expect(regionOf(41.33, 69.3)).toBe('toshkent-shahri');
    expect(regionOf(41.47, 69.58)).toBe('toshkent-viloyati');
  });

  it('returns null for missing or foreign coordinates', () => {
    expect(regionOf(null, 69)).toBeNull();
    expect(regionOf(undefined, undefined)).toBeNull();
    expect(regionOf(55.75, 37.62)).toBeNull();
  });

  it('has 14 unique regions with names', () => {
    expect(REGIONS).toHaveLength(14);
    expect(new Set(REGIONS.map((region) => region.key)).size).toBe(14);
    expect(regionName('samarqand')).toBe('Samarqand viloyati');
    expect(regionName('nope')).toBeNull();
  });
});
