import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bootHarness, createAdmin, createShop, createUser, MISSING_UUID, waitFor, type Harness, type TestShop, type TestUser } from '../helpers/harness';
import { NotificationChannelsService } from '../../src/modules/notification-channels/notification-channels.service';
import { OpsService } from '../../src/modules/ops/ops.service';
import { ProviderStatsService } from '../../src/modules/ops/provider-stats.service';
import { SiteService } from '../../src/modules/site/site.service';
import { M6Notifier } from '../../src/modules/quote-request/m6-notifier.service';
import { SmsService } from '../../src/infrastructure/sms/sms.service';
import { MailProvider } from '../../src/infrastructure/mail/mail.provider';

const SECRET = 'test-ops-webhook-secret';
const sign = (raw: string) => `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}`;
const shopCookie = (token: string) => ({ cookie: `accessToken_shop=${token}`, headers: { 'x-app-panel': 'SHOP' } });

/** M7 qo‘shimcha: SMS/email kanallari, ops (kvota, alert, deploy), taklif shablonlari, bosh sahifa CMS. */
describe('M7 channels, ops, quote templates, site CMS', () => {
  let h: Harness;
  let customer: TestUser;
  let shop: TestShop;
  let admin: TestUser;

  beforeAll(async () => {
    process.env.OPS_WEBHOOK_SECRET = SECRET;
    h = await bootHarness();
    customer = await createUser(h, ['CUSTOMER'], { firstName: 'Dilnoza' });
    await h.db.user.update({ where: { id: customer.id }, data: { email: `c-${randomUUID().slice(0, 8)}@example.uz` } });
    shop = await createShop(h);
    admin = await createAdmin(h);
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await h?.close();
  });

  describe('notification channels', () => {
    const event = (eventName: string, userId: string) => ({ outboxEventId: randomUUID(), eventName, userId, title: 'Yangi taklif', body: 'Do‘kon «Quyosh» 5 kVt tizim uchun taklif yubordi', payload: { entityType: 'Quote', entityId: randomUUID() } });

    it('creates SMS and email records per channel, idempotent by outbox event; in-app list stays IN_APP only', async () => {
      const svc = h.app.get(NotificationChannelsService);
      const sms = h.app.get(SmsService);
      vi.spyOn(sms, 'isEnabled').mockReturnValue(true);
      const send = vi.spyOn(sms, 'send').mockResolvedValue();
      const mail = vi.spyOn(h.app.get(MailProvider), 'sendMail').mockResolvedValue();
      expect((await h.api('PUT', '/me/notification-preferences', { token: customer.token, body: { type: 'QUOTE_RECEIVED', channels: ['SMS', 'EMAIL'] } })).status).toBe(200);

      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-02T07:00:00Z')); // 12:00 Toshkent
      const e = event('QUOTE_RECEIVED', customer.id);
      await svc.onNotification(e);
      await svc.onNotification(e);
      vi.useRealTimers();

      const rows = await h.db.notification.findMany({ where: { userId: customer.id, channel: { in: ['SMS', 'EMAIL'] } } });
      expect(rows.map((r) => `${r.channel}:${r.status}`).sort()).toEqual(['EMAIL:SENT', 'SMS:SENT']);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]![1]).toMatch(/^\[Quyosh\] Yangi taklif: Do'kon "Quyosh"/);
      expect(send.mock.calls[0]![1].length).toBeLessThanOrEqual(160);
      expect(mail.mock.calls[0]![0].text).toContain('/mijoz/takliflar/');

      const list = await h.get('/notifications', customer.token);
      expect(list.status).toBe(200);
      const items = (list.data.items ?? list.data) as Array<{ channel?: string }>;
      expect(items.every((n) => !n.channel || n.channel === 'IN_APP')).toBe(true);
    });

    it('night SMS waits until 08:00 Tashkent; security alerts go immediately; scheduled job delivers', async () => {
      const svc = h.app.get(NotificationChannelsService);
      const sms = h.app.get(SmsService);
      vi.spyOn(sms, 'isEnabled').mockReturnValue(true);
      vi.spyOn(sms, 'send').mockResolvedValue();
      const user = await createUser(h, ['CUSTOMER']);
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-02T18:30:00Z')); // 23:30 Toshkent
      await svc.onNotification(event('QUOTE_RECEIVED', user.id));
      await svc.onNotification(event('SECURITY_ALERT', user.id));
      vi.useRealTimers();
      const rows = await h.db.notification.findMany({ where: { userId: user.id, channel: 'SMS' }, orderBy: { createdAt: 'asc' } });
      const quote = rows.find((r) => r.template === 'QUOTE_RECEIVED')!;
      const security = rows.find((r) => r.template === 'SECURITY_ALERT')!;
      expect(quote.status).toBe('PENDING');
      expect(quote.scheduledFor?.toISOString()).toBe('2026-11-03T03:00:00.000Z');
      expect(security.status).toBe('SENT');
      expect((await svc.sendScheduled(new Date('2026-11-03T02:59:00Z'))).sent).toBe(0);
      expect((await svc.sendScheduled(new Date('2026-11-03T03:01:00Z'))).sent).toBeGreaterThanOrEqual(1);
      expect((await h.db.notification.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe('SENT');
    });

    it('preferences: audience filter, locked security alert, disabled channel is skipped', async () => {
      const prefs = await h.get('/me/notification-preferences', customer.token);
      const types = prefs.data.items.map((i: { type: string }) => i.type);
      expect(types).toContain('QUOTE_RECEIVED');
      expect(types).not.toContain('QUOTE_REQUEST_RECEIVED');
      expect(prefs.data.items.find((i: { type: string }) => i.type === 'SECURITY_ALERT').locked).toBe(true);
      expect((await h.api('PUT', '/me/notification-preferences', { token: customer.token, body: { type: 'SECURITY_ALERT', channels: [] } })).status).toBe(400);
      await h.api('PUT', '/me/notification-preferences', { token: customer.token, body: { type: 'QUOTE_REVISED', channels: [] } });
      await h.app.get(NotificationChannelsService).onNotification(event('QUOTE_REVISED', customer.id));
      expect(await h.db.notification.count({ where: { userId: customer.id, template: 'QUOTE_REVISED', channel: { in: ['SMS', 'EMAIL'] } } })).toBe(0);
    });
  });

  describe('ops: webhooks, quota poll, alerts', () => {
    it('rejects unsigned/forged webhooks and records deploys', async () => {
      const body = JSON.stringify({ service: 'api', environment: 'staging', version: '1.4.0', status: 'SUCCEEDED', gitSha: 'abcdef1234' });
      expect((await h.api('POST', '/ops/webhooks/deploy', { rawBody: body })).status).toBe(401);
      expect((await h.api('POST', '/ops/webhooks/deploy', { rawBody: body, headers: { 'x-quyosh-signature': sign(`${body} `) } })).status).toBe(401);
      const ok = await h.api('POST', '/ops/webhooks/deploy', { rawBody: body, headers: { 'x-quyosh-signature': sign(body) } });
      expect(ok.status).toBe(200);
      const list = await h.get('/admin/ops/deployments', admin.token);
      expect(list.data[0]).toMatchObject({ service: 'api', version: '1.4.0', status: 'SUCCEEDED' });
      expect(list.data[0].finishedAt).not.toBeNull();
    });

    it('alertmanager alerts are stored once, can be acknowledged and resolved', async () => {
      const startsAt = '2026-11-01T10:00:00Z';
      const payload = (status: string) => JSON.stringify({ alerts: [{ status, fingerprint: 'fp-api-5xx', startsAt, endsAt: '2026-11-01T10:20:00Z', labels: { alertname: 'Api5xxHigh', severity: 'critical' }, annotations: { summary: '5xx > 2%' } }] });
      const firing = payload('firing');
      await h.api('POST', '/ops/webhooks/alertmanager', { rawBody: firing, headers: { 'x-quyosh-signature': sign(firing) } });
      await h.api('POST', '/ops/webhooks/alertmanager', { rawBody: firing, headers: { 'x-quyosh-signature': sign(firing) } });
      const alerts = (await h.get('/admin/ops/alerts', admin.token)).data.filter((a: { fingerprint: string }) => a.fingerprint === 'fp-api-5xx');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({ severity: 'CRITICAL', status: 'FIRING', summary: '5xx > 2%' });
      expect((await h.get('/admin/devops', admin.token)).data.openAlerts).toBeGreaterThanOrEqual(1);
      expect((await h.post(`/admin/ops/alerts/${alerts[0].id}/ack`, admin.token)).data).toEqual({ acknowledged: true });
      expect(await h.db.auditLog.count({ where: { action: 'OPS_ALERT_ACK', targetId: alerts[0].id } })).toBe(1);
      const resolved = payload('resolved');
      await h.api('POST', '/ops/webhooks/alertmanager', { rawBody: resolved, headers: { 'x-quyosh-signature': sign(resolved) } });
      expect((await h.db.opsAlertEvent.findUniqueOrThrow({ where: { id: alerts[0].id } })).status).toBe('RESOLVED');
      expect((await h.get('/admin/ops/alerts', customer.token)).status).toBe(403);
    });

    it('malformed alertmanager payloads are bounded and never 500', async () => {
      const body = JSON.stringify({ alerts: [null, 'x', { startsAt: 'not-a-date', labels: { alertname: 'Weird', severity: 7, instance: { a: 1 } }, annotations: { summary: 'x'.repeat(5000) } }] });
      const res = await h.api('POST', '/ops/webhooks/alertmanager', { rawBody: body, headers: { 'x-quyosh-signature': sign(body) } });
      expect(res.status).toBe(200);
      expect(res.data.received).toBe(1);
      const row = await h.db.opsAlertEvent.findFirstOrThrow({ where: { alertName: 'Weird' } });
      expect(row.severity).toBe('WARNING');
      expect(row.summary.length).toBeLessThanOrEqual(500);
      expect(row.labelsJson).toEqual({ alertname: 'Weird' });
      const evil = JSON.stringify({ service: 'api', environment: 'prod', version: '9', status: 'SUCCEEDED', changelogUrl: 'javascript:alert(1)' });
      expect((await h.api('POST', '/ops/webhooks/deploy', { rawBody: evil, headers: { 'x-quyosh-signature': sign(evil) } })).status).toBe(400);
    });

    it('quota poll snapshots usage and alerts at 80% once per month', async () => {
      process.env.PVGIS_MONTHLY_LIMIT = '10';
      const stats = h.app.get(ProviderStatsService);
      for (let i = 0; i < 9; i += 1) await stats.record('PVGIS', true);
      const ops = h.app.get(OpsService);
      await ops.pollQuotas();
      await ops.pollQuotas();
      const pv = (await ops.providers()).find((p) => p.provider === 'PVGIS')!;
      expect(pv.usage).toBeGreaterThanOrEqual(80);
      expect(await h.db.providerQuotaSnapshot.count({ where: { provider: 'PVGIS' } })).toBeGreaterThanOrEqual(2);
      expect(await h.db.opsAlertEvent.count({ where: { alertName: { contains: 'PVGIS' } } })).toBe(1);
      delete process.env.PVGIS_MONTHLY_LIMIT;
    });
  });

  describe('security regressions', () => {
    it('no generic admin mail endpoint; in-app notifications keep entityType for deep links', async () => {
      expect((await h.post('/mail/send', admin.token, { to: 'x@example.com', subject: 'Hi', text: 'phish' })).status).toBe(404);
      const entityId = randomUUID();
      await h.db.$transaction((tx) => h.app.get(M6Notifier).toUser(tx, customer.id, { type: 'QUOTE_RECEIVED', title: 'Yangi taklif', body: 'Sinov', entityType: 'Quote', entityId }));
      const row = await waitFor(() => h.db.notification.findFirst({ where: { userId: customer.id, channel: 'IN_APP', data: { path: ['entityId'], equals: entityId } } }), { timeoutMs: 15_000, label: 'in-app notification' });
      expect(row.data).toMatchObject({ entityId, entityType: 'Quote' });
    });
  });

  describe('quote templates', () => {
    const base = () => `/manage/shops/${shop.shopId}/quote-templates`;
    it('CRUD within the shop; other shops cannot touch it', async () => {
      const opts = shopCookie(shop.owner.token);
      const body = { name: '5 kVt gibrid', items: [{ itemType: 'INSTALLATION', title: 'Montaj', quantity: 1, unitPrice: 3_000_000 }], defaults: { warrantyEquipmentMonths: 60, durationDays: 3, includedScope: 'Montaj, sozlash', vatIncluded: true, vatRate: 12 } };
      const created = await h.api('POST', base(), { ...opts, body });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ name: '5 kVt gibrid', defaults: { durationDays: 3 } });
      expect((await h.api('POST', base(), { ...opts, body: { ...body, defaults: { validUntil: '2030-01-01' } } })).status).toBe(400);
      const list = await h.api('GET', base(), opts);
      expect(list.data).toHaveLength(1);
      const updated = await h.api('PUT', `${base()}/${created.data.id}`, { ...opts, body: { ...body, name: '5 kVt gibrid v2' } });
      expect(updated.data.name).toBe('5 kVt gibrid v2');
      const other = await createShop(h);
      const foreign = await h.api('PUT', `/manage/shops/${other.shopId}/quote-templates/${created.data.id}`, { ...shopCookie(other.owner.token), body });
      expect(foreign.status).toBe(404);
      expect((await h.api('DELETE', `${base()}/${created.data.id}`, opts)).status).toBe(200);
      expect((await h.api('GET', base(), opts)).data).toHaveLength(0);
    });
  });

  describe('site CMS', () => {
    it('seeds default blocks; public home has blocks, live stats and only PUBLISHED testimonials', async () => {
      await h.app.get(SiteService).ensureDefaults();
      const reviewer = await createUser(h, ['CUSTOMER'], { firstName: 'Sardor' });
      const mk = async (status: 'PUBLISHED' | 'PENDING', comment: string) => {
        const request = await h.db.quoteRequest.create({ data: { userId: reviewer.id, title: 'Uy', systemType: 'HYBRID' } });
        const quote = await h.db.quote.create({ data: { requestId: request.id, shopId: shop.shopId, createdById: shop.owner.id, systemPowerKw: 6 } });
        const inst = await h.db.installation.create({ data: { quoteId: quote.id, requestId: request.id, userId: reviewer.id, shopId: shop.shopId, status: 'CONFIRMED', confirmedAt: new Date() } });
        await h.db.review.create({ data: { userId: reviewer.id, shopId: shop.shopId, installationId: inst.id, rating: 5, comment, moderationStatus: status } });
      };
      await mk('PUBLISHED', 'Montaj o‘z vaqtida, tizim yaxshi ishlayapti, rahmat!');
      await mk('PENDING', 'Bu sharh hali moderatsiyada, ko‘rinmasligi kerak.');
      const home = await h.get('/site/home');
      expect(home.status).toBe(200);
      expect(home.data.blocks.map((b: { type: string }) => b.type)).toEqual(['HERO', 'STATS', 'STATEMENT', 'HOW_IT_WORKS', 'TRUST', 'TESTIMONIALS', 'FAQ', 'FINALE']);
      expect(home.data.blocks[0].content.ru.titleA).toBeTruthy();
      // v3.1: bosh sayt faqat mijoz uchun — migratsiya va standart matnlarda do‘konga oid narsa yo‘q.
      expect(JSON.stringify(home.data.blocks)).not.toMatch(/ctaSecondary|shopTitle|shopCta|Men do‘kon egasiman|Do‘konni qanday ochaman/);
      expect(home.data.stats.confirmedInstallations).toBeGreaterThanOrEqual(2);
      const comments = home.data.testimonials.map((t: { comment: string }) => t.comment);
      expect(comments).toContain('Montaj o‘z vaqtida, tizim yaxshi ishlayapti, rahmat!');
      expect(comments.join(' ')).not.toContain('moderatsiyada');
      expect(home.data.testimonials[0].author).toBe('Sardor U.');
    });

    it('draft → preview → publish (version + audit), restore old version, hide and reorder', async () => {
      const site = h.app.get(SiteService);
      const blocks = (await h.get('/admin/site-blocks', admin.token)).data as Array<{ id: string; type: string; version: number; content: Record<string, Record<string, unknown>> }>;
      const statement = blocks.find((b) => b.type === 'STATEMENT')!;
      const draft = { uz: { label: 'Quyosh', text: 'Yangi shior matni' }, ru: { label: 'Солнце', text: 'Новый слоган' } };
      expect((await h.api('PUT', `/admin/site-blocks/${statement.id}/draft`, { token: admin.token, body: { content: { uz: { text: '' }, ru: { text: 'x' } } } })).status).toBe(400);
      const saved = await h.api('PUT', `/admin/site-blocks/${statement.id}/draft`, { token: admin.token, body: { content: draft } });
      expect(saved.data.draft.uz.text).toBe('Yangi shior matni');

      const publicBefore = (await site.home()).blocks.find((b) => b.type === 'STATEMENT')!;
      expect((publicBefore.content as typeof draft).uz.text).not.toBe('Yangi shior matni');
      const preview = await h.get('/admin/site-blocks/preview', admin.token);
      expect(preview.data.blocks.find((b: { type: string }) => b.type === 'STATEMENT').content.uz.text).toBe('Yangi shior matni');
      expect((await h.get('/admin/site-blocks/preview', customer.token)).status).toBe(403);

      const published = await h.post(`/admin/site-blocks/${statement.id}/publish`, admin.token);
      expect(published.data).toMatchObject({ version: statement.version + 1, draft: null });
      expect((await h.post(`/admin/site-blocks/${statement.id}/publish`, admin.token)).body.code).toBe('SITE_BLOCK_NO_DRAFT');
      const live = (await h.get('/site/home')).data.blocks.find((b: { type: string }) => b.type === 'STATEMENT');
      expect(live.content.uz.text).toBe('Yangi shior matni');

      const versions = await h.get(`/admin/site-blocks/${statement.id}/versions`, admin.token);
      expect(versions.data[0].version).toBe(statement.version + 1);
      const audit = await h.db.auditLog.findFirstOrThrow({ where: { action: 'SITE_BLOCK_PUBLISHED', targetId: statement.id } });
      expect((audit.before as { content: typeof draft }).content.uz.text).toBe(statement.content.uz!.text);
      const restored = await h.post(`/admin/site-blocks/${statement.id}/versions/${versions.data[0].id}/restore`, admin.token);
      expect(restored.data.draft.uz.text).toBe('Yangi shior matni');
      await h.post(`/admin/site-blocks/${statement.id}/discard`, admin.token);

      const faq = blocks.find((b) => b.type === 'FAQ')!;
      await h.patch(`/admin/site-blocks/${faq.id}`, admin.token, { hidden: true });
      expect((await h.get('/site/home')).data.blocks.map((b: { type: string }) => b.type)).not.toContain('FAQ');
      const hero = blocks.find((b) => b.type === 'HERO')!;
      expect((await h.patch(`/admin/site-blocks/${hero.id}`, admin.token, { hidden: true })).status).toBe(422);

      const movable = blocks.filter((b) => !['HERO', 'FINALE'].includes(b.type)).map((b) => b.id).reverse();
      const reordered = await h.post('/admin/site-blocks/reorder', admin.token, { ids: movable });
      expect(reordered.data.map((b: { type: string }) => b.type)).toEqual(['HERO', 'FAQ', 'TESTIMONIALS', 'TRUST', 'HOW_IT_WORKS', 'STATEMENT', 'STATS', 'FINALE']);
      expect((await h.post('/admin/site-blocks/reorder', admin.token, { ids: movable.slice(1) })).status).toBe(400);
      expect((await h.post(`/admin/site-blocks/${MISSING_UUID}/publish`, admin.token)).status).toBe(404);
    });
  });
});
