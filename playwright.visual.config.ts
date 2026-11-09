import { defineConfig, devices } from '@playwright/test';

/**
 * Vizual regressiya (UI ko‘rigi, 3-qadam): asosiy 25 sahifa × (390, 1440) × (yorug‘, qorong‘i).
 * Lokal stend kerak (pm2: 5180/5183/5184/5185) va `npx tsx scripts/ui-review-tokens.ts`.
 *   npm run test:visual                       # baseline bilan solishtirish
 *   npm run test:visual -- --update-snapshots # baseline’ni yangilash (dizayn ataylab o‘zgarganda)
 */
export default defineConfig({
  testDir: 'tests/visual',
  testMatch: '**/*.visual.ts',
  timeout: 90_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide', scale: 'css' } },
  use: {
    ...devices['Desktop Chrome'],
    locale: 'uz-UZ',
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
});
