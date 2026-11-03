#!/usr/bin/env node
// SEO prerender (TZ 5.5): public sahifalar (bilimlar markazi, do‘kon profillari) Playwright bilan statik HTML ga.
// Foydalanish: node scripts/prerender.mjs --base http://localhost:5183 --sitemap http://localhost:3100/api/v1/sitemap.xml --out dist/prerender [--limit 50]
// Natija: <out>/<yo‘l>/<lang>.html — nginx `?lang=` va bot User-Agent bo‘yicha shu fayllarni beradi.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const base = arg('base', 'http://localhost:5183').replace(/\/$/, '');
const sitemap = arg('sitemap', 'http://localhost:3100/api/v1/sitemap.xml');
const out = arg('out', 'dist/prerender');
const limit = Number(arg('limit', '1000'));

const xml = await (await fetch(sitemap)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]))
  .map((u) => ({ path: u.pathname, lang: u.searchParams.get('lang') ?? 'uz' }))
  .slice(0, limit);

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
let ok = 0;
for (const { path, lang } of urls) {
  const ctx = await browser.newContext({ userAgent: 'QuyoshPrerender/1.0' });
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}${path}?lang=${lang}`, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForFunction(() => !document.querySelector('.gm-page-loader, .qs-splash') && document.title.includes('Quyosh'), null, { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    const html = await page.content();
    const file = join(out, path.replace(/^\//, ''), `${lang}.html`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
    ok += 1;
  } catch (error) {
    console.error(`✗ ${path}?lang=${lang}: ${error.message}`);
  } finally {
    await ctx.close();
  }
}
await browser.close();
console.log(`prerender: ${ok}/${urls.length} sahifa → ${out}`);
