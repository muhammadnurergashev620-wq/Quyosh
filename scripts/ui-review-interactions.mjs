#!/usr/bin/env node
/**
 * UI ko‘rigi — interaktiv tekshiruvlar (scripts/ui-review.mjs to‘ldiruvchisi):
 * modal focus-trap va Esc, bildirishnoma paneli, ⌘K, toast turlari, tugma holatlari, Tab tartibi,
 * prefers-reduced-motion, WebGL’siz bosh sayt, film boblari, mobil modal = sheet.
 * Natija: docs/ui-review/interactions.json va docs/ui-review/shots/_interactions/*.png
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'docs/ui-review/shots/_interactions');
mkdirSync(DIR, { recursive: true });
const TOKENS_FILE = process.env.UI_REVIEW_TOKENS ?? join(ROOT, '.ui-review-tokens.json');
const tokens = existsSync(TOKENS_FILE) ? JSON.parse(readFileSync(TOKENS_FILE, 'utf8')) : {};
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const results = [];
const log = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(ok ? '✓' : '✗', id, detail ?? ''); };

async function ctxFor(browser, { panel, width = 1440, theme = 'light', reduced = false } = {}) {
  const mobile = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((th) => { localStorage.setItem('quyosh.theme', th); localStorage.setItem('quyosh.lang', 'uz'); }, theme);
  if (panel && tokens[panel]) {
    await ctx.addCookies([{ name: `accessToken_${panel}`, value: tokens[panel], domain: 'localhost', path: '/' }]);
    await ctx.addInitScript(() => localStorage.setItem('quyosh.auth-ui', JSON.stringify({ state: { hasSession: true }, version: 0 })));
  }
  return ctx;
}
const settle = async (page) => { await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined); await page.waitForTimeout(700); };
const activeInfo = (page) => page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}${a.getAttribute('aria-label') ? `[${a.getAttribute('aria-label')}]` : ''} ${(a.innerText || '').trim().slice(0, 30)}` : ''; });

async function main() {
  const browser = await chromium.launch({ executablePath: exe });

  // 1. Modal (Chiqish dialogi): focus ichida, Tab aylanadi, Esc yopadi, focus qaytadi
  for (const width of [1440, 390]) {
    const ctx = await ctxFor(browser, { panel: 'customer', width });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5183/mijoz/bosh'); await settle(page);
    await page.locator('.gm-aheader__user').click();
    await page.getByRole('menuitem', { name: 'Chiqish' }).click();
    await page.waitForTimeout(500);
    const dialog = page.locator('[role=dialog]').first();
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
    let trapped = true;
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))) trapped = false; }
    const box = await dialog.boundingBox();
    await page.screenshot({ path: join(DIR, `modal-${width}.png`) });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const closed = (await page.locator('[role=dialog]').count()) === 0;
    log(`modal-focus-${width}`, inside && trapped && closed, `focus ichida: ${inside}, trap: ${trapped}, Esc yopdi: ${closed}${width < 768 && box ? `, pastga yopishgan: ${Math.round(box.y + box.height) >= 840}` : ''}`);
    await ctx.close();
  }

  // 2. Bildirishnoma paneli va ⌘K
  {
    const ctx = await ctxFor(browser, { panel: 'customer' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5183/mijoz/bosh'); await settle(page);
    await page.locator('.gm-nbell .gm-aheader__bell').click(); await page.waitForTimeout(800);
    const open = await page.locator('.gm-npanel').isVisible();
    await page.screenshot({ path: join(DIR, 'notify-panel.png') });
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const back = await activeInfo(page);
    log('notify-panel', open && (await page.locator('.gm-npanel').count()) === 0, `ochildi: ${open}, Esc’dan keyin focus: ${back}`);
    await page.keyboard.press('Control+k'); await page.waitForTimeout(400);
    const cmdk = await page.locator('.gm-cmdk').isVisible();
    await page.keyboard.type('xarita'); await page.waitForTimeout(200);
    const first = (await page.locator('.gm-cmdk__item').first().innerText()).split('\n')[0];
    await page.keyboard.press('Enter'); await page.waitForTimeout(800);
    log('cmdk', cmdk && /xarita/.test(page.url()), `ochildi: ${cmdk}, birinchi natija: ${first}, URL: ${page.url().replace(/^http:\/\/[^/]+/, '')}`);
    await ctx.close();
  }

  // 3. Toast turlari va tugma holatlari (/dev/ui)
  {
    const ctx = await ctxFor(browser, { panel: 'customer' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5183/dev/ui'); await settle(page);
    for (const name of ['Toast success', 'Toast error']) { const b = page.getByRole('button', { name }); if (await b.count()) await b.click(); }
    await page.waitForTimeout(600);
    const toasts = await page.$$eval('.gm-toast', (els) => els.map((e) => `${e.className.match(/gm-toast--(\w+)/)?.[1]}:${e.getAttribute('role')}:${!!e.querySelector('svg')}`));
    await page.screenshot({ path: join(DIR, 'toasts.png') });
    log('toast-types', toasts.length >= 2, toasts.join(', '));
    const btn = page.getByRole('button', { name: 'primary' }).first();
    await btn.focus();
    const focusRing = await btn.evaluate((el) => getComputedStyle(el).boxShadow);
    await btn.hover(); await page.waitForTimeout(250);
    const hover = await btn.evaluate((el) => getComputedStyle(el).transform);
    const disabled = await page.getByRole('button', { name: 'Disabled' }).evaluate((el) => [el.disabled, getComputedStyle(el).opacity, getComputedStyle(el).cursor]);
    const loading = await page.getByRole('button', { name: 'Saqlash' }).first().evaluate((el) => [el.disabled, el.getAttribute('aria-busy')]);
    log('button-states', focusRing !== 'none' && hover !== 'none' && disabled[0] && loading[0], `focus ring: ${focusRing !== 'none'}, hover transform: ${hover}, disabled: ${disabled.join('/')}, loading: ${loading.join('/')}`);
    await ctx.close();
  }

  // 4. Tab tartibi (kirish sahifasi)
  {
    const ctx = await ctxFor(browser, {});
    const page = await ctx.newPage();
    await page.goto('http://localhost:5183/login'); await settle(page);
    const order = [];
    let visibleFocus = true;
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Tab'); await page.waitForTimeout(300); order.push(await activeInfo(page));
      const ok = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return true; const s = getComputedStyle(a); const w = a.closest('.gm-field__control, .gm-phone, .gm-field') ; return s.boxShadow !== 'none' || s.outlineStyle !== 'none' || (w && getComputedStyle(w).boxShadow !== 'none'); });
      if (!ok) visibleFocus = false;
    }
    log('tab-order-login', visibleFocus, order.join(' → '));
    await ctx.close();
  }

  // 5. prefers-reduced-motion: animatsiyalar 0 yoki juda qisqa
  {
    const ctx = await ctxFor(browser, { panel: 'customer', reduced: true });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5183/mijoz/bosh'); await page.waitForTimeout(300);
    const anims = await page.evaluate(() => document.getAnimations().map((a) => `${a.animationName ?? a.constructor.name}:${a.effect?.getTiming().duration}`));
    const long = anims.filter((a) => Number(a.split(':')[1]) > 200);
    log('reduced-motion', long.length === 0, `animatsiyalar: ${anims.length}, 200 ms dan uzun: ${long.slice(0, 6).join(', ') || 'yo‘q'}`);
    await ctx.close();
  }

  // 6. Bosh sayt: film boblari va WebGL’siz statik kadr
  {
    const ctx = await ctxFor(browser, {});
    const page = await ctx.newPage();
    await page.goto('http://localhost:5180/'); await settle(page);
    await page.mouse.move(400, 400); await page.mouse.wheel(0, 50); await page.waitForTimeout(2500);
    const filmH = await page.evaluate(() => document.querySelector('.gm-film')?.getBoundingClientRect().height ?? 0);
    const seen = new Set();
    for (let i = 0; i < 9; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round((filmH / 8.6) * i));
      await page.waitForTimeout(900);
      const on = await page.evaluate(() => [...document.querySelectorAll('.gm-film__chapters li.is-on, .gm-film__index li.is-on')].pop()?.textContent?.trim() ?? '');
      if (on) seen.add(on);
      await page.screenshot({ path: join(DIR, `film-${i}.png`) });
    }
    log('film-chapters', seen.size >= 8, `ko‘rilgan boblar: ${[...seen].join(' | ')}`);
    await ctx.close();
  }
  {
    const b2 = await chromium.launch({ executablePath: exe, args: ['--disable-webgl', '--disable-3d-apis'] });
    const ctx = await ctxFor(b2, {});
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://localhost:5180/'); await settle(page);
    await page.mouse.wheel(0, 50); await page.waitForTimeout(2500);
    const staticMode = await page.evaluate(() => !!document.querySelector('.gm-film--static, .gm-film.is-poster, .gm-film__static-list'));
    await page.screenshot({ path: join(DIR, 'no-webgl.png'), fullPage: false });
    log('no-webgl', staticMode && errors.length === 0, `statik kadr: ${staticMode}, xatolar: ${errors.join('; ') || 'yo‘q'}`);
    await b2.close();
  }

  // 7. Do‘kon: to‘xtatilgan holat banneri komponenti mavjudligi, OTP 6 katak (register → OTP kerak emas, faqat komponent)
  {
    const ctx = await ctxFor(browser, {});
    const page = await ctx.newPage();
    await page.goto('http://localhost:5184/login'); await settle(page);
    const fields = await page.$$eval('input', (i) => i.map((x) => x.getAttribute('autocomplete') || x.type));
    log('shop-login-fields', fields.includes('username') || fields.length >= 2, fields.join(', '));
    await ctx.close();
  }

  await browser.close();
  writeFileSync(join(ROOT, 'docs/ui-review/interactions.json'), JSON.stringify(results, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
