import { describe, expect, it } from 'vitest';
import { generateTempPassword } from './temp-password';

describe('generateTempPassword', () => {
  it('is at least 12 chars with all character classes and no ambiguous symbols', () => {
    for (let i = 0; i < 200; i += 1) {
      const p = generateTempPassword();
      expect(p).toHaveLength(16);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/\d/);
      expect(p).toMatch(/[#$%&*+\-=?@]/);
      expect(p).not.toMatch(/[0OIl1]/);
    }
  });

  it('is unique across calls and refuses short lengths', () => {
    expect(new Set(Array.from({ length: 500 }, () => generateTempPassword())).size).toBe(500);
    expect(() => generateTempPassword(8)).toThrow();
  });
});
