import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/** Asosiy 25 sahifa (U21). Parametrli sahifalar lokal stenddagi demo ma’lumot ID’lari bilan. */
const PAGES: Array<{ name: string; panel: 'portal' | 'customer' | 'shop' | 'admin'; path: string; auth: boolean }> = [
  { name: 'portal-home', panel: 'portal', path: '/', auth: false },
  { name: 'customer-login', panel: 'customer', path: '/login', auth: false },
  { name: 'shop-login', panel: 'shop', path: '/login', auth: false },
  { name: 'customer-bosh', panel: 'customer', path: '/mijoz/bosh', auth: true },
  { name: 'customer-kalkulyator', panel: 'customer', path: '/mijoz/kalkulyator', auth: true },
  { name: 'customer-natija', panel: 'customer', path: '/mijoz/natija/40a3c11d-8f6e-4afb-a093-0d2fd1bb19bf', auth: true },
  { name: 'customer-hisoblar', panel: 'customer', path: '/mijoz/hisoblar', auth: true },
  { name: 'customer-sorovlar', panel: 'customer', path: '/mijoz/sorovlar', auth: true },
  { name: 'customer-sorov', panel: 'customer', path: '/mijoz/sorovlar/5d2e8891-2c09-49f8-8712-eddd88e1e5cc', auth: true },
  { name: 'customer-chat', panel: 'customer', path: '/mijoz/chat', auth: true },
  { name: 'customer-montajlar', panel: 'customer', path: '/mijoz/montajlar', auth: true },
  { name: 'customer-mahsulotlar', panel: 'customer', path: '/mijoz/mahsulotlar', auth: true },
  { name: 'customer-dokonlar', panel: 'customer', path: '/mijoz/dokonlar', auth: true },
  { name: 'customer-bildirishnomalar', panel: 'customer', path: '/bildirishnomalar', auth: true },
  { name: 'customer-sozlamalar', panel: 'customer', path: '/sozlamalar', auth: true },
  { name: 'shop-bosh', panel: 'shop', path: '/dokon', auth: true },
  { name: 'shop-sorovlar', panel: 'shop', path: '/dokon/sorovlar', auth: true },
  { name: 'shop-katalog', panel: 'shop', path: '/dokon/katalog', auth: true },
  { name: 'shop-analitika', panel: 'shop', path: '/dokon/analitika', auth: true },
  { name: 'shop-xodimlar', panel: 'shop', path: '/dokon/xodimlar', auth: true },
  { name: 'admin-dashboard', panel: 'admin', path: '/admin', auth: true },
  { name: 'admin-foydalanuvchilar', panel: 'admin', path: '/admin/foydalanuvchilar', auth: true },
  { name: 'admin-dokonlar', panel: 'admin', path: '/admin/dokonlar', auth: true },
  { name: 'admin-audit', panel: 'admin', path: '/admin/audit', auth: true },
  { name: 'admin-tariflar', panel: 'admin', path: '/admin/tariflar', auth: true },
];
const PORT = { portal: 5180, customer: 5183, shop: 5184, admin: 5185 } as const;
const tokensFile = process.env.UI_REVIEW_TOKENS ?? join(__dirname, '../../.ui-review-tokens.json');
const tokens: Record<string, string> = existsSync(tokensFile) ? JSON.parse(readFileSync(tokensFile, 'utf8')) : {};

/** O‘zgaruvchan qismlar niqoblanadi: nisbiy vaqt, sana, xarita, grafik, shader/film, sparkline. */
const MASK = ['time', '.gm-nrow__time', '.maplibregl-map', 'canvas', '.gm-stat__spark', '.nd-svg', 'svg.qs-chart', '.qs-vbars', '.gm-film', '.gm-aheader__badge', '[data-visual-mask]'];

for (const page of PAGES) {
  for (const width of [390, 1440]) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${page.name} ${width} ${theme}`, async ({ browser }) => {
        test.skip(page.auth && !tokens[page.panel], 'test tokenlari yo‘q: npx tsx scripts/ui-review-tokens.ts');
        const mobile = width < 768;
        const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
        await ctx.addInitScript(([th]) => { localStorage.setItem('quyosh.theme', th!); localStorage.setItem('quyosh.lang', 'uz'); }, [theme]);
        if (page.auth) {
          await ctx.addCookies([{ name: `accessToken_${page.panel}`, value: tokens[page.panel]!, domain: 'localhost', path: '/' }]);
          await ctx.addInitScript(() => localStorage.setItem('quyosh.auth-ui', JSON.stringify({ state: { hasSession: true }, version: 0 })));
        }
        const p = await ctx.newPage();
        await p.goto(`http://localhost:${PORT[page.panel]}${page.path}`, { waitUntil: 'load' });
        await p.waitForSelector('main, .qs-portal, .gm-auth-page', { timeout: 20_000 });
        await p.waitForLoadState('networkidle').catch(() => undefined);
        await p.waitForFunction(() => !document.querySelector('.gm-page-loader'), null, { timeout: 15_000 }).catch(() => undefined);
        await p.waitForTimeout(600);
        await expect(p).toHaveScreenshot(`${page.name}-${width}-${theme}.png`, { mask: MASK.map((selector) => p.locator(selector)) });
        await ctx.close();
      });
    }
  }
}
