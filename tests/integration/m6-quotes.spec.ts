import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createShop, createUser, uploadImage, MISSING_UUID, type Harness, type TestShop, type TestUser } from '../helpers/harness';
import { seedM6 } from '../../prisma/seed-m6';
import { M6JobsService } from '../../src/modules/quote-request/m6-jobs.service';
import { QuoteService } from '../../src/modules/quote/quote.service';

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const quoteBody = {
  systemPowerKw: 5,
  items: [
    { itemType: 'EQUIPMENT', title: 'Panel 550 W', quantity: 10, unitPrice: 1_500_000 },
    { itemType: 'EQUIPMENT', title: 'Invertor 5 kW', quantity: 1, unitPrice: 9_000_000 },
    { itemType: 'INSTALLATION', title: 'Montaj', quantity: 1, unitPrice: 4_000_000 },
  ],
  deliveryCost: 300_000,
  discountAmount: 500_000,
  vatIncluded: true,
  vatRate: 12,
};
const required = { warrantyEquipmentMonths: 120, warrantyInstallationMonths: 24, durationDays: 5, includedScope: 'Uskuna, montaj, sozlash', excludedScope: 'Tomni ta’mirlash', validUntil: day(14) };

/** M6: so‘rov → yozishma → o‘lchov → taklif → revision → solishtirish → qabul → montaj → chek-list → sharh (TZ 17). */
describe('M6 quotes integration', () => {
  let h: Harness;
  let customer: TestUser;
  let a: TestShop;
  let b: TestShop;
  let calcId: string;
  let requestId: string;
  let rsA: string;
  let rsB: string;
  let quoteA: string;
  let quoteB: string;
  let installationId: string;
  const shopHeaders = { 'x-app-panel': 'SHOP' };

  // Do‘kon paneli: o‘z cookie nomi (accessToken_shop) va x-app-panel sarlavhasi.
  const shopApi = (method: string, path: string, token: string, body?: unknown) => h.api(method, path, { cookie: `accessToken_shop=${token}`, body, headers: shopHeaders });
  const shopGet = (path: string, token: string) => shopApi('GET', path, token);
  const shopPost = (path: string, token: string, body?: unknown) => shopApi('POST', path, token, body);

  beforeAll(async () => {
    h = await bootHarness();
    await seedM6(h.db as never);
    customer = await createUser(h, ['CUSTOMER'], { firstName: 'Alisher' });
    a = await createShop(h);
    b = await createShop(h);
    await h.db.shop.updateMany({ where: { id: { in: [a.shopId, b.shopId] } }, data: { verificationStatus: 'VERIFIED' } });
    const calc = await h.post('/calculations', customer.token, { input: { mode: 'QUICK', lat: 41.3123, lon: 69.2811, areaPreset: 'SMALL', consumption: { monthlyKwh: 350 } }, title: 'Uy' });
    calcId = calc.data.id;
  });
  afterAll(async () => h?.close());

  describe('quote request', () => {
    it('validates basis, shop count and only accepts verified active shops', async () => {
      expect((await h.post('/quote-requests', customer.token, { systemType: 'ON_GRID', shopIds: [a.shopId] })).body.code).toBe('QUOTE_REQUEST_BASIS_REQUIRED');
      const draft = await createShop(h, { status: 'DRAFT' });
      const bad = await h.post('/quote-requests', customer.token, { calculationId: calcId, systemType: 'ON_GRID', shopIds: [a.shopId, draft.shopId] });
      expect(bad.body.code).toBe('QUOTE_REQUEST_SHOP_UNAVAILABLE');
      expect((await h.post('/quote-requests', customer.token, { calculationId: calcId, systemType: 'ON_GRID', shopIds: Array(6).fill(a.shopId) })).status).toBe(400);
    });

    it('creates a request to two shops and notifies them', async () => {
      const res = await h.post('/quote-requests', customer.token, { calculationId: calcId, systemType: 'ON_GRID', notes: 'Tom tekis', shopIds: [a.shopId, b.shopId] });
      expect(res.status).toBe(201);
      requestId = res.data.id;
      const detail = await h.get(`/quote-requests/${requestId}`, customer.token);
      expect(detail.data.shops).toHaveLength(2);
      expect(Number(detail.data.requiredCapacityKw)).toBeGreaterThan(0);
      rsA = detail.data.shops.find((s: any) => s.shop.id === a.shopId).id;
      rsB = detail.data.shops.find((s: any) => s.shop.id === b.shopId).id;
      const events = await h.db.outboxEvent.findMany({ where: { eventName: 'QUOTE_REQUEST_RECEIVED', aggregateId: { in: [rsA, rsB] } } });
      expect(events.map((e) => (e.payload as any).userId).sort()).toEqual([a.owner.id, b.owner.id].sort());
      const limits = await h.get('/quote-requests/limits', customer.token);
      expect(limits.data).toMatchObject({ open: 1, maxOpen: 3, today: 1, maxPerDay: 5 });
    });

    it('enforces max 3 open requests', async () => {
      const second = await h.post('/quote-requests', customer.token, { calculationId: calcId, systemType: 'ON_GRID', shopIds: [a.shopId] });
      const third = await h.post('/quote-requests', customer.token, { calculationId: calcId, systemType: 'ON_GRID', shopIds: [a.shopId] });
      expect([second.status, third.status]).toEqual([201, 201]);
      const fourth = await h.post('/quote-requests', customer.token, { calculationId: calcId, systemType: 'ON_GRID', shopIds: [a.shopId] });
      expect(fourth.status).toBe(409);
      expect(fourth.body.code).toBe('QUOTE_REQUEST_OPEN_LIMIT');
      expect((await h.post(`/quote-requests/${second.data.id}/close`, customer.token)).data.status).toBe('CLOSED_NO_SELECTION');
      expect((await h.post(`/quote-requests/${third.data.id}/close`, customer.token)).status).toBe(201);
      expect((await h.post(`/quote-requests/${third.data.id}/close`, customer.token)).body.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('shop sees the request without contact data until revealed; first open → VIEWED', async () => {
      const view = await h.get(`/manage/shops/${a.shopId}/requests/${rsA}`, a.owner.token);
      expect(view.status).toBe(200);
      expect(view.data.status).toBe('VIEWED');
      expect(view.data.customer).toEqual({ firstName: 'Alisher', revealed: false });
      expect(JSON.stringify(view.data)).not.toContain(customer.phone);
      expect(view.data.calculation.systemPowerKw).toBeGreaterThan(0);
      const list = await h.get(`/manage/shops/${a.shopId}/requests`, a.owner.token);
      expect(list.data.items.map((i: any) => i.id)).toContain(rsA);
    });

    it('isolates conversations (stranger and other shop → 404)', async () => {
      const stranger = await createUser(h);
      expect((await h.get(`/request-shops/${rsA}/messages`, stranger.token)).status).toBe(404);
      expect((await shopGet(`/request-shops/${rsA}/messages`, b.owner.token)).status).toBe(404);
      expect((await h.get(`/manage/shops/${b.shopId}/requests/${rsA}`, b.owner.token)).status).toBe(404);
      expect((await h.get(`/quote-requests/${requestId}`, stranger.token)).status).toBe(404);
    });
  });

  describe('messaging and site visit', () => {
    it('clarification question and customer reply move the status; unread counts and read', async () => {
      const q = await shopPost(`/request-shops/${rsA}/messages`, a.owner.token, { body: 'Tomingiz qaysi tomonga qaragan?', asClarification: true, clientId: 'c1' });
      expect(q.status).toBe(201);
      const dup = await shopPost(`/request-shops/${rsA}/messages`, a.owner.token, { body: 'Tomingiz qaysi tomonga qaragan?', asClarification: true, clientId: 'c1' });
      expect(dup.data.id).toBe(q.data.id);
      expect((await h.db.quoteRequestShop.findUnique({ where: { id: rsA } }))!.status).toBe('CLARIFICATION_REQUESTED');
      const mine = await h.get('/quote-requests/me', customer.token);
      expect(mine.data.find((r: any) => r.id === requestId).unread).toBe(1);
      await h.post(`/request-shops/${rsA}/messages`, customer.token, { body: 'Janubga' });
      const rs = await h.db.quoteRequestShop.findUnique({ where: { id: rsA } });
      expect(rs!.status).toBe('VIEWED');
      expect(rs!.firstResponseAt).not.toBeNull();
      expect((await h.post(`/request-shops/${rsA}/messages/read`, customer.token)).data.count).toBe(1);
      const msgs = await h.get(`/request-shops/${rsA}/messages`, customer.token);
      expect(msgs.data.items[0]).toMatchObject({ body: 'Janubga', mine: true, senderSide: 'CUSTOMER' });
      expect((await h.post(`/request-shops/${rsA}/messages`, customer.token, { body: '   ' })).body.code).toBe('MESSAGE_EMPTY');
    });

    it('attachments must be uploaded for this conversation', async () => {
      const file = await uploadImage(h, customer.token, 'MESSAGE_ATTACHMENT', 'RequestShop', rsA);
      const sent = await h.post(`/request-shops/${rsA}/messages`, customer.token, { attachmentIds: [file] });
      expect(sent.status).toBe(201);
      const stranger = await createUser(h);
      await expect(uploadImage(h, stranger.token, 'MESSAGE_ATTACHMENT', 'RequestShop', rsA)).rejects.toThrow(/403/);
      const msgs = await shopGet(`/request-shops/${rsA}/messages`, a.owner.token);
      expect(msgs.data.items[0].attachments[0]).toMatchObject({ id: file, status: 'READY' });
    });

    it('site visit: shop proposes, customer confirms → contact revealed; .ics available', async () => {
      const start = new Date(Date.now() + 2 * 86_400_000);
      const slots = [0, 1].map((i) => ({ start: new Date(start.getTime() + i * 86_400_000).toISOString(), end: new Date(start.getTime() + i * 86_400_000 + 7_200_000).toISOString() }));
      expect((await h.post(`/request-shops/${rsA}/site-visits`, customer.token, { slots })).status).toBe(403);
      expect((await shopPost(`/request-shops/${rsA}/site-visits`, a.owner.token, { slots: [{ start: new Date(Date.now() - 1000).toISOString(), end: new Date().toISOString() }] })).body.code).toBe('SITE_VISIT_SLOTS_INVALID');
      const visit = await shopPost(`/request-shops/${rsA}/site-visits`, a.owner.token, { slots, notes: 'O‘lchov 1 soat' });
      expect(visit.status).toBe(201);
      const ok = await h.patch(`/request-shops/${rsA}/site-visits/${visit.data.id}`, customer.token, { action: 'CONFIRM', slotIndex: 1 });
      expect(ok.data.status).toBe('CONFIRMED');
      const view = await h.get(`/manage/shops/${a.shopId}/requests/${rsA}`, a.owner.token);
      expect(view.data.customer).toMatchObject({ revealed: true, phone: customer.phone, lastName: 'User' });
      const ics = await h.api('GET', `/request-shops/${rsA}/site-visits/${visit.data.id}/ics`, { token: customer.token });
      expect(ics.status).toBe(200);
      expect(ics.headers.get('content-type')).toContain('text/calendar');
    });
  });

  describe('quotes', () => {
    it('drafts compute totals on the server; send requires mandatory fields', async () => {
      const draft = await h.post(`/quote-requests/${requestId}/quotes`, a.owner.token, { shopId: a.shopId, ...quoteBody });
      expect(draft.status).toBe(201);
      quoteA = draft.data.id;
      expect(draft.data.total).toBe('27800000');
      expect(draft.data.equipmentSubtotal).toBe('24000000');
      expect(draft.data.pricePerKw).toBe(5_560_000);
      expect((await h.get(`/quotes/${quoteA}`, customer.token)).status).toBe(404);
      expect((await h.post(`/quotes/${quoteA}/send`, a.owner.token)).body.code).toBe('QUOTE_INCOMPLETE');
      const stale = await h.patch(`/quotes/${quoteA}`, a.owner.token, { version: 99, ...required });
      expect(stale.body.code).toBe('VERSION_CONFLICT');
      const upd = await h.patch(`/quotes/${quoteA}`, a.owner.token, { version: draft.data.version, ...required, financingOptions: [{ financingType: 'BANK_LOAN', providerName: 'Demo bank', annualRate: 0.24, termMonths: 24 }] });
      expect(upd.status).toBe(200);
      expect(upd.data.financingOptions[0].monthlyPayment).toBeGreaterThan(0);
      expect((await h.post(`/quote-requests/${requestId}/quotes`, a.owner.token, { shopId: a.shopId, ...quoteBody })).body.code).toBe('QUOTE_ACTIVE_EXISTS');
      const negative = await h.patch(`/quotes/${quoteA}`, a.owner.token, { version: upd.data.version, discountAmount: 999_000_000 });
      expect(negative.body.code).toBe('QUOTE_TOTAL_NEGATIVE');
    });

    it('STAFF without quote.send cannot send', async () => {
      const staff = await createUser(h, ['CUSTOMER', 'SHOP']);
      await h.db.shopMember.create({ data: { shopId: a.shopId, userId: staff.id, memberRole: 'STAFF', permissions: ['requests.read', 'quote.draft'] } });
      expect((await h.post(`/quotes/${quoteA}/send`, staff.token)).status).toBe(403);
    });

    it('send → revision 1, QUOTED; customer opens → VIEWED; revise → revision 2 and SENT again', async () => {
      const sent = await h.post(`/quotes/${quoteA}/send`, a.owner.token);
      expect(sent.data).toMatchObject({ status: 'SENT', currentRevision: 1 });
      expect((await h.db.quoteRequestShop.findUnique({ where: { id: rsA } }))!.status).toBe('QUOTED');
      expect(await h.db.outboxEvent.count({ where: { eventName: 'QUOTE_RECEIVED', aggregateId: quoteA } })).toBe(1);
      expect((await h.get(`/quotes/${quoteA}`, customer.token)).data.status).toBe('VIEWED');
      const current = await h.get(`/quotes/${quoteA}`, a.owner.token);
      const revised = await h.post(`/quotes/${quoteA}/revise`, a.owner.token, { version: current.data.version, discountAmount: 800_000 });
      expect(revised.data).toMatchObject({ status: 'SENT', currentRevision: 2, total: '27500000' });
      const r1 = await h.get(`/quotes/${quoteA}/revisions/1`, customer.token);
      expect(r1.data.snapshotJson.total).toBe('27800000');
      expect((await h.post(`/quotes/${quoteA}/send`, a.owner.token)).body.code).toBe('QUOTE_NOT_DRAFT');
    });

    it('second shop quotes; compare returns badges and payback ranges', async () => {
      const draft = await h.post(`/quote-requests/${requestId}/quotes`, b.owner.token, { shopId: b.shopId, ...quoteBody, ...required, durationDays: 3, warrantyEquipmentMonths: 60, items: [{ itemType: 'EQUIPMENT', title: 'Komplekt 5 kW', quantity: 1, unitPrice: 32_000_000 }] });
      quoteB = draft.data.id;
      expect((await h.post(`/quotes/${quoteB}/send`, b.owner.token)).status).toBe(201);
      const cmp = await h.get(`/quote-requests/${requestId}/compare`, customer.token);
      expect(cmp.data.quotes).toHaveLength(2);
      const qa = cmp.data.quotes.find((q: any) => q.id === quoteA);
      const qb = cmp.data.quotes.find((q: any) => q.id === quoteB);
      expect(qa.badges).toEqual(expect.arrayContaining(['CHEAPEST_PER_KW', 'LONGEST_WARRANTY']));
      expect(qb.badges).toEqual(['FASTEST_INSTALL']);
      expect(qa.paybackRange === null || qa.paybackRange[0] <= qa.paybackRange[1]).toBe(true);
    });

    it('accept closes the request, rejects the other quote and creates an installation', async () => {
      expect((await h.post(`/quotes/${quoteA}/accept`, a.owner.token)).status).toBe(404);
      const res = await h.post(`/quotes/${quoteA}/accept`, customer.token);
      expect(res.data.status).toBe('ACCEPTED');
      installationId = res.data.installationId;
      expect((await h.db.quoteRequest.findUnique({ where: { id: requestId } }))!.status).toBe('CLOSED_SELECTED');
      expect((await h.db.quoteRequestShop.findUnique({ where: { id: rsA } }))).toMatchObject({ status: 'SELECTED', pipelineStage: 'WON' });
      expect((await h.db.quoteRequestShop.findUnique({ where: { id: rsB } }))).toMatchObject({ status: 'NOT_SELECTED', pipelineStage: 'LOST' });
      expect((await h.db.quote.findUnique({ where: { id: quoteB } }))!.status).toBe('REJECTED');
      expect(await h.db.outboxEvent.count({ where: { eventName: 'QUOTE_NOT_SELECTED', aggregateId: rsB } })).toBe(1);
      const inst = await h.get(`/installations/${installationId}`, customer.token);
      expect(inst.data.status).toBe('SITE_VISIT_SCHEDULED');
      expect((await h.post(`/quotes/${quoteB}/accept`, customer.token)).body.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('PDF is available to both sides', async () => {
      const pdf = await h.api('GET', `/quotes/${quoteA}/pdf?lang=oz`, { token: customer.token });
      expect(pdf.status).toBe(200);
      expect(pdf.headers.get('content-type')).toBe('application/pdf');
    });
  });

  describe('installation and review', () => {
    it('only the shop moves the installation; confirm needs a complete checklist', async () => {
      expect((await h.patch(`/installations/${installationId}`, customer.token, { action: 'MARK_INSTALLED' })).status).toBe(403);
      const scheduled = await shopApi('PATCH', `/installations/${installationId}`, a.owner.token, { action: 'SCHEDULE', scheduledDate: day(3) });
      expect(scheduled.data.status).toBe('INSTALLATION_SCHEDULED');
      expect((await h.post(`/installations/${installationId}/confirm`, customer.token, {})).body.code).toBe('INVALID_STATUS_TRANSITION');
      const done = await shopApi('PATCH', `/installations/${installationId}`, a.owner.token, { action: 'MARK_INSTALLED' });
      expect(done.data.status).toBe('INSTALLED');
      expect((await h.post(`/installations/${installationId}/confirm`, customer.token, {})).body.code).toBe('CHECKLIST_INCOMPLETE');
    });

    it('checklist: photo required for inverter, comment for issues; then confirm creates the installed system', async () => {
      const list = await h.get(`/installations/${installationId}/checklist`, customer.token);
      const items = list.data.items as Array<{ code: string; photoRequired: boolean }>;
      expect(items.some((i) => i.code === 'BATTERY')).toBe(false);
      const answers = items.map((i) => ({ code: i.code, status: 'OK' }));
      const saved = await h.api('PUT', `/installations/${installationId}/checklist`, { token: customer.token, body: { items: answers } });
      expect(saved.data.evaluation.errors).toEqual([{ code: 'INVERTER_RUNNING', reason: 'PHOTO_REQUIRED' }]);
      const photo = await uploadImage(h, customer.token, 'MESSAGE_ATTACHMENT', 'Installation', installationId);
      const withIssue = answers.map((x) => (x.code === 'INVERTER_RUNNING' ? { ...x, photoFileIds: [photo] } : x.code === 'CLEANUP' ? { ...x, status: 'ISSUE', comment: 'Tomda qoldiq bor' } : x));
      const saved2 = await h.api('PUT', `/installations/${installationId}/checklist`, { token: customer.token, body: { items: withIssue } });
      expect(saved2.data.evaluation).toMatchObject({ complete: true, hasIssues: true });
      expect((await h.post(`/installations/${installationId}/confirm`, customer.token, {})).body.code).toBe('CHECKLIST_INCOMPLETE');
      expect((await h.post(`/installations/${installationId}/request-fix`, customer.token)).status).toBe(201);
      const confirmed = await h.post(`/installations/${installationId}/confirm`, customer.token, { acceptWithIssues: true });
      expect(confirmed.data.status).toBe('CONFIRMED');
      expect(confirmed.data.installedSystem).not.toBeNull();
      const system = await h.db.installedSystem.findUnique({ where: { installationId }, include: { warranties: true } });
      expect(system!.warranties.map((w) => w.component).sort()).toEqual(['Montaj', 'Uskuna']);
      expect(await h.db.outboxEvent.count({ where: { eventName: 'INSTALLATION_ISSUE_REPORTED', aggregateId: installationId } })).toBeGreaterThanOrEqual(1);
    });

    it('review: published with risk flags, rating updated, one per installation, shop replies once', async () => {
      const res = await h.post('/reviews', customer.token, { installationId, rating: 5, comment: 'Juda yaxshi ishladi, tavsiya qilaman' });
      expect(res.status).toBe(201);
      expect(res.data.moderationStatus).toBe('PUBLISHED');
      const row = await h.db.review.findUnique({ where: { id: res.data.id } });
      expect(row!.riskFlags).toContain('FAST_CONFIRM');
      expect((await h.db.shop.findUnique({ where: { id: a.shopId } }))!.ratingCount).toBe(1);
      expect((await h.post('/reviews', customer.token, { installationId, rating: 4 })).body.code).toBe('REVIEW_EXISTS');
      const reply = await h.post(`/manage/shops/${a.shopId}/reviews/${res.data.id}/reply`, a.owner.token, { body: 'Rahmat!' });
      expect(reply.status).toBe(201);
      expect((await h.post(`/manage/shops/${a.shopId}/reviews/${res.data.id}/reply`, a.owner.token, { body: 'Yana' })).body.code).toBe('REVIEW_REPLY_EXISTS');
      const slug = (await h.db.shop.findUnique({ where: { id: a.shopId } }))!.slug;
      const pub = await h.get(`/shops/${slug}/reviews`);
      expect(pub.data.items[0]).toMatchObject({ rating: 5, author: 'Alisher', reply: { body: 'Rahmat!' } });
      expect(JSON.stringify(pub.data)).not.toContain('FAST_CONFIRM');
    });

    it('review is not allowed before confirmation or by others', async () => {
      const other = await createUser(h);
      expect((await h.post('/reviews', other.token, { installationId, rating: 1 })).body.code).toBe('REVIEW_NOT_ALLOWED');
      expect((await h.post('/reviews', customer.token, { installationId: MISSING_UUID, rating: 1 })).body.code).toBe('REVIEW_NOT_ALLOWED');
    });
  });

  describe('favorites, complaints and jobs', () => {
    it('favorite requires exactly one target and is idempotent', async () => {
      expect((await h.post('/favorites', customer.token, {})).body.code).toBe('FAVORITE_TARGET_INVALID');
      const f1 = await h.post('/favorites', customer.token, { shopId: a.shopId });
      const f2 = await h.post('/favorites', customer.token, { shopId: a.shopId });
      expect(f1.data.id).toBe(f2.data.id);
      expect((await h.get('/favorites', customer.token)).data).toHaveLength(1);
      expect((await h.del(`/favorites?shopId=${a.shopId}`, customer.token)).data.removed).toBe(1);
    });

    it('complaint against a shop is recorded', async () => {
      const res = await h.post('/complaints', customer.token, { targetType: 'SHOP', targetId: b.shopId, reason: 'WRONG_INFO', details: 'Narx noto‘g‘ri' });
      expect(res.data.status).toBe('OPEN');
    });

    it('quote-expiry and request-expiry jobs move statuses', async () => {
      const req = await h.post('/quote-requests', customer.token, { calculationId: calcId, systemType: 'ON_GRID', shopIds: [b.shopId] });
      const draft = await h.post(`/quote-requests/${req.data.id}/quotes`, b.owner.token, { shopId: b.shopId, ...quoteBody, ...required });
      await h.post(`/quotes/${draft.data.id}/send`, b.owner.token);
      await h.db.quote.update({ where: { id: draft.data.id }, data: { validUntil: new Date(`${day(-2)}T00:00:00Z`) } });
      const result = await h.app.get(QuoteService).expireAndWarn();
      expect(result.expired).toBeGreaterThanOrEqual(1);
      expect((await h.db.quote.findUnique({ where: { id: draft.data.id } }))!.status).toBe('EXPIRED');
      await h.db.quoteRequest.update({ where: { id: req.data.id }, data: { lastActivityAt: new Date(Date.now() - 31 * 86_400_000) } });
      await h.app.get(M6JobsService).expireIdleRequests();
      expect((await h.db.quoteRequest.findUnique({ where: { id: req.data.id } }))!.status).toBe('EXPIRED');
      const rs = await h.db.quoteRequestShop.findFirst({ where: { requestId: req.data.id } });
      expect(rs!.status).toBe('NOT_SELECTED');
    });
  });
});
