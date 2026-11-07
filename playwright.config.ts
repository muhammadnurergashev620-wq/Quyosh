import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (TZ 17, audit 5-bosqich): ishlab turgan lokal stend ustida (pm2: 5183/5184/5185, API 3100).
 * Ishga tushirish: `ADMIN_PASSWORD=… pnpm test:e2e` (OTP_DEV_ECHO=true bo‘lgan muhitda).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    locale: 'uz-UZ',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
});
