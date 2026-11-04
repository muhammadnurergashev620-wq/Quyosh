import { describe, expect, it } from 'vitest';
import { getNavItems } from './nav-items';

describe('getNavItems', () => {
  it('gives admins only admin sections plus shared ones', () => {
    const paths = getNavItems('ADMIN', { superAdmin: true }).map((item) => item.to);
    expect(paths[0]).toBe('/admin');
    expect(paths).toContain('/admin/dokonlar');
    expect(paths).not.toContain('/admin/tasdiqlash');
    expect(paths).not.toContain('/mijoz/sorovlar');
    expect(paths).not.toContain('/dokon/sorovlar');
  });

  it('gives shops their working tools', () => {
    const paths = getNavItems('SHOP').map((item) => item.to);
    expect(paths).toEqual(expect.arrayContaining(['/dokon', '/dokon/sorovlar', '/dokon/takliflar', '/dokon/katalog']));
    expect(getNavItems('SHOP').filter((item) => item.primary).length).toBeLessThanOrEqual(5);
    expect(paths.some((path) => path.startsWith('/admin'))).toBe(false);
  });

  it('defaults to the customer menu', () => {
    for (const role of ['CUSTOMER', null] as const) {
      const paths = getNavItems(role).map((item) => item.to);
      expect(paths[0]).toBe('/mijoz/bosh');
      expect(paths).toContain('/mijoz/hisoblar');
    }
  });

  it('never repeats a path within one menu', () => {
    for (const role of ['ADMIN', 'SHOP', 'CUSTOMER'] as const) {
      const paths = getNavItems(role).map((item) => item.to);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });

  it('gives every item an icon and a group, and keeps at most 5 primary items for the mobile bar', () => {
    for (const role of ['ADMIN', 'SHOP', 'CUSTOMER'] as const) {
      const items = getNavItems(role);
      for (const item of items) {
        expect(item.icon).toBeTruthy();
        expect(item.group).toBeTruthy();
      }
      expect(items.filter((item) => item.primary).length).toBeLessThanOrEqual(5);
    }
  });
});

describe('getNavItems — admin permissions', () => {
  it('shows a plain admin only the sections they were granted', () => {
    const paths = getNavItems('ADMIN', { permissions: ['SHOPS'] }).map((item) => item.to);
    expect(paths).toContain('/admin/dokonlar');
    expect(paths).not.toContain('/admin/foydalanuvchilar');
    expect(paths).not.toContain('/admin/audit');
    expect(paths).not.toContain('/admin/adminlar');
  });

  it('a superadmin sees everything including the admins section', () => {
    const paths = getNavItems('ADMIN', { superAdmin: true }).map((item) => item.to);
    expect(paths).toEqual(expect.arrayContaining(['/admin/adminlar', '/admin/audit', '/admin/foydalanuvchilar']));
  });
});
