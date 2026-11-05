import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashSecret } from '../../src/common/security/hash';
import { bootHarness, createAdmin, createSuperAdmin, createUser, MISSING_UUID, tokenFor, type Harness, type TestUser } from '../helpers/harness';

/**
 * M2 (do‘konlar, katalog, import) va M3 (PostGIS: obyektlar, xizmat hududi, xarita) — haqiqiy Postgres + PostGIS bilan.
 */
describe('M2/M3 integration', () => {
  let h: Harness;
  let owner!: TestUser;
  let shopId: string;
  let branchId: string;
  const PANEL = 'Quyosh Test Montaj';

  beforeAll(async () => {
    h = await bootHarness();
  });
  afterAll(async () => h?.close());

  describe('shops', () => {
    it('admin creates an ACTIVE/VERIFIED shop with an owner account and a first branch', async () => {
      const admin = await createAdmin(h);
      const res = await h.post('/admin/shops', admin.token, { name: PANEL, stir: '312345678', phone: '+998 90 111 22 33', regionCode: 'toshkent-shahri', address: 'Toshkent, Chilonzor 9', ownerFirstName: 'Aziz', ownerPhone: '+998 90 555 00 01' });
      expect(res.status).toBe(201);
      expect(res.data.shop).toMatchObject({ status: 'ACTIVE', verificationStatus: 'VERIFIED', createdSource: 'ADMIN' });
      shopId = res.data.shop.id;
      // Qolgan testlar uchun: egasi parolni almashtirgan deb hisoblaymiz (to‘liq oqim — m7-shop-admin.spec.ts).
      await h.db.user.update({ where: { id: res.data.owner.id }, data: { mustPasswordChange: false } });
      owner = { id: res.data.owner.id, phone: res.data.owner.phone, roles: ['SHOP'], token: await tokenFor(h, res.data.owner.id, ['SHOP']) };
      const roles = await h.db.userRole.findMany({ where: { userId: owner.id } });
      expect(roles.map((r) => r.role)).toEqual(['SHOP']);
      const mine = await h.get('/me/shops', owner.token);
      expect(mine.data[0]).toMatchObject({ id: shopId, memberRole: 'OWNER' });
      expect(await h.db.shopBranch.count({ where: { shopId } })).toBe(1);
    });

    it('rejects a duplicate STIR and a login phone that already belongs to an account', async () => {
      const admin = await createAdmin(h);
      const base = { name: 'Dup', phone: '+998901112234', regionCode: 'toshkent-shahri', address: 'Toshkent, Yunusobod', ownerFirstName: 'Vali' };
      expect((await h.post('/admin/shops', admin.token, { ...base, stir: '312345678', ownerPhone: '+998905550002' })).body.code).toBe('SHOP_STIR_TAKEN');
      const taken = await h.post('/admin/shops', admin.token, { ...base, stir: '312345679', ownerPhone: owner.phone });
      expect(taken.status).toBe(409);
      expect(taken.body.code).toBe('PHONE_TAKEN');
    });

    it('a customer cannot open a shop and the old self-service endpoints are gone', async () => {
      const customer = await createUser(h);
      expect((await h.post('/shops', customer.token, { name: 'Mening do‘konim', phone: '+998901112299' })).status).toBe(404);
      expect((await h.post(`/manage/shops/${shopId}/submit`, owner.token)).status).toBe(404);
      expect((await h.post(`/manage/shops/${shopId}/members/invitations`, owner.token, { target: '+998901112298', memberRole: 'STAFF' })).status).toBe(404);
    });

    it('hides other shops behind 404 (no existence leak)', async () => {
      const stranger = await createUser(h);
      expect((await h.get(`/manage/shops/${shopId}`, stranger.token)).status).toBe(404);
      expect((await h.get(`/manage/shops/${MISSING_UUID}`, owner.token)).status).toBe(404);
    });

    it('enforces member permissions (STAFF cannot write branches)', async () => {
      const staff = await createUser(h, ['CUSTOMER', 'SHOP']);
      await h.db.shopMember.create({ data: { shopId, userId: staff.id, memberRole: 'STAFF', permissions: ['catalog.read'] } });
      const res = await h.post(`/manage/shops/${shopId}/branches`, staff.token, { name: 'X filial', address: 'Toshkent' });
      expect(res.status).toBe(403);
      expect((await h.get(`/manage/shops/${shopId}/branches`, staff.token)).status).toBe(200);
    });

    it('creates a branch with a map point (region derived) and detects stale versions', async () => {
      const res = await h.post(`/manage/shops/${shopId}/branches`, owner.token, { name: 'Chilonzor', address: 'Toshkent, Chilonzor 9', lat: 41.2856, lon: 69.2034 });
      expect(res.status).toBe(201);
      branchId = res.data.id;
      expect(res.data.regionCode).toBe('toshkent-shahri');
      const list = await h.get(`/manage/shops/${shopId}/branches`, owner.token);
      expect(list.data.find((b: { id: string }) => b.id === branchId)).toMatchObject({ lat: 41.2856, lon: 69.2034, hasServiceArea: false });
      const first = await h.api('PUT', `/manage/shops/${shopId}/branches/${branchId}`, { token: owner.token, body: { name: 'Chilonzor-1', address: 'Toshkent', version: 1, lat: 41.2856, lon: 69.2034 } });
      expect(first.status).toBe(200);
      const stale = await h.api('PUT', `/manage/shops/${shopId}/branches/${branchId}`, { token: owner.token, body: { name: 'Eski', address: 'Toshkent', version: 1 } });
      expect(stale.body.code).toBe('VERSION_CONFLICT');
    });

    it('an admin-created shop is public right away and hides the phone', async () => {
      const pub = await h.get('/shops/' + (await h.db.shop.findUniqueOrThrow({ where: { id: shopId } })).slug);
      expect(pub.status).toBe(200);
      expect(pub.data.phone).toBeUndefined();
      expect(pub.data.phoneMasked).toMatch(/\*\*\*/);
    });

    it('suspension makes the panel read-only (423)', async () => {
      const admin = await createSuperAdmin(h);
      await h.post(`/admin/shops/${shopId}/suspend`, admin.token, { reason: 'Test to‘xtatish' });
      const write = await h.post(`/manage/shops/${shopId}/services`, owner.token, { serviceType: 'INSTALLATION', pricingModel: 'PER_KW', price: '1000000' });
      expect(write.status).toBe(423);
      expect((await h.get(`/manage/shops/${shopId}`, owner.token)).status).toBe(200);
      await h.post(`/admin/shops/${shopId}/resume`, admin.token);
    });
  });

  describe('catalog', () => {
    let modelId: string;
    let modelSlug: string;

    beforeAll(async () => {
      const category = await h.db.category.findFirstOrThrow({ where: { slug: 'invertorlar' } });
      const model = await h.db.productModel.create({ data: { categoryId: category.id, brand: 'TestBrand', model: 'INV-8K', slug: 'testbrand-inv-8k', status: 'APPROVED', inverterAcKw: '8' } });
      modelId = model.id;
      modelSlug = model.slug;
      await h.db.exchangeRate.upsert({ where: { currency_rateDate: { currency: 'USD', rateDate: new Date('2026-10-30') } }, update: {}, create: { currency: 'USD', rateToUzs: '12000', rateDate: new Date('2026-10-30'), source: 'test' } });
    });

    it('adds a product with a USD offer and lists the sum equivalent publicly', async () => {
      const res = await h.post(`/manage/shops/${shopId}/products`, owner.token, { productModelId: modelId, offer: { price: '1000', currency: 'USD', branchId } });
      expect(res.status).toBe(201);
      const offers = await h.get(`/product-models/${modelSlug}/offers`);
      expect(offers.data.items[0]).toMatchObject({ price: '1000', currency: 'USD', priceUzs: '12000000.00' });
      const list = await h.get('/product-models?q=testbrand');
      expect(list.data.items[0]).toMatchObject({ minPriceUzs: '12000000.00', offerCount: 1 });
    });

    it('rejects a negative price and an inverted date range', async () => {
      const product = await h.db.shopProduct.findFirstOrThrow({ where: { shopId, productModelId: modelId } });
      expect((await h.post(`/manage/shops/${shopId}/products/${product.id}/offers`, owner.token, { price: '-1' })).status).toBe(400);
      expect((await h.post(`/manage/shops/${shopId}/products/${product.id}/offers`, owner.token, { price: '1', validFrom: '2026-12-01', validUntil: '2026-11-01' })).status).toBe(422);
    });

    it('validates a CSV import row by row and applies only the valid rows', async () => {
      const csv = 'brand,model,price,currency,stock_status\nTestBrand,INV-8K,1100,USD,IN_STOCK\nNoBrand,Nope,100,UZS,IN_STOCK\n';
      const form = new FormData();
      form.append('file', new Blob([csv], { type: 'text/csv' }), 'narx.csv');
      const upload = await h.api('POST', `/manage/shops/${shopId}/imports`, { token: owner.token, form });
      expect(upload.data).toMatchObject({ status: 'VALIDATED', rowCount: 2, validCount: 1, errorCount: 1 });
      expect(upload.data.errors[0]).toMatchObject({ row: 3, column: 'model' });
      const applied = await h.post(`/manage/shops/${shopId}/imports/${upload.data.id}/apply`, owner.token);
      expect(applied.data).toMatchObject({ applied: 1, created: 1 });
      expect((await h.post(`/manage/shops/${shopId}/imports/${upload.data.id}/apply`, owner.token)).body.code).toBe('IMPORT_NOT_VALIDATED');
    });
  });

  describe('geo (PostGIS)', () => {
    const customer = { token: '' };
    let siteId: string;

    beforeAll(async () => {
      customer.token = (await createUser(h)).token;
    });

    it('stores a service area by radius and finds the shop as serving a nearby point', async () => {
      const area = await h.api('PUT', `/manage/shops/${shopId}/branches/${branchId}/service-area`, { token: owner.token, body: { radiusKm: 10 } });
      expect(area.status).toBe(200);
      expect(Number(area.data.areaKm2)).toBeGreaterThan(300);
      expect(Number(area.data.areaKm2)).toBeLessThan(320);
      const near = await h.get('/map/shops/serving?lat=41.30&lon=69.24');
      expect(near.data.some((s: { id: string }) => s.id === shopId)).toBe(true);
      const far = await h.get('/map/shops/serving?lat=39.65&lon=66.96');
      expect(far.data.some((s: { id: string }) => s.id === shopId)).toBe(false);
    });

    it('rejects a service area larger than 20 000 km²', async () => {
      const big = { type: 'Polygon', coordinates: [[[60, 38], [70, 38], [70, 44], [60, 44], [60, 38]]] };
      const res = await h.api('PUT', `/manage/shops/${shopId}/branches/${branchId}/service-area`, { token: owner.token, body: { geometry: big } });
      expect(res.body.code).toBe('POLYGON_TOO_LARGE');
    });

    it('clusters below zoom 13 and returns markers above it', async () => {
      const clusters = await h.get('/map/shops?west=55&south=37&east=74&north=46&zoom=5');
      expect(clusters.data.mode).toBe('clusters');
      expect(clusters.data.items.reduce((sum: number, item: { count: number }) => sum + item.count, 0)).toBeGreaterThanOrEqual(1);
      const markers = await h.get('/map/shops?west=69.1&south=41.2&east=69.4&north=41.4&zoom=14');
      expect(markers.data.mode).toBe('markers');
      expect(markers.data.items.some((m: { shop: { id: string } }) => m.shop.id === shopId)).toBe(true);
    });

    it('computes site areas on the server (TZ 11.3)', async () => {
      const site = await h.post('/sites', customer.token, { title: 'Uy', lat: 41.3, lon: 69.24 });
      expect(site.status).toBe(201);
      siteId = site.data.id;
      expect(site.data.regionCode).toBe('toshkent-shahri');
      const polygon = { type: 'Polygon', coordinates: [[[69.24, 41.3], [69.24012, 41.3], [69.24012, 41.30009], [69.24, 41.30009]]] };
      const flat = await h.post(`/sites/${siteId}/areas`, customer.token, { name: 'Tom', roofShape: 'FLAT', polygon });
      expect(Number(flat.data.projectedAreaM2)).toBeCloseTo(100.46, 0);
      expect(Number(flat.data.usableAreaM2)).toBeCloseTo(Number(flat.data.projectedAreaM2) * 0.8, 1);
      const pitched = await h.patch(`/sites/${siteId}/areas/${flat.data.id}`, customer.token, { roofShape: 'PITCHED', tiltDeg: 30 });
      expect(Number(pitched.data.surfaceAreaM2)).toBeCloseTo(Number(flat.data.projectedAreaM2) / Math.cos(Math.PI / 6), 0);
      expect(Number(pitched.data.usableFactor)).toBe(0.7);
    });

    it('rejects self-intersecting and oversized polygons', async () => {
      const bowtie = { type: 'Polygon', coordinates: [[[69.24, 41.3], [69.241, 41.301], [69.241, 41.3], [69.24, 41.301]]] };
      expect((await h.post(`/sites/${siteId}/areas`, customer.token, { name: 'X', polygon: bowtie })).body.code).toBe('POLYGON_INVALID');
      const huge = { type: 'Polygon', coordinates: [[[69.2, 41.3], [69.3, 41.3], [69.3, 41.4], [69.2, 41.4]]] };
      expect((await h.post(`/sites/${siteId}/areas`, customer.token, { name: 'X', polygon: huge })).body.code).toBe('POLYGON_TOO_LARGE');
    });

    it('keeps sites private to their owner', async () => {
      const other = await createUser(h);
      expect((await h.get(`/sites/${siteId}`, other.token)).status).toBe(404);
      expect((await h.get(`/sites/${siteId}`, customer.token)).data.areas).toHaveLength(1);
    });
  });

  describe('login OTP cooldown', () => {
    it('a second login within the resend window continues with the previous code instead of failing with 429', async () => {
      const user = await createUser(h);
      const passwordHash = await hashSecret('Parol-12345', 4);
      await h.db.user.update({ where: { id: user.id }, data: { passwordHash, twoFactorEnabled: true } });
      const body = { phone: user.phone, password: 'Parol-12345' };
      const first = await h.api('POST', '/auth/login', { headers: { 'x-app-panel': 'CUSTOMER' }, body });
      expect(first.status).toBe(201);
      expect(first.data.verificationRequired).toBe(true);
      expect(first.data.codeReused).toBeUndefined();
      const second = await h.api('POST', '/auth/login', { headers: { 'x-app-panel': 'CUSTOMER' }, body });
      expect(second.status).toBe(201);
      expect(second.data.verificationRequired).toBe(true);
      expect(second.data.codeReused).toBe(true);
      expect(second.data.resendIn).toBeGreaterThan(0);
      expect(await h.db.otpCode.count({ where: { phone: user.phone, purpose: 'LOGIN' } })).toBe(1);
    });
  });
});
