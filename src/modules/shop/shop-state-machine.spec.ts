import { describe, expect, it } from 'vitest';
import { canTransition } from './shop-state-machine';

describe('Shop holatlari (TZ 3.7.3, v3.1)', () => {
  it('admin do‘konni to‘xtatadi va qayta yoqadi', () => {
    expect(canTransition('ACTIVE', 'SUSPENDED', 'ADMIN')).toBe(true);
    expect(canTransition('SUSPENDED', 'ACTIVE', 'ADMIN')).toBe(true);
  });

  it('jadvalda yo‘q o‘tishlar (eski DRAFT/PENDING_REVIEW dan chiqish ham) rad etiladi', () => {
    expect(canTransition('DRAFT', 'PENDING_REVIEW', 'ADMIN')).toBe(false);
    expect(canTransition('DRAFT', 'ACTIVE', 'ADMIN')).toBe(false);
    expect(canTransition('PENDING_REVIEW', 'ACTIVE', 'ADMIN')).toBe(false);
    expect(canTransition('SUSPENDED', 'DRAFT', 'ADMIN')).toBe(false);
    expect(canTransition('ACTIVE', 'DRAFT', 'ADMIN')).toBe(false);
  });
});
