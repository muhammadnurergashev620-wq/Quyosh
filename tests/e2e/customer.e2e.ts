import { expect, test } from '@playwright/test';
import { finishRegistration, uniquePhone, URLS } from './helpers';

/** Mijoz: ro‘yxatdan o‘tish (ekrandagi OTP) → Tez hisob → natija diapazon bilan → saqlash (TZ 3.1, 3.3). */
test('customer registers with the on-screen OTP, runs the quick calculator and saves the result', async ({ page }) => {
  const phone = uniquePhone();
  const password = `E2e-Mijoz-${Date.now()}`;
  await page.goto(`${URLS.customer}/register`);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('To‘liq ism').fill('Test Mijozov');
  await page.getByLabel('Parol', { exact: true }).fill(password);
  await page.getByLabel('Parolni takrorlang').fill(password);
  await page.getByText('ni o‘qib chiqdim va qabul qilaman').click();
  await page.getByRole('button', { name: /ro‘yxatdan o‘tish/i }).click();

  await page.waitForURL(/\/otp/);
  await finishRegistration(page, phone, password);

  await page.goto(`${URLS.customer}/mijoz/kalkulyator`);
  const map = page.getByLabel('Joylashuv xaritasi');
  await expect(map).toBeVisible();
  await page.waitForTimeout(1500);
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByLabel('O‘rtacha oylik sarf, kWh').fill('350');
  await page.getByText('O‘rtacha', { exact: true }).click();

  // Natija: quvvat, oylik tejash (diapazon), narx, qoplanish.
  await expect(page.getByText('Tavsiya etilgan quvvat')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.qs-calc-kpis strong').first()).toContainText('kVt');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await page.goto(`${URLS.customer}/mijoz/hisoblar`);
  await expect(page.locator('.qs-table tbody tr')).not.toHaveCount(0);
});
