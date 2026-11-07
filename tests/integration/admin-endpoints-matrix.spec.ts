import { globSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createSuperAdmin, createUser, type Harness, type TestUser } from '../helpers/harness';

/**
 * Admin API ruxsat matritsasi (audit 5-bosqich): controller fayllaridan parametrsiz barcha `GET /admin/*` endpointlari
 * avtomatik yig‘iladi va har biri uchun tekshiriladi: tokensiz → 401, mijoz → 403, superadmin → 2xx (yoki 400 — majburiy query),
 * hech qachon 5xx emas. Yangi admin endpoint qo‘shilsa, test uni o‘zi qamraydi.
 */
function adminGetRoutes(): string[] {
  const routes = new Set<string>();
  for (const file of globSync('src/modules/**/*.controller.ts')) {
    const source = readFileSync(file, 'utf8');
    for (const block of source.split(/(?=@Controller\()/)) {
      const prefix = /@Controller\(\s*'([^']*)'/.exec(block)?.[1];
      if (prefix === undefined || !prefix.startsWith('admin') || prefix.includes(':')) continue;
      for (const match of block.matchAll(/@Get\(\s*(?:'([^']*)')?\s*\)/g)) {
        const sub = match[1] ?? '';
        if (sub.includes(':')) continue;
        routes.add(`/${[prefix, sub].filter(Boolean).join('/')}`);
      }
    }
  }
  return [...routes].sort();
}

describe('admin endpoints — auth/role matrix', () => {
  let h: Harness;
  let admin: TestUser;
  let customer: TestUser;
  const routes = adminGetRoutes();

  beforeAll(async () => {
    h = await bootHarness();
    admin = await createSuperAdmin(h);
    customer = await createUser(h, ['CUSTOMER']);
  });
  afterAll(async () => h?.close());

  it('collects a meaningful set of admin GET endpoints', () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it('anonymous → 401 on every admin endpoint', async () => {
    const wrong: string[] = [];
    for (const path of routes) {
      const res = await h.get(path);
      if (res.status !== 401) wrong.push(`${path} → ${res.status}`);
    }
    expect(wrong).toEqual([]);
  });

  it('customer → 403 on every admin endpoint', async () => {
    const wrong: string[] = [];
    for (const path of routes) {
      const res = await h.get(path, customer.token);
      if (res.status !== 403) wrong.push(`${path} → ${res.status}`);
    }
    expect(wrong).toEqual([]);
  });

  it('superadmin → 2xx (or 400 for a missing required query), never 5xx', async () => {
    const wrong: string[] = [];
    for (const path of routes) {
      const res = await h.get(path, admin.token);
      if (!(res.status < 300 || res.status === 400)) wrong.push(`${path} → ${res.status} ${JSON.stringify(res.body)?.slice(0, 120)}`);
    }
    expect(wrong).toEqual([]);
  });
});
