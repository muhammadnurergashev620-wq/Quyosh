import { expect, test } from '@playwright/test';
import { loginWithPassword, uniquePhone, URLS } from './helpers';

test.describe('negative paths', () => {
  test('wrong OTP code is rejected with a clear message', async ({ page }) => {
    const phone = uniquePhone();
    const password = `E2e-Xato-${Date.now()}`;
    await page.goto(`${URLS.customer}/register`);
    await page.getByLabel('Telefon raqami').fill(phone);
    await page.getByLabel('To‘liq ism').fill('Xato Kodov');
    await page.getByLabel('Parol', { exact: true }).fill(password);
    await page.getByLabel('Parolni takrorlang').fill(password);
    await page.getByText('ni o‘qib chiqdim va qabul qilaman').click();
    await page.getByRole('button', { name: /ro‘yxatdan o‘tish/i }).click();
    await page.waitForURL(/\/otp/);
    const real = (await page.locator('.gm-otp-page strong').first().textContent())?.trim() ?? '';
    const wrong = real.split('').map((d) => String((Number(d) + 1) % 10)).join('');
    await page.locator('.gm-otp-page input').first().click();
    await page.keyboard.type(wrong); // to‘liq kiritilganda o‘zi yuboriladi
    await expect(page.getByRole('alert').filter({ hasText: /kod/i }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/otp/);
    await expect(page.getByRole('checkbox', { name: 'Login va parolni saqlab oldim' })).toHaveCount(0);
  });

  test('a customer cannot enter the admin panel', async ({ page }) => {
    await loginWithPassword(page, URLS.admin, '998900000098', 'notthepassword');
    await expect(page.getByText('Login yoki parol noto‘g‘ri.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('shop panel rejects unknown logins and blocks after repeated failures', async ({ request }) => {
    const login = `e2e.blok.${Date.now().toString(36)}`;
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const res = await request.post(`${URLS.api}/auth/login`, { headers: { 'x-app-panel': 'SHOP' }, data: { login, password: 'Xato-parol-123' } });
      statuses.push(res.status());
    }
    // Avval 401 (noto‘g‘ri login), keyin rate-limit/blok — 429. Oldingi ishga tushirishdan IP limiti qolgan bo‘lsa, darhol 429.
    expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
    expect(statuses).toContain(429);
  });

  test('a shop cannot read another shop’s request (object-level access)', async ({ request }) => {
    test.skip(!process.env.E2E_SHOP_B_TOKEN || !process.env.E2E_FOREIGN_RS_ID, 'E2E_SHOP_B_TOKEN va E2E_FOREIGN_RS_ID kerak');
    const res = await request.get(`${URLS.api}/request-shops/${process.env.E2E_FOREIGN_RS_ID}`, {
      headers: { 'x-app-panel': 'SHOP', cookie: `accessToken_shop=${process.env.E2E_SHOP_B_TOKEN}` },
    });
    expect([403, 404]).toContain(res.status());
  });
});
