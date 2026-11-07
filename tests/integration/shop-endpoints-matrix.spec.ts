import { globSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createShop, createUser, type Harness, type TestShop, type TestUser } from '../helpers/harness';

/**
 * Do‘kon kabineti ruxsat matritsasi (TZ 2.3, object-level): `manage/shops/:shopId/*` dagi faqat `:shopId` parametrli
 * barcha GET endpointlar avtomatik yig‘iladi: tokensiz → 401, mijoz → 403/404, begona do‘kon egasi → 403/404,
 * o‘z do‘koni → 2xx (yoki 400), hech qachon 5xx emas.
 */
function shopGetRoutes(): string[] {
  const routes = new Set<string>();
  for (const file of globSync('src/modules/**/*.controller.ts')) {
    const source = readFileSync(file, 'utf8');
    for (const block of source.split(/(?=@Controller\()/)) {
      const prefix = /@Controller\(\s*'([^']*)'/.exec(block)?.[1];
      if (prefix === undefined || !prefix.startsWith('manage/shops/:shopId')) continue;
      for (const match of block.matchAll(/@Get\(\s*(?:'([^']*)')?\s*\)/g)) {
        const sub = match[1] ?? '';
        if (sub.includes(':')) continue;
        routes.add(`/${[prefix, sub].filter(Boolean).join('/')}`);
      }
    }
  }
  return [...routes].sort();
}

describe('shop cabinet endpoints — auth/object-level matrix', () => {
  let h: Harness;
  let mine: TestShop;
  let foreign: TestShop;
  let customer: TestUser;
  const routes = shopGetRoutes();
  const asShop = (path: string, token?: string) => h.api('GET', path, { headers: { 'x-app-panel': 'SHOP' }, ...(token ? { cookie: `accessToken_shop=${token}` } : {}) });

  beforeAll(async () => {
    h = await bootHarness();
    mine = await createShop(h);
    foreign = await createShop(h);
    customer = await createUser(h, ['CUSTOMER']);
  });
  afterAll(async () => h?.close());

  const at = (shopId: string) => routes.map((r) => r.replace(':shopId', shopId));

  it('collects the shop cabinet GET endpoints', () => {
    expect(routes.length).toBeGreaterThan(15);
  });

  it('anonymous → 401', async () => {
    const wrong: string[] = [];
    for (const path of at(mine.shopId)) { const r = await asShop(path); if (r.status !== 401) wrong.push(`${path} → ${r.status}`); }
    expect(wrong).toEqual([]);
  });

  it('a customer and another shop’s owner cannot read this shop (403/404)', async () => {
    const wrong: string[] = [];
    for (const path of at(mine.shopId)) {
      for (const [who, token] of [['customer', customer.token], ['foreign owner', foreign.owner.token]] as const) {
        const r = await asShop(path, token);
        if (r.status !== 403 && r.status !== 404) wrong.push(`${who}: ${path} → ${r.status}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('the owner reads every cabinet endpoint (2xx or 400), never 5xx', async () => {
    const wrong: string[] = [];
    for (const path of at(mine.shopId)) {
      const r = await asShop(path, mine.owner.token);
      if (!(r.status < 300 || r.status === 400)) wrong.push(`${path} → ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`);
    }
    expect(wrong).toEqual([]);
  });
});
