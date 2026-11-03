import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createShop, createUser, tokenFor, uploadImage, MISSING_UUID, type Harness, type TestShop, type TestUser } from '../helpers/harness';
import { seedM6 } from '../../prisma/seed-m6';
import { seedKnowledge } from '../../prisma/seed-knowledge';
import { InstalledSystemService } from '../../src/modules/installed-system/installed-system.service';
import { ShopContentService } from '../../src/modules/shop-content/shop-content.service';
import { SupportService } from '../../src/modules/support/support.service';
import { UsersService } from '../../src/modules/users/users.service';

const monthAgo = (n: number) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 7); };

/** M7: kabinet, portfolio, sertifikatlar, vidjet, analitika, yordam, bilimlar, hisobni o‘chirish. */
describe('M7 integration', () => {
  let h: Harness;
  let customer: TestUser;
  let shop: TestShop;
  let admin: TestUser;

  beforeAll(async () => {
    h = await bootHarness();
    await seedM6(h.db as never);
    await seedKnowledge(h.db as never);
    customer = await createUser(h, ['CUSTOMER'], { firstName: 'Bobur' });
    shop = await createShop(h);
    await h.db.shop.update({ where: { id: shop.shopId }, data: { verificationStatus: 'VERIFIED' } });
    admin = await createAdmin(h);
  });
  afterAll(async () => h?.close());

  describe('installed system cabinet', () => {
    let id: string;
    it('customer adds an external system with warranties and default reminders', async () => {
      const installedAt = new Date(Date.now() - 200 * 86_400_000).toISOString().slice(0, 10);
      const res = await h.post('/installed-systems', customer.token, { title: 'Dala hovli', systemPowerKw: 5, systemType: 'ON_GRID', installedAt, warranties: [{ component: 'Invertor', months: 60 }] });
      expect(res.status).toBe(201);
      id = res.data.id;
      expect(res.data.reminders.map((r: any) => r.type).sort()).toEqual(['CLEANING', 'INSPECTION', 'WARRANTY_EXPIRY']);
      expect(res.data.warranties[0].daysLeft).toBeGreaterThan(1000);
      expect((await h.get(`/installed-systems/${id}`, (await createUser(h)).token)).status).toBe(404);
    });

    it('readings: kWh or meter diff; future month rejected; deviation flagged against expected', async () => {
      await h.db.installedSystem.update({ where: { id }, data: { expectedMonthlyKwhJson: Array(12).fill(600) } });
      const r1 = await h.post(`/installed-systems/${id}/readings`, customer.token, { period: monthAgo(2), generatedKwh: 590, meterReading: 1000 });
      expect(r1.data.reading).toMatchObject({ generatedKwh: 590, alert: false });
      const r2 = await h.post(`/installed-systems/${id}/readings`, customer.token, { period: monthAgo(1), meterReading: 1400 });
      expect(r2.data.reading).toMatchObject({ generatedKwh: 400, alert: true });
      expect(r2.data.reading.deviation).toBeCloseTo(-0.333, 2);
      expect((await h.post(`/installed-systems/${id}/readings`, customer.token, { period: '2099-01', generatedKwh: 1 })).body.code).toBe('READING_PERIOD_INVALID');
      expect((await h.post(`/installed-systems/${id}/readings`, customer.token, { period: monthAgo(1), meterReading: 100 })).body.code).toBe('READING_METER_DECREASED');
    });

    it('reminder actions and the daily job send each due reminder once', async () => {
      const sys = await h.get(`/installed-systems/${id}`, customer.token);
      const cleaning = sys.data.reminders.find((r: any) => r.type === 'CLEANING');
      await h.db.maintenanceReminder.update({ where: { id: cleaning.id }, data: { nextAt: new Date(Date.now() - 1000) } });
      const svc = h.app.get(InstalledSystemService);
      const first = await svc.sendDueReminders();
      expect(first.sent).toBeGreaterThanOrEqual(1);
      expect((await svc.sendDueReminders()).sent).toBe(0);
      expect(await h.db.outboxEvent.count({ where: { eventName: 'MAINTENANCE_REMINDER', aggregateId: id } })).toBe(1);
      const done = await h.patch(`/installed-systems/${id}/reminders/${cleaning.id}`, customer.token, { action: 'DONE' });
      expect(new Date(done.data.nextAt).getTime()).toBeGreaterThan(Date.now() + 80 * 86_400_000);
      const snoozed = await h.patch(`/installed-systems/${id}/reminders/${cleaning.id}`, customer.token, { action: 'SNOOZE' });
      expect(new Date(snoozed.data.nextAt).getTime()).toBeGreaterThan(new Date(done.data.nextAt).getTime());
    });
  });

  describe('portfolio and certifications', () => {
    let certId: string;
    it('portfolio with images is public; foreign images are rejected', async () => {
      const img = await uploadImage(h, shop.owner.token, 'PORTFOLIO', 'Shop', shop.shopId);
      const p = await h.post(`/manage/shops/${shop.shopId}/projects`, shop.owner.token, { title: 'Chilonzor, 8 kVt', city: 'Toshkent', systemPowerKw: 8, systemType: 'HYBRID', imageIds: [img] });
      expect(p.status).toBe(201);
      const other = await createShop(h);
      const foreign = await uploadImage(h, other.owner.token, 'PORTFOLIO', 'Shop', other.shopId);
      expect((await h.post(`/manage/shops/${shop.shopId}/projects`, shop.owner.token, { title: 'XY', imageIds: [foreign] })).body.code).toBe('PROJECT_IMAGE_INVALID');
      const slug = (await h.db.shop.findUniqueOrThrow({ where: { id: shop.shopId } })).slug;
      const pub = await h.get(`/shops/${slug}/projects`);
      expect(pub.data[0]).toMatchObject({ title: 'Chilonzor, 8 kVt', verifiedInstallation: false });
      expect(pub.data[0].images[0].url).toContain('/media/file/');
    });

    it('certification: dealer needs brand; admin approves; badge public; expired hidden', async () => {
      const file = await uploadImage(h, shop.owner.token, 'CERTIFICATE', 'Shop', shop.shopId);
      expect((await h.post(`/manage/shops/${shop.shopId}/certifications`, shop.owner.token, { certType: 'OFFICIAL_DEALER', issuer: 'Longi', fileId: file, validFrom: '2026-01-01' })).body.code).toBe('CERTIFICATION_BRAND_REQUIRED');
      const c = await h.post(`/manage/shops/${shop.shopId}/certifications`, shop.owner.token, { certType: 'OFFICIAL_DEALER', brand: 'Longi', issuer: 'Longi Solar', fileId: file, validFrom: '2026-01-01', validUntil: '2030-01-01' });
      certId = c.data.id;
      expect(c.data.status).toBe('PENDING');
      expect((await h.get('/shops?cert=OFFICIAL_DEALER')).data.items.map((s: any) => s.id)).not.toContain(shop.shopId);
      expect((await h.api('PATCH', `/admin/certifications/${certId}`, { token: admin.token, body: { decision: 'APPROVED' } })).data.status).toBe('APPROVED');
      const listed = await h.get('/shops?cert=OFFICIAL_DEALER');
      expect(listed.data.items.find((s: any) => s.id === shop.shopId).certifications).toEqual([{ certType: 'OFFICIAL_DEALER', brand: 'Longi' }]);
      await h.db.shopCertification.update({ where: { id: certId }, data: { validUntil: new Date('2026-01-02') } });
      const job = await h.app.get(ShopContentService).certificationExpiry();
      expect(job.expired).toBeGreaterThanOrEqual(1);
      expect((await h.get('/shops?cert=OFFICIAL_DEALER')).data.items.map((s: any) => s.id)).not.toContain(shop.shopId);
    });
  });

  describe('widget', () => {
    let key: string;
    it('config validates domains and checks contrast', async () => {
      const cfg = await h.get(`/manage/shops/${shop.shopId}/widget`, shop.owner.token);
      key = cfg.data.publicKey;
      expect(cfg.data.active).toBe(false);
      expect((await h.api('PUT', `/manage/shops/${shop.shopId}/widget`, { token: shop.owner.token, body: { allowedDomains: ['not a domain'] } })).body.code).toBe('WIDGET_DOMAIN_INVALID');
      const upd = await h.api('PUT', `/manage/shops/${shop.shopId}/widget`, { token: shop.owner.token, body: { allowedDomains: ['https://shop.example.uz/page'], active: true, theme: { primaryColor: '#ffd84d' } } });
      expect(upd.data.allowedDomains).toEqual(['shop.example.uz']);
      expect(upd.data.contrast.ok).toBe(false);
      expect(upd.data.contrast.suggestion).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('frame sets frame-ancestors from allowed domains; estimate works', async () => {
      const res = await fetch(`${h.baseUrl}/api/v1/widget/${key}/frame`);
      expect(res.status).toBe(200);
      const csp = res.headers.get('content-security-policy') ?? '';
      expect(csp).toContain('frame-ancestors https://shop.example.uz http://shop.example.uz');
      expect(res.headers.get('x-frame-options')).toBeNull();
      expect(await res.text()).toContain('Quyosh');
      const est = await h.post(`/widget/${key}/estimate`, undefined, { regionCode: 'toshkent-shahri', monthlyKwh: 350 });
      expect(est.data.systemPowerKw).toBeGreaterThan(0);
      expect((await fetch(`${h.baseUrl}/api/v1/widget/nope/frame`)).status).toBe(404);
    });

    it('lead via OTP creates an account and a WIDGET request to this shop only', async () => {
      const phone = `+99893${String(Date.now()).slice(-7)}`;
      const otp = await h.post(`/widget/${key}/otp`, undefined, { phone });
      expect(otp.data.developmentCode).toMatch(/^\d{6}$/);
      expect((await h.post(`/widget/${key}/lead`, undefined, { regionCode: 'toshkent-shahri', monthlyKwh: 350, phone, code: otp.data.developmentCode, firstName: 'Jasur', consent: false })).body.code).toBe('POLICY_ACCEPTANCE_MISSING');
      const lead = await h.post(`/widget/${key}/lead`, undefined, { regionCode: 'toshkent-shahri', monthlyKwh: 350, phone, code: otp.data.developmentCode, firstName: 'Jasur', consent: true });
      expect(lead.status).toBe(201);
      expect(lead.data.accountCreated).toBe(true);
      const req = await h.db.quoteRequest.findFirstOrThrow({ where: { number: lead.data.requestNumber }, include: { shops: true, user: true } });
      expect(req.source).toBe('WIDGET');
      expect(req.shops.map((s) => s.shopId)).toEqual([shop.shopId]);
      expect(req.user.phoneVerifiedAt).not.toBeNull();
    });
  });

  describe('analytics and dashboards', () => {
    it('ingests allowlisted events without PII and aggregates for the shop', async () => {
      const bad = await h.post('/analytics/events', undefined, { anonymousId: 'anon-12345678', events: [{ eventType: 'evil_event' }] });
      expect(bad.status).toBe(400);
      const ok = await h.post('/analytics/events', undefined, { anonymousId: 'anon-12345678', events: [{ eventType: 'shop_view', shopId: shop.shopId, properties: { phone: '+998901234567', tab: 'overview' } }, { eventType: 'home_view' }] });
      expect(ok.status).toBe(202);
      const ev = await h.db.analyticsEvent.findFirstOrThrow({ where: { shopId: shop.shopId, eventType: 'shop_view' } });
      expect(ev.propertiesJson).toEqual({ tab: 'overview' });
      const a = await h.get(`/manage/shops/${shop.shopId}/analytics`, shop.owner.token);
      expect(a.data.totals.views).toBeGreaterThanOrEqual(1);
      expect(a.data.totals.widgetRequests).toBe(1);
      expect((await h.get(`/manage/shops/${shop.shopId}/analytics?from=2020-01-01&to=2026-12-01`, shop.owner.token)).body.code).toBe('ANALYTICS_RANGE_INVALID');
      const funnel = await h.get('/admin/analytics/funnel', admin.token);
      expect(funnel.data.steps[0]).toMatchObject({ step: 'HOME' });
      const dash = await h.get(`/manage/shops/${shop.shopId}/dashboard`, shop.owner.token);
      expect(dash.data.kpis.newRequests).toBe(1);
      expect(dash.data.replyToday).toHaveLength(1);
      expect((await h.get('/me/dashboard', customer.token)).data.actions).toBeDefined();
      const q = await h.get('/admin/queues', admin.token);
      expect(q.data.queues.find((x: any) => x.key === 'support')).toBeDefined();
    });
  });

  describe('knowledge center', () => {
    it('lists ≥20 published materials in 3 languages, searches, serves sitemap with hreflang', async () => {
      const list = await h.get('/knowledge/articles?limit=50');
      expect(list.data.total).toBeGreaterThanOrEqual(20);
      expect(list.data.items[0].titleI18n).toHaveProperty('oz');
      expect((await h.get('/knowledge/beginner')).data).toHaveLength(5);
      const found = await h.get('/knowledge/articles?q=akkumulyator');
      expect(found.data.items.some((a: any) => a.slug === 'akkumulyator-tanlash')).toBe(true);
      const art = await h.get('/knowledge/articles/kontakt-qachon-ochiladi');
      expect(art.data.bodyI18n.ru).toContain('контакт');
      const sm = await fetch(`${h.baseUrl}/api/v1/sitemap.xml`);
      const xml = await sm.text();
      expect(xml).toContain('hreflang="ru"');
      expect(xml).toContain('/mijoz/bilim/platforma/kontakt-qachon-ochiladi');
      expect((await h.get('/support/suggestions?q=sharh')).data.length).toBeGreaterThan(0);
    });
  });

  describe('support center', () => {
    it('customer ticket: SLA due, IDOR 404, agent reply/internal note, resolve, rate, autoclose', async () => {
      const t = await h.post('/support/tickets', customer.token, { category: 'INSTALLATION', subject: 'Montaj kechikdi', body: 'Do‘kon javob bermayapti' });
      expect(t.data.code).toMatch(/^SUP-\d{6}$/);
      expect(new Date(t.data.firstResponseDueAt).getTime()).toBeGreaterThan(Date.now());
      const stranger = await createUser(h);
      expect((await h.get(`/support/tickets/${t.data.id}`, stranger.token)).status).toBe(404);
      expect((await h.post('/support/tickets', customer.token, { category: 'OTHER', subject: 'Xatolar', body: 'Bog‘liq', relatedType: 'Installation', relatedId: MISSING_UUID })).status).toBe(404);
      await h.post(`/admin/support/tickets/${t.data.id}/messages`, admin.token, { body: 'Ichki: do‘konga qo‘ng‘iroq qildim', internal: true });
      const reply = await h.post(`/admin/support/tickets/${t.data.id}/messages`, admin.token, { body: 'Do‘kon bilan bog‘landik' });
      expect(reply.data.firstRespondedAt).not.toBeNull();
      expect(reply.data.status).toBe('WAITING_USER');
      const mine = await h.get(`/support/tickets/${t.data.id}`, customer.token);
      expect(mine.data.messages.map((m: any) => m.body)).not.toContain('Ichki: do‘konga qo‘ng‘iroq qildim');
      expect((await h.post(`/support/tickets/${t.data.id}/rate`, customer.token, { score: 5 })).body.code).toBe('TICKET_RATE_NOT_ALLOWED');
      await h.post(`/support/tickets/${t.data.id}/resolve`, customer.token);
      expect((await h.post(`/support/tickets/${t.data.id}/rate`, customer.token, { score: 5 })).data.satisfaction).toBe(5);
      await h.db.supportTicket.update({ where: { id: t.data.id }, data: { resolvedAt: new Date(Date.now() - 8 * 86_400_000) } });
      expect((await h.app.get(SupportService).autoclose()).closed).toBeGreaterThanOrEqual(1);
      expect((await h.post(`/support/tickets/${t.data.id}/messages`, customer.token, { body: 'yana' })).body.code).toBe('TICKET_CLOSED');
    });

    it('guest ticket with phone OTP is visible after login with the same phone', async () => {
      const phone = `+99894${String(Date.now()).slice(-7)}`;
      const otp = await h.post('/support/guest-otp', undefined, { phone });
      const t = await h.post('/support/tickets', undefined, { category: 'ACCOUNT', subject: 'Kira olmayapman', body: 'Kod kelmayapti', guest: { phone, code: otp.data.developmentCode, name: 'Dilnoza' } });
      expect(t.status).toBe(201);
      expect((await h.post('/support/tickets', undefined, { category: 'ACCOUNT', subject: 'xyz', body: 'yyyyy' })).status).toBe(403);
      const user = await h.db.user.create({ data: { phone, status: 'ACTIVE', firstName: 'Dilnoza', userRoles: { create: { role: 'CUSTOMER' } }, deviceSessions: { create: { deviceId: 'dev-guest-1' } } } });
      const token = await tokenFor(h, user.id, ['CUSTOMER']);
      expect((await h.get('/support/tickets', token)).data.map((x: any) => x.id)).toContain(t.data.id);
    });

    it('SLA watch warns support admins once', async () => {
      const t = await h.post('/support/tickets', customer.token, { category: 'SECURITY', subject: 'Shubhali kirish', body: 'Notanish qurilma' });
      await h.db.supportTicket.update({ where: { id: t.data.id }, data: { firstResponseDueAt: new Date(Date.now() - 60_000) } });
      const svc = h.app.get(SupportService);
      expect((await svc.slaWatch()).warned).toBeGreaterThanOrEqual(1);
      const again = await svc.slaWatch();
      expect(again.warned).toBe(0);
    });
  });

  describe('account deletion', () => {
    it('schedules deletion, can be cancelled, then anonymizes after 14 days', async () => {
      const u = await createUser(h, ['CUSTOMER'], { firstName: 'Olim' });
      await h.post('/sites', u.token, { title: 'Uy', siteType: 'HOUSE', address: 'Toshkent, Yunusobod 4', lat: 41.36, lon: 69.28 });
      const del = await h.post('/users/me/delete-account', u.token, {});
      expect(del.status).toBe(201);
      expect(new Date(del.data.scheduledAt).getTime()).toBeGreaterThan(Date.now() + 13 * 86_400_000);
      expect((await h.get('/users/me', u.token)).status).toBe(401);
      const token = await tokenFor(h, u.id, ['CUSTOMER']);
      expect((await h.post('/users/me/delete-account/cancel', token)).data.cancelled).toBe(true);
      await h.post('/users/me/delete-account', token, {});
      await h.db.user.update({ where: { id: u.id }, data: { deletionScheduledAt: new Date(Date.now() - 1000) } });
      await h.app.get(UsersService).anonymizeDue();
      const row = await h.db.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(row).toMatchObject({ status: 'DELETED', email: null, firstName: 'O‘chirilgan foydalanuvchi' });
      expect(row.phone).toMatch(/^del\d+$/);
      expect(await h.db.customerSite.count({ where: { userId: u.id } })).toBe(0);
    });
  });
});
