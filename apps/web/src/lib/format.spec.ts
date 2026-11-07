import { describe, expect, it } from 'vitest';
import { formatBytes, formatDecimal, formatKw, formatKwh, formatMoney, formatNumber, formatPercent, formatRating, formatSum, formatSumShort } from './format';

const NB = ' ';

/** Yagona formatlash (TZ U3): «1 250 000 so‘m», kasr vergul bilan «6,6 kVt» — standart til o‘zbekcha. */
describe('lib/format', () => {
  it('groups thousands with a space and rounds integers', () => {
    expect(formatNumber(1_250_000)).toBe('1 250 000');
    expect(formatNumber(999.6)).toBe('1 000');
    expect(formatNumber(-1500)).toBe('−1 500');
    expect(formatNumber(Number.NaN)).toBe('—');
  });

  it('uses a comma as the decimal separator and trims trailing zeros', () => {
    expect(formatDecimal(6.6)).toBe('6,6');
    expect(formatDecimal(6.0)).toBe('6');
    expect(formatDecimal(1234.567, 2)).toBe('1 234,57');
    expect(formatDecimal(-0.04, 1)).toBe('0');
    expect(formatDecimal(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('keeps one decimal for ratings and formats percents from fractions', () => {
    expect(formatRating(4)).toBe('4,0');
    expect(formatRating('4.56')).toBe('4,6');
    expect(formatPercent(0.22)).toBe(`22${NB}%`);
    expect(formatPercent(0.225)).toBe(`22,5${NB}%`);
  });

  it('formats money in so‘m with non-breaking spaces', () => {
    expect(formatSum(1_250_000)).toBe(`1${NB}250${NB}000${NB}so‘m`);
    expect(formatMoney('31000000')).toBe(`31${NB}000${NB}000${NB}UZS`);
    expect(formatSum('abc')).toBe('—');
  });

  it('shortens large sums', () => {
    expect(formatSumShort(12_400_000)).toBe('12,4 mln so‘m');
    expect(formatSumShort(1_500_000_000)).toBe('1,5 mlrd so‘m');
    expect(formatSumShort(850_000)).toBe('850 ming so‘m');
  });

  it('formats power, energy and file size', () => {
    expect(formatKw(6.6)).toBe(`6,6${NB}kVt`);
    expect(formatKw(1.65)).toBe(`1,65${NB}kVt`);
    expect(formatKwh(4200)).toBe(`4 200${NB}kWh`);
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(3.25 * 1024 * 1024)).toBe('3,25 MB');
  });
});
