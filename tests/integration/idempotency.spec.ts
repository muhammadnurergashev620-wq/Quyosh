import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createShop, createUser, type Harness, type TestShop, type TestUser } from '../helpers/harness';
import { seedM6 } from '../../prisma/seed-m6';

/** TZ 9.4: so‘rov, taklif, yuborish va PDF hisobot — `Idempotency-Key` majburiy; bir kalit — bitta natija. */
describe('idempotency (TZ 9.4)', () => {
  let h: Harness;
  let customer: TestUser;
  let shop: TestShop;
  let calcId: string;

  const withKey = (key: string) => ({ headers: { 'idempotency-key': key } });
  const body = () => ({ calculationId: calcId, systemType: 'ON_GRID', shopIds: [shop.shopId] });

  beforeAll(async () => {
    h = await bootHarness();
    await seedM6(h.db as never);
    customer = await createUser(h, ['CUSTOMER']);
    shop = await createShop(h);
    await h.db.shop.update({ where: { id: shop.shopId }, data: { verificationStatus: 'VERIFIED' } });
    const calc = await h.post('/calculations', customer.token, { input: { mode: 'QUICK', lat: 41.3123, lon: 69.2811, areaPreset: 'SMALL', consumption: { monthlyKwh: 350 } }, title: 'Uy' });
    calcId = calc.data.id;
  });
  afterAll(async () => h?.close());

  const requestCount = () => h.db.quoteRequest.count({ where: { userId: customer.id } });

  it('rejects a create without the key (400 IDEMPOTENCY_KEY_REQUIRED) and creates nothing', async () => {
    const res = await h.post('/quote-requests', customer.token, body(), { idempotent: false });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(await requestCount()).toBe(0);
  });

  it('replays the same response for the same key — one record only', async () => {
    const first = await h.post('/quote-requests', customer.token, body(), withKey('qr-1'));
    const second = await h.post('/quote-requests', customer.token, body(), withKey('qr-1'));
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.data.id).toBe(first.data.id);
    expect(await requestCount()).toBe(1);
  });

  it('returns 409 IDEMPOTENCY_CONFLICT when the same key comes with another body', async () => {
    const res = await h.post('/quote-requests', customer.token, { ...body(), notes: 'boshqa' }, withKey('qr-1'));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await requestCount()).toBe(1);
  });

  it('a double click (two parallel requests with one key) creates a single report job', async () => {
    const [a, b] = await Promise.all([
      h.post(`/calculations/${calcId}/report`, customer.token, { lang: 'uz' }, withKey('rep-1')),
      h.post(`/calculations/${calcId}/report`, customer.token, { lang: 'uz' }, withKey('rep-1')),
    ]);
    const statuses = [a.status, b.status].sort();
    // Ikkinchisi yo javobni qayta oladi (201), yo hali bajarilayotgani haqida 409 IDEMPOTENCY_IN_PROGRESS.
    expect(statuses[0]).toBe(201);
    expect([201, 409]).toContain(statuses[1]);
    expect(await h.db.reportJob.count({ where: { calculationId: calcId } })).toBe(1);
  });

  it('the key is scoped per user — another user with the same key gets its own record', async () => {
    const other = await createUser(h, ['CUSTOMER']);
    const calc = await h.post('/calculations', other.token, { input: { mode: 'QUICK', lat: 41.3123, lon: 69.2811, areaPreset: 'SMALL', consumption: { monthlyKwh: 300 } }, title: 'Boshqa' });
    const res = await h.post('/quote-requests', other.token, { calculationId: calc.data.id, systemType: 'ON_GRID', shopIds: [shop.shopId] }, withKey('qr-1'));
    expect(res.status).toBe(201);
    expect(await h.db.quoteRequest.count({ where: { userId: other.id } })).toBe(1);
  });
});
