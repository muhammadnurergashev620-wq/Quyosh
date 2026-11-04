import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bootHarness, createAdmin, createUser, MISSING_UUID, type Harness, type TestUser } from '../helpers/harness';

const shopHeaders = { 'x-app-panel': 'SHOP' };
// Bir xil qurilma cookie’si: har kirish yangi qurilma bo‘lib, panel boshiga 2 qurilma chegarasiga urilmasin.
const DEVICE = 'test-owner-device-0123456789abcdef0123456789';
const cookieOf = (res: { headers: Headers }, name: string) => {
  const raw = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(';')[0]! : null;
};

/** v3.1: do‘konni admin yaratadi; do‘kon login + parol bilan kiradi; birinchi kirishda parol almashtirish majburiy. */
describe('Shop created by admin (TZ 3.5, 3.7, 6.4)', () => {
  let h: Harness;
  let admin: TestUser;
  let shopId: string;
  let ownerId: string;
  let ownerPhone: string;
  let tempPassword: string;
  let session = '';

  const create = (over: Record<string, unknown> = {}) =>
    h.post('/admin/shops', admin.token, { name: 'Quyosh Diler', stir: String(300_000_000 + Math.floor(Math.random() * 99_999_999)), phone: '+998901000001', regionCode: 'samarqand', address: 'Samarqand, Registon 1', ownerFirstName: 'Aziza', ownerLastName: 'Karimova', ownerPhone: `+99890${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`, ...over });

  beforeAll(async () => {
    h = await bootHarness();
    admin = await createAdmin(h);
  });
  afterAll(async () => h?.close());

  it('admin creates the shop and sees the temporary password exactly once; only a hash is stored and nothing is logged', async () => {
    const log = vi.spyOn(console, 'log');
    const res = await create();
    expect(res.status).toBe(201);
    tempPassword = res.data.temporaryPassword;
    expect(tempPassword).toHaveLength(16);
    shopId = res.data.shop.id;
    ownerId = res.data.owner.id;
    ownerPhone = res.data.owner.phone;
    expect(res.data.shop).toMatchObject({ status: 'ACTIVE', verificationStatus: 'VERIFIED', createdSource: 'ADMIN' });

    const user = await h.db.user.findUniqueOrThrow({ where: { id: ownerId }, include: { userRoles: true, shopMemberships: true } });
    expect(user.mustPasswordChange).toBe(true);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user.passwordHash).not.toContain(tempPassword);
    expect(user.userRoles.map((r) => r.role)).toEqual(['SHOP']);
    expect(user.shopMemberships[0]).toMatchObject({ shopId, memberRole: 'OWNER' });

    // Parol hech qayerga: audit, javob keshlari (detail) va jurnalga tushmaydi.
    const audits = JSON.stringify(await h.db.auditLog.findMany({ where: { OR: [{ targetId: shopId }, { targetId: ownerId }] } }));
    expect(audits).not.toContain(tempPassword);
    expect(JSON.stringify((await h.get(`/admin/shops/${shopId}`, admin.token)).data)).not.toContain(tempPassword);
    expect(JSON.stringify(log.mock.calls)).not.toContain(tempPassword);
    expect(await h.db.auditLog.count({ where: { action: 'SHOP_CREATED', targetId: shopId } })).toBe(1);
  });

  it('requires admin permission and validates input', async () => {
    const customer = await createUser(h);
    expect((await h.post('/admin/shops', customer.token, {})).status).toBe(403);
    expect((await create({ stir: '12' })).status).toBe(400);
    expect((await create({ regionCode: 'mars' })).status).toBe(400);
  });

  it('owner logs in with phone + password only (no OTP); other panels and wrong passwords are refused', async () => {
    const wrong = await h.api('POST', '/auth/login', { headers: shopHeaders, cookie: `deviceId_shop=${DEVICE}`, body: { phone: ownerPhone, password: 'Noto‘g‘ri-parol-123' } });
    expect(wrong.status).toBe(401);
    const res = await h.api('POST', '/auth/login', { headers: shopHeaders, cookie: `deviceId_shop=${DEVICE}`, body: { phone: ownerPhone, password: tempPassword } });
    expect(res.status).toBe(201);
    expect(res.data.verificationRequired).toBe(false);
    expect(res.data.mustPasswordChange).toBe(true);
    expect(await h.db.otpCode.count({ where: { phone: ownerPhone } })).toBe(0);
    session = [cookieOf(res, 'accessToken_shop'), cookieOf(res, 'deviceId_shop')].filter(Boolean).join('; ');
    expect(session).toContain('accessToken_shop=');
  });

  it('until the password is changed every other shop endpoint is 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const opts = { headers: shopHeaders, cookie: session };
    expect((await h.api('GET', '/users/me', opts)).data.mustPasswordChange).toBe(true);
    expect((await h.api('GET', '/me/shops', opts)).status).toBe(200);
    for (const [method, path] of [['GET', `/manage/shops/${shopId}`], ['GET', `/manage/shops/${shopId}/members`], ['GET', '/notifications'], ['GET', `/manage/shops/${shopId}/dashboard`]] as const) {
      const r = await h.api(method, path, opts);
      expect(r.status, path).toBe(403);
      expect(r.body.code, path).toBe('PASSWORD_CHANGE_REQUIRED');
    }
  });

  it('first password: must differ from the temporary one, then everything opens', async () => {
    const opts = { headers: shopHeaders, cookie: session };
    expect((await h.api('POST', '/users/me/password/first', { ...opts, body: { newPassword: 'short' } })).status).toBe(400);
    expect((await h.api('POST', '/users/me/password/first', { ...opts, body: { newPassword: tempPassword } })).status).toBe(400);
    const ok = await h.api('POST', '/users/me/password/first', { ...opts, body: { newPassword: 'Yangi-Parol-2026!' } });
    expect(ok.status).toBe(201);
    expect(ok.data.mustPasswordChange).toBe(false);
    expect((await h.api('GET', `/manage/shops/${shopId}`, opts)).status).toBe(200);
    // Takroriy chaqiruv — parol allaqachon almashtirilgan.
    expect((await h.api('POST', '/users/me/password/first', { ...opts, body: { newPassword: 'Yana-Boshqa-2026!' } })).status).toBe(409);
    // Eski vaqtincha parol endi ishlamaydi, yangisi ishlaydi.
    expect((await h.api('POST', '/auth/login', { headers: shopHeaders, cookie: `deviceId_shop=${DEVICE}`, body: { phone: ownerPhone, password: tempPassword } })).status).toBe(401);
    expect((await h.api('POST', '/auth/login', { headers: shopHeaders, cookie: `deviceId_shop=${DEVICE}`, body: { phone: ownerPhone, password: 'Yangi-Parol-2026!' } })).data.mustPasswordChange).toBe(false);
  });

  it('shop panel has no self-signup, no Google and a customer account cannot enter it', async () => {
    const reg = await h.api('POST', '/auth/register', { headers: shopHeaders, body: { phone: '+998905550011', password: 'Parol-12345', firstName: 'A', lastName: 'B', acceptedPolicyIds: [MISSING_UUID] } });
    expect(reg.status).toBe(403);
    expect((await h.api('POST', '/auth/google', { headers: shopHeaders, body: { credential: 'x' } })).status).toBe(403);
    const customer = await createUser(h);
    await h.db.user.update({ where: { id: customer.id }, data: { passwordHash: (await h.db.user.findUniqueOrThrow({ where: { id: ownerId } })).passwordHash } });
    const res = await h.api('POST', '/auth/login', { headers: shopHeaders, cookie: `deviceId_shop=${DEVICE}`, body: { phone: customer.phone, password: 'Yangi-Parol-2026!' } });
    expect(res.status).toBe(401);
  });

  it('admin adds a staff member (login + temporary password); the owner cannot invite', async () => {
    const res = await h.post(`/admin/shops/${shopId}/members`, admin.token, { firstName: 'Bobur', phone: '+998905551122', memberRole: 'STAFF' });
    expect(res.status).toBe(201);
    expect(res.data.temporaryPassword).toHaveLength(16);
    expect(res.data.member.permissions).toContain('requests.read');
    expect((await h.post(`/admin/shops/${shopId}/members`, admin.token, { firstName: 'Bobur', phone: '+998905551122', memberRole: 'STAFF' })).body.code).toBe('PHONE_TAKEN');
    const staff = await h.db.user.findUniqueOrThrow({ where: { id: res.data.user.id } });
    expect(staff.mustPasswordChange).toBe(true);
    const owner = await h.api('POST', '/auth/login', { headers: shopHeaders, cookie: `deviceId_shop=${DEVICE}`, body: { phone: ownerPhone, password: 'Yangi-Parol-2026!' } });
    const ownerCookie = [cookieOf(owner, 'accessToken_shop'), cookieOf(owner, 'deviceId_shop')].filter(Boolean).join('; ');
    expect((await h.api('POST', `/manage/shops/${shopId}/members/invitations`, { headers: shopHeaders, cookie: ownerCookie, body: { target: '+998905559999', memberRole: 'STAFF' } })).status).toBe(404);
    const list = await h.api('GET', `/manage/shops/${shopId}/members`, { headers: shopHeaders, cookie: ownerCookie });
    expect(list.data.members).toHaveLength(2);
    expect(list.data.invitations).toBeUndefined();
  });

  it('admin resets the password: new temporary password, sessions revoked, change required again', async () => {
    const old = await h.api('POST', '/auth/login', { headers: shopHeaders, cookie: `deviceId_shop=${DEVICE}`, body: { phone: ownerPhone, password: 'Yangi-Parol-2026!' } });
    const oldCookie = [cookieOf(old, 'accessToken_shop'), cookieOf(old, 'deviceId_shop')].filter(Boolean).join('; ');
    const res = await h.post(`/admin/shops/${shopId}/members/${ownerId}/reset-password`, admin.token);
    expect(res.status).toBe(201);
    expect(res.data.temporaryPassword).toHaveLength(16);
    expect(res.data.temporaryPassword).not.toBe(tempPassword);
    expect((await h.api('GET', '/users/me', { headers: shopHeaders, cookie: oldCookie })).status).toBe(401);
    expect((await h.api('POST', '/auth/login', { headers: shopHeaders, cookie: `deviceId_shop=${DEVICE}`, body: { phone: ownerPhone, password: 'Yangi-Parol-2026!' } })).status).toBe(401);
    const again = await h.api('POST', '/auth/login', { headers: shopHeaders, cookie: `deviceId_shop=${DEVICE}`, body: { phone: ownerPhone, password: res.data.temporaryPassword } });
    expect(again.data.mustPasswordChange).toBe(true);
    // Boshqa do‘konning a’zosi yoki mavjud bo‘lmagan foydalanuvchi uchun tiklab bo‘lmaydi.
    const stranger = await createUser(h);
    expect((await h.post(`/admin/shops/${shopId}/members/${stranger.id}/reset-password`, admin.token)).status).toBe(404);
    expect(JSON.stringify(await h.db.auditLog.findMany({ where: { targetId: ownerId } }))).not.toContain(res.data.temporaryPassword);
    expect(await h.db.auditLog.count({ where: { action: 'SHOP_PASSWORD_RESET', targetId: ownerId } })).toBe(1);
  });

  it('admin changes the owner: the old owner becomes MANAGER, a single OWNER remains', async () => {
    const staff = await h.db.shopMember.findFirstOrThrow({ where: { shopId, memberRole: 'STAFF' } });
    expect((await h.post(`/admin/shops/${shopId}/owner`, admin.token, { userId: staff.userId })).status).toBe(400); // sabab majburiy
    const res = await h.post(`/admin/shops/${shopId}/owner`, admin.token, { userId: staff.userId, reason: 'Egalik o‘tkazildi' });
    expect(res.status).toBe(201);
    const members = await h.db.shopMember.findMany({ where: { shopId } });
    expect(members.filter((m) => m.memberRole === 'OWNER').map((m) => m.userId)).toEqual([staff.userId]);
    expect(members.find((m) => m.userId === ownerId)?.memberRole).toBe('MANAGER');
    expect((await h.post(`/admin/shops/${shopId}/owner`, admin.token, { userId: staff.userId, reason: 'Takror' })).status).toBe(409);
  });

  it('admin suspends and resumes (any admin with SHOPS permission); the old approve/reject/invitation endpoints are gone', async () => {
    expect((await h.post(`/admin/shops/${shopId}/suspend`, admin.token, { reason: 'Tekshiruv uchun' })).data.status).toBe('SUSPENDED');
    expect((await h.post(`/admin/shops/${shopId}/resume`, admin.token)).data.status).toBe('ACTIVE');
    for (const path of ['approve', 'reject', 'owner-invitation']) expect((await h.post(`/admin/shops/${shopId}/${path}`, admin.token, { reason: 'x' })).status, path).toBe(404);
    expect((await h.get('/shop-invitations/abc')).status).toBe(404);
  });
});
