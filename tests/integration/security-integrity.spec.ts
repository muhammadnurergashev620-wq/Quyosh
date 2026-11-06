import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createShop, uploadImage, type Harness, type TestShop, type TestUser } from '../helpers/harness';

const rnd = (n: number) => String(Math.floor(10 ** (n - 1) + Math.random() * 9 * 10 ** (n - 1)));
const phone = () => `+99893${rnd(7)}`;

/** 1-bosqich audit: dublikat bloklash, sertifikat yuklash taqiqi, to‘xtatilgan do‘kon ko‘rinmasligi va o‘qish rejimi. */
describe('security & data integrity', () => {
  let h: Harness;
  let admin: TestUser;
  let shop: TestShop;
  const shopApi = (method: string, path: string, token: string, body?: unknown) => h.api(method, path, { cookie: `accessToken_shop=${token}`, headers: { 'x-app-panel': 'SHOP' }, body });
  const createBody = (over: Record<string, unknown> = {}) => ({ name: 'Dublikat Solar', stir: rnd(9), phone: phone(), regionCode: 'samarqand', address: 'Samarqand, Registon 1', ownerFirstName: 'Aziz', ownerLogin: `dub${rnd(6)}`, ...over });

  beforeAll(async () => {
    h = await bootHarness();
    admin = await createAdmin(h);
    shop = await createShop(h);
  });
  afterAll(async () => h?.close());

  describe('duplicate shop STIR / phone is blocked (no confirmation bypass)', () => {
    it('second shop with the same STIR or the same phone → 409', async () => {
      const first = createBody();
      expect((await h.post('/admin/shops', admin.token, first)).status).toBe(201);
      const sameStir = await h.post('/admin/shops', admin.token, createBody({ stir: first.stir }));
      expect([sameStir.status, sameStir.body.code]).toEqual([409, 'SHOP_STIR_TAKEN']);
      const samePhone = await h.post('/admin/shops', admin.token, createBody({ phone: first.phone }));
      expect([samePhone.status, samePhone.body.code]).toEqual([409, 'SHOP_PHONE_TAKEN']);
      // Eski "tasdiqlab o‘tish" maydoni endi qabul qilinmaydi.
      expect((await h.post('/admin/shops', admin.token, createBody({ phone: first.phone, confirmDuplicates: true }))).status).toBe(400);
      const dup = await h.get(`/admin/shops/duplicates?phone=${encodeURIComponent(first.phone)}`, admin.token);
      expect(dup.data.blocking).toBe(true);
    });

    it('a shop cannot switch its phone to another shop’s phone', async () => {
      const other = await createShop(h);
      const taken = phone();
      await h.db.shop.update({ where: { id: other.shopId }, data: { phone: taken } });
      const res = await shopApi('PATCH', `/manage/shops/${shop.shopId}`, shop.owner.token, { phone: taken });
      expect([res.status, res.body.code]).toEqual([409, 'SHOP_PHONE_TAKEN']);
      expect((await shopApi('PATCH', `/manage/shops/${shop.shopId}`, shop.owner.token, { phone: phone() })).status).toBe(200);
    });
  });

  describe('certificates and verification documents are admin-only (v3.1)', () => {
    it.each(['CERTIFICATE', 'VERIFICATION_DOC'])('shop owner cannot upload %s', async (kind) => {
      await expect(uploadImage(h, shop.owner.token, kind, 'Shop', shop.shopId)).rejects.toThrow(/upload failed: 403/);
    });

    it('admin can attach a certificate file to a shop', async () => {
      const id = await uploadImage(h, admin.token, 'CERTIFICATE', 'Shop', shop.shopId);
      expect(id).toMatch(/[0-9a-f-]{36}/);
    });
  });

  describe('suspended shop', () => {
    let suspended: TestShop;
    let slug: string;

    beforeAll(async () => {
      suspended = await createShop(h);
      const row = await h.db.shop.update({ where: { id: suspended.shopId }, data: { verificationStatus: 'VERIFIED' } });
      slug = row.slug;
      expect((await h.post(`/admin/shops/${suspended.shopId}/suspend`, admin.token, { reason: 'Audit tekshiruvi' })).status).toBe(201);
    });

    it('is hidden from public lists, profile and map', async () => {
      expect((await h.get(`/shops/${slug}`)).status).toBe(404);
      const list = await h.get(`/shops?q=${encodeURIComponent(slug)}`);
      expect(JSON.stringify(list.body)).not.toContain(suspended.shopId);
      const map = await h.get('/map/shops?bbox=55,37,74,46');
      expect(JSON.stringify(map.body)).not.toContain(suspended.shopId);
    });

    it('members can still read the cabinet but every write is 423 SHOP_SUSPENDED', async () => {
      expect((await shopApi('GET', `/manage/shops/${suspended.shopId}`, suspended.owner.token)).status).toBe(200);
      const write = await shopApi('PATCH', `/manage/shops/${suspended.shopId}`, suspended.owner.token, { description: 'Yangi tavsif matni' });
      expect([write.status, write.body.code]).toEqual([423, 'SHOP_SUSPENDED']);
    });
  });
});
