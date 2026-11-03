import { describe, expect, it } from 'vitest';
import { canTransition } from './shop-state-machine';

describe('Shop holatlari (TZ 3.7.3)', () => {
  it('ega faqat DRAFT → PENDING_REVIEW qila oladi', () => {
    expect(canTransition('DRAFT', 'PENDING_REVIEW', 'OWNER')).toBe(true);
    expect(canTransition('DRAFT', 'ACTIVE', 'OWNER')).toBe(false);
    expect(canTransition('ACTIVE', 'SUSPENDED', 'OWNER')).toBe(false);
  });

  it('admin tekshiruv qarorini beradi, lekin to‘xtatolmaydi', () => {
    expect(canTransition('PENDING_REVIEW', 'ACTIVE', 'ADMIN')).toBe(true);
    expect(canTransition('PENDING_REVIEW', 'DRAFT', 'ADMIN')).toBe(true);
    expect(canTransition('ACTIVE', 'SUSPENDED', 'ADMIN')).toBe(false);
  });

  it('superadmin to‘xtatadi va qayta yoqadi; jadvalda yo‘q o‘tish rad etiladi', () => {
    expect(canTransition('ACTIVE', 'SUSPENDED', 'SUPER_ADMIN')).toBe(true);
    expect(canTransition('SUSPENDED', 'ACTIVE', 'SUPER_ADMIN')).toBe(true);
    expect(canTransition('PENDING_REVIEW', 'ACTIVE', 'SUPER_ADMIN')).toBe(true);
    expect(canTransition('SUSPENDED', 'DRAFT', 'SUPER_ADMIN')).toBe(false);
    expect(canTransition('DRAFT', 'SUSPENDED', 'SUPER_ADMIN')).toBe(false);
  });
});
