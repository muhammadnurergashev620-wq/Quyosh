import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createUser, type Harness, type TestUser } from '../helpers/harness';

/** M4: hisob API (guest va mijoz), tarif boshqaruvi (kesishish, manba), kredit va uzilish. */
describe('M4 calculation integration', () => {
  let h: Harness;
  let admin: TestUser;
  const base = { mode: 'QUICK', lat: 41.31, lon: 69.28, areaPreset: 'MEDIUM', consumption: { monthlyKwh: 400 } };

  beforeAll(async () => {
    h = await bootHarness();
    admin = await createAdmin(h);
  });
  afterAll(async () => h?.close());

  it('without a published tariff returns TARIFF_NOT_FOUND and never invents rates', async () => {
    const res = await h.post('/calculations/estimate', undefined, base);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('TARIFF_NOT_FOUND');
    expect(res.data.money.savings).toBeNull();
    expect(res.data.generation.annual).toBeGreaterThan(0);
    expect(res.data.productionMethod).toBe('DEFAULT');
    expect(res.data.warnings).toContain('SOLAR_PROVIDER_UNAVAILABLE_REGION_AVERAGE');
  });

  let tariffId: string;
  const tariffBody = {
    regionCode: 'toshkent-shahri', customerType: 'HOUSEHOLD', title: 'Test tarif', effectiveFrom: '2026-01-01',
    tiers: [{ minKwh: 0, maxKwh: 200, ratePerKwh: 600 }, { minKwh: 200, maxKwh: null, ratePerKwh: 1000 }],
  };

  it('requires a source before publishing and rejects overlapping tiers', async () => {
    const bad = await h.post('/admin/tariffs', admin.token, { ...tariffBody, tiers: [{ minKwh: 0, maxKwh: 300, ratePerKwh: 600 }, { minKwh: 200, maxKwh: null, ratePerKwh: 1000 }] });
    expect(bad.status).toBe(422);
    const created = await h.post('/admin/tariffs', admin.token, tariffBody);
    expect(created.status).toBe(201);
    tariffId = created.data.id;
    expect((await h.post(`/admin/tariffs/${tariffId}/publish`, admin.token)).status).toBe(422);
    await h.api('PUT', `/admin/tariffs/${tariffId}`, { token: admin.token, body: { ...tariffBody, sourceUrl: 'https://example.uz/tarif' } });
    expect((await h.post(`/admin/tariffs/${tariffId}/publish`, admin.token)).data.status).toBe('PUBLISHED');
  });

  it('blocks a second published tariff with an overlapping period (exclusion constraint) and edits of a published one', async () => {
    const copy = await h.post(`/admin/tariffs/${tariffId}/copy`, admin.token);
    expect(copy.data.status).toBe('DRAFT');
    const overlap = await h.post(`/admin/tariffs/${copy.data.id}/publish`, admin.token);
    expect(overlap.status).toBe(409);
    expect(overlap.body.code).toBe('TARIFF_PERIOD_OVERLAP');
    expect((await h.api('PUT', `/admin/tariffs/${tariffId}`, { token: admin.token, body: tariffBody })).body.code).toBe('TARIFF_NOT_EDITABLE');
  });

  it('computes savings, payback and a 25-year model once the tariff is published', async () => {
    const res = await h.post('/calculations/estimate', undefined, base);
    expect(res.data.status).toBe('OK');
    expect(res.data.meta.tariff.id).toBe(tariffId);
    expect(res.data.money.billWithoutSolar).toBeCloseTo(12 * (200 * 600 + 200 * 1000), -2);
    expect(res.data.money.savings).toBeGreaterThan(0);
    expect(res.data.lifetime.years).toHaveLength(25);
    expect(res.data.scenarios.low.saving).toBeLessThan(res.data.scenarios.high.saving);
    expect(res.data.meta.location).toEqual({ lat: 41.31, lon: 69.28 });
  });

  it('uses the customer’s own site areas only for the owner (optional auth)', async () => {
    const owner = await createUser(h);
    const site = await h.post('/sites', owner.token, { title: 'Uy', lat: 41.3, lon: 69.24 });
    const polygon = { type: 'Polygon', coordinates: [[[69.24, 41.3], [69.2402, 41.3], [69.2402, 41.30018], [69.24, 41.30018]]] };
    await h.post(`/sites/${site.data.id}/areas`, owner.token, { name: 'Tom', roofShape: 'FLAT', polygon });
    const mine = await h.post('/calculations/estimate', owner.token, { mode: 'DETAILED', siteId: site.data.id, consumption: { monthlyKwh: 300 } });
    expect(mine.status).toBe(200);
    expect(mine.data.projectedAreaM2).toBeGreaterThan(300);
    expect(mine.data.usableAreaM2).toBeCloseTo(mine.data.projectedAreaM2 * 0.8, 0);
    expect(mine.data.meta.siteId).toBe(site.data.id);
    const guest = await h.post('/calculations/estimate', undefined, { mode: 'DETAILED', siteId: site.data.id, consumption: { monthlyKwh: 300 } });
    expect(guest.status).toBe(404);
    const stranger = await createUser(h);
    expect((await h.post('/calculations/estimate', stranger.token, { mode: 'DETAILED', siteId: site.data.id, consumption: { monthlyKwh: 300 } })).status).toBe(404);
  });

  it('validates consumption: zero requires the «no consumption yet» flag', async () => {
    expect((await h.post('/calculations/estimate', undefined, { ...base, consumption: { monthlyKwh: 0 } })).status).toBe(422);
    expect((await h.post('/calculations/estimate', undefined, { ...base, consumption: { monthlyKwh: 0, noConsumptionYet: true } })).status).toBe(200);
  });

  it('financing estimate enforces the product’s minimum down payment', async () => {
    const product = await h.post('/admin/calc/financing', admin.token, { providerName: 'Test Bank', financingType: 'BANK_LOAN', annualRate: 0.24, minTermMonths: 6, maxTermMonths: 36, allowedTerms: [12, 24], minDownPaymentPct: 0.2, customerTypes: ['HOUSEHOLD'], sourceUrl: 'https://bank.example.uz', effectiveFrom: '2026-01-01' });
    await h.post(`/admin/calc/financing/${product.data.id}/publish`, admin.token);
    expect((await h.post('/financing/estimate', undefined, { initialCost: 50_000_000, downPayment: 1_000_000, productId: product.data.id, termMonths: 12 })).status).toBe(422);
    const ok = await h.post('/financing/estimate', undefined, { initialCost: 50_000_000, downPayment: 10_000_000, productId: product.data.id, termMonths: 12 });
    expect(ok.data.financedAmount).toBe(40_000_000);
    expect(ok.data.schedule).toHaveLength(12);
  });

  it('outage: ON_GRID has no backup number, HYBRID returns hours', async () => {
    const items = [{ code: 'FRIDGE', powerW: 150, count: 1, hoursPerDay: 24 }, { powerW: 60, count: 5, hoursPerDay: 6 }];
    const onGrid = await h.post('/outage/estimate', undefined, { systemType: 'ON_GRID', criticalItems: items });
    expect(onGrid.data.applicable).toBe(false);
    expect(onGrid.data.backupHoursNight).toBeNull();
    const hybrid = await h.post('/outage/estimate', undefined, { systemType: 'HYBRID', criticalItems: items, backupHours: 6 });
    expect(hybrid.data.applicable).toBe(true);
    expect(hybrid.data.backupHoursNight).toBeGreaterThanOrEqual(6);
  });
  describe('edge inputs (TZ 11 / 2-bosqich audit)', () => {
    it.each([
      ['negative consumption', { consumption: { monthlyKwh: -1 } }],
      ['absurd consumption', { consumption: { monthlyKwh: 1e9 } }],
      ['latitude out of range', { lat: 120 }],
      ['zero roof area', { areaM2: 0, areaPreset: undefined }],
      ['absurd budget', { budget: 1e20 }],
    ])('%s → 400, not 500', async (_label, over) => {
      const res = await h.post('/calculations/estimate', undefined, { ...base, ...over });
      expect(res.status).toBe(400);
    });

    it('zero consumption → 422 with a hint; “no consumption yet” answers with a range and no NaN', async () => {
      const zero = await h.post('/calculations/estimate', undefined, { ...base, consumption: { monthlyKwh: 0 } });
      expect(zero.status).toBe(422);
      expect(zero.body.message).toContain('Hozircha iste’mol yo‘q');
      const res = await h.post('/calculations/estimate', undefined, { ...base, consumption: { monthlyKwh: 0, noConsumptionYet: true } });
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.data)).not.toMatch(/NaN|Infinity/);
      expect(res.data.scenarios.low).toBeDefined();
      expect(res.data.scenarios.high).toBeDefined();
    });

    it('financing: huge numbers are rejected; down payment above the price finances nothing', async () => {
      expect((await h.post('/financing/estimate', undefined, { initialCost: 1e15, termMonths: 12, annualRate: 0.2 })).status).toBe(400);
      const res = await h.post('/financing/estimate', undefined, { initialCost: 10_000_000, downPayment: 12_000_000, termMonths: 12, annualRate: 0.2 });
      expect(res.status).toBe(200);
      expect(res.data.financedAmount).toBe(0);
    });
  });
});
