import { describe, expect, it } from 'vitest';
import { hhmm, sunState, sunTimes } from './sun';

describe('sunTimes (NOAA, Toshkent)', () => {
  it('yozgi kunda kun uzun, qishda qisqa', () => {
    const summer = sunTimes(new Date(Date.UTC(2026, 5, 21)));
    const winter = sunTimes(new Date(Date.UTC(2026, 11, 21)));
    expect(summer.sunset - summer.sunrise).toBeGreaterThan(14.5 * 60);
    expect(winter.sunset - winter.sunrise).toBeLessThan(9.5 * 60);
  });

  it('21-iyunda quyosh taxminan 04:45–05:05 da chiqadi', () => {
    const { sunrise } = sunTimes(new Date(Date.UTC(2026, 5, 21)));
    expect(sunrise).toBeGreaterThan(4 * 60 + 40);
    expect(sunrise).toBeLessThan(5 * 60 + 10);
  });

  it('tunda davr NIGHT bo‘ladi', () => {
    expect(sunState(new Date(Date.UTC(2026, 9, 30, 20, 0))).period).toBe('NIGHT');
    expect(hhmm(6 * 60 + 41)).toBe('06:41');
  });
});
