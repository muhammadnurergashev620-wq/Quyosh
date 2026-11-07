import { expect, test } from '@playwright/test';
import { ADMIN, loginWithPassword, uniqueLogin, uniquePhone, uniqueStir, URLS } from './helpers';

/**
 * Admin do‘kon yaratadi → vaqtincha parol bir marta ko‘rsatiladi → do‘kon shu login bilan kiradi →
 * birinchi kirishda parolni almashtiradi → kabinetga tushadi (TZ 3.7, 3.5).
 */
test.describe.serial('admin creates a shop, shop signs in and changes the temporary password', () => {
  const login = uniqueLogin('e2e.dokon.');
  let tempPassword = '';

  test.skip(!ADMIN.password, 'ADMIN_PASSWORD env kerak');

  test('admin: sign in → create shop → see the temporary password once', async ({ page }) => {
    await loginWithPassword(page, URLS.admin, ADMIN.login, ADMIN.password);
    await page.waitForURL(/\/admin/);
    await page.goto(`${URLS.admin}/admin/dokonlar`);
    await page.getByRole('button', { name: 'Do‘kon yaratish' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Do‘kon nomi').fill(`E2E Quyosh ${login.slice(-5)}`);
    await dialog.getByLabel('STIR').fill(uniqueStir());
    await dialog.getByLabel('Do‘kon telefoni').fill(uniquePhone());
    await dialog.getByLabel('Manzil').fill('Toshkent, Amir Temur 1');
    await dialog.getByLabel('Ism', { exact: true }).fill('Sardor');
    await dialog.getByLabel('Login').fill(login);
    await dialog.getByRole('button', { name: 'Yaratish' }).click();

    await expect(dialog.getByText('Do‘kon yaratildi')).toBeVisible();
    tempPassword = ((await dialog.locator('code').first().textContent()) ?? '').trim();
    expect(tempPassword.length).toBeGreaterThanOrEqual(12);
    // Yopish faqat «nusxa oldim» tasdig‘idan keyin.
    await expect(dialog.getByRole('button', { name: 'Yopish' })).toBeDisabled();
    await dialog.getByText('Parolni nusxa oldim va egasiga yetkazaman').click();
    await dialog.getByRole('button', { name: 'Yopish' }).click();
    await page.waitForURL(/\/admin\/dokonlar\/[0-9a-f-]{36}/);
    // Parol qayta ko‘rsatilmaydi.
    await expect(page.getByText(tempPassword)).toHaveCount(0);
  });

  test('shop: sign in with the issued login → forced password change → dashboard', async ({ page }) => {
    expect(tempPassword).not.toBe('');
    await loginWithPassword(page, URLS.shop, login, tempPassword);
    await expect(page.getByLabel('Yangi parol', { exact: true })).toBeVisible();
    // Kabinetning boshqa sahifalari yopiq (mustPasswordChange).
    const newPassword = `E2e-Parol-${Date.now()}`;
    await page.getByLabel('Yangi parol', { exact: true }).fill(newPassword);
    await page.getByLabel('Yangi parolni takrorlang').fill(newPassword);
    await page.getByRole('button', { name: 'Parolni saqlash' }).click();
    await page.waitForURL(/\/dokon/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto(`${URLS.shop}/dokon/sorovlar`);
    await expect(page.getByRole('heading', { name: 'So‘rovlar' })).toBeVisible();
  });
});
