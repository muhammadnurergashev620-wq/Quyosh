import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatRelativeTime, initials } from './utils';

describe('formatDateTime / formatDate (Toshkent vaqti, o‘zbekcha oy nomlari)', () => {
  it('formats a UTC instant in Asia/Tashkent (UTC+5)', () => {
    expect(formatDateTime('2026-09-23T17:08:00Z')).toBe('23 sen 2026, 22:08');
    expect(formatDate('2026-09-23T17:08:00Z')).toBe('23 sen 2026');
  });

  it('rolls over to the next day when Tashkent time is past midnight', () => {
    expect(formatDateTime('2026-12-31T20:30:00Z')).toBe('1 yan 2027, 01:30');
  });

  it('shows a dash for missing or invalid dates', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDateTime('not a date')).toBe('—');
  });
});

describe('initials', () => {
  it('uses the first letters of up to two words', () => {
    expect(initials('Eshmat Toshmatov')).toBe('ET');
    expect(initials('  ali  ')).toBe('A');
  });

  it('does not use digits or "+" for phone-number names', () => {
    expect(initials('+998900000003')).toBe('•');
    expect(initials('')).toBe('•');
    expect(initials(null)).toBe('•');
  });
});

describe('formatRelativeTime (o‘zbekcha)', () => {
  const now = new Date('2026-09-24T12:00:00Z').getTime();
  const ago = (seconds: number) => new Date(now - seconds * 1000);

  it('says “hozirgina” for the last few seconds', () => {
    expect(formatRelativeTime(ago(10), now)).toBe('hozirgina');
  });

  it('formats the past in minutes, hours, days, months and years', () => {
    expect(formatRelativeTime(ago(5 * 60), now)).toBe('5 daqiqa oldin');
    expect(formatRelativeTime(ago(3 * 3600), now)).toBe('3 soat oldin');
    expect(formatRelativeTime(ago(2 * 86_400), now)).toBe('2 kun oldin');
    expect(formatRelativeTime(ago(65 * 86_400), now)).toBe('2 oy oldin');
    expect(formatRelativeTime(ago(800 * 86_400), now)).toBe('2 yil oldin');
  });

  it('formats the future with “keyin” and survives invalid input', () => {
    expect(formatRelativeTime(new Date(now + 3 * 3600 * 1000), now)).toBe('3 soatdan keyin');
    expect(formatRelativeTime('nope', now)).toBe('—');
  });
});
