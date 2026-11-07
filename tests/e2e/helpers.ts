import { expect, type Page } from '@playwright/test';

/** Lokal stend manzillari (README: bosh sayt 5180, mijoz 5183, do‘kon 5184, admin 5185, API 3100). */
export const URLS = {
  customer: process.env.E2E_CUSTOMER_URL ?? 'http://localhost:5183',
  shop: process.env.E2E_SHOP_URL ?? 'http://localhost:5184',
  admin: process.env.E2E_ADMIN_URL ?? 'http://localhost:5185',
  api: process.env.E2E_API_URL ?? 'http://localhost:3100/api/v1',
};

/** Superadmin: login `ADMIN_LOGIN` (standart «admin"), parol — `.env` dagi ADMIN_PASSWORD (testga env orqali beriladi, log’ga chiqmaydi). */
export const ADMIN = { login: process.env.ADMIN_LOGIN || 'admin', password: process.env.ADMIN_PASSWORD ?? '' };

const OPERATORS = ['90', '91', '93', '94', '95', '97', '98', '99'];
/** 9 xonali mahalliy raqam, haqiqiy operator kodi bilan (aks holda «Operator kodi noto‘g‘ri»). */
export const uniquePhone = () => `${OPERATORS[Math.floor(Math.random() * OPERATORS.length)]}${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
export const uniqueLogin = (prefix: string) => `${prefix}${Date.now().toString(36)}`.slice(0, 30);
export const uniqueStir = () => String(400_000_000 + Math.floor(Math.random() * 99_999_999));

/** Login + parol bilan kirish (do‘kon/admin paneli). */
export async function loginWithPassword(page: Page, baseUrl: string, login: string, password: string) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Login').fill(login);
  await page.getByLabel('Parol', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Kirish' }).click();
}

/** OTP sahifasidagi dev-rejim kodini o‘qib kiritadi (OTP_DEV_ECHO=true, faqat test/staging). */
export async function enterScreenOtp(page: Page) {
  const code = (await page.locator('.gm-otp-page strong').first().textContent())?.trim() ?? '';
  expect(code).toMatch(/^\d{4,8}$/);
  await page.locator('.gm-otp-page input').first().click();
  await page.keyboard.type(code);
  return code;
}

/**
 * Ro‘yxatdan o‘tgandan keyin: OTP (to‘liq kiritilganda o‘zi yuboriladi) → «Login va parolingizni saqlang» kartasi →
 * kirish sahifasi (telefon + parol) → kirish OTP → mijoz kabineti.
 */
export async function finishRegistration(page: Page, phone: string, password: string) {
  await enterScreenOtp(page);
  await page.getByRole('checkbox', { name: 'Login va parolni saqlab oldim' }).check();
  await page.getByRole('button', { name: 'Kirishga o‘tish' }).click();
  await page.waitForURL(/\/login/);
  await page.getByLabel('Telefon raqami').fill(phone);
  await page.getByLabel('Parol', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Kirish' }).click();
  await page.waitForURL(/\/otp|\/mijoz\//);
  if (page.url().includes('/otp')) await enterScreenOtp(page);
  await page.waitForURL(/\/mijoz\//);
}
