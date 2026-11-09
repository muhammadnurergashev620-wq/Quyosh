#!/usr/bin/env node
/**
 * UI ko‘rigi (QA): har panelning U21 reyestridagi sahifalarini turli o‘lcham, mavzu, til va holatlarda ochadi,
 * skrinshot oladi va avtomatik tekshiruvlarni yig‘adi.
 *
 *   npx tsx scripts/ui-review-tokens.ts          # bir marta: test tokenlari (.ui-review-tokens.json)
 *   node scripts/ui-review.mjs [--quick] [--panel=customer,shop] [--only=/mijoz/bosh]
 *
 * Natija: docs/ui-review/shots/<panel>/<sahifa>/<o‘lcham>-<mavzu>-<til>[-holat].png va docs/ui-review/results.json
 * Tekshiruvlar: console error/warning, 4xx/5xx, axe-core, gorizontal skroll, kesilgan matn, ustma-ust elementlar,
 * 44 px dan kichik teginish maydonlari (≤768 px), tarjima qilinmagan matn, «undefined/null/NaN/ISO sana».
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/ui-review');
const SHOTS = join(OUT, 'shots');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const QUICK = !!args.quick;
const TOKENS_FILE = process.env.UI_REVIEW_TOKENS ?? join(ROOT, '.ui-review-tokens.json');
const tokens = existsSync(TOKENS_FILE) ? JSON.parse(readFileSync(TOKENS_FILE, 'utf8')) : {};
const AXE = readFileSync(join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const API = '**/api/v1/**';

const PORT = { portal: 5180, customer: 5183, shop: 5184, admin: 5185 };
const WIDTHS = QUICK ? [390, 1440] : [360, 390, 768, 1024, 1280, 1440];
const THEMES = ['light', 'dark'];
const EXTRA_LANGS = { oz: 'uz-Cyrl', ru: 'ru' };
const LANG_WIDTHS = [390, 1440];
const STATE_WIDTHS = [390, 1440];

/** U21 reyestri → marshrutlar. `:param` li sahifalar ro‘yxat sahifasidagi birinchi havoladan topiladi. */
const PAGES = {
  portal: { auth: false, routes: ['/', '/shartlar', '/maxfiylik'] },
  auth: { auth: false, routes: ['customer:/login', 'customer:/register', 'shop:/login', 'admin:/login'] },
  customer: {
    auth: true,
    routes: [
      '/mijoz/bosh', '/mijoz/kalkulyator', '/mijoz/kalkulyator/batafsil', '/mijoz/kredit', '/mijoz/uzilish',
      '/mijoz/hisoblar', '/mijoz/hisoblar/solishtirish', '/mijoz/natija/:id', '/mijoz/obyektlar', '/mijoz/obyektlar/:id',
      '/mijoz/sorovlar', '/mijoz/sorovlar/:id', '/mijoz/sorovlar/:id/solishtirish', '/mijoz/takliflar/:id',
      '/mijoz/chat', '/mijoz/chat/:rsId', '/mijoz/montajlar', '/mijoz/montajlar/:id', '/mijoz/tizimim', '/mijoz/tizimim/:id',
      '/mijoz/sevimlilar', '/mijoz/murojaatlar', '/mijoz/murojaatlar/:id', '/mijoz/profil',
      '/mijoz/xarita', '/mijoz/dokonlar', '/mijoz/dokonlar/:slug', '/mijoz/mahsulotlar', '/mijoz/mahsulotlar/:slug', '/mijoz/solishtirish',
      '/mijoz/bilim', '/mijoz/bilim/:category', '/mijoz/bilim/:category/:slug', '/mijoz/yordam',
      '/bildirishnomalar', '/sozlamalar', '/sozlamalar/korinish', '/sozlamalar/til', '/sozlamalar/bildirishnomalar', '/sozlamalar/xavfsizlik', '/sozlamalar/qurilmalar',
      '/mijoz/yoq-sahifa-404',
    ],
  },
  shop: {
    auth: true,
    routes: [
      '/dokon', '/dokon/sorovlar', '/dokon/sorovlar/:rsId', '/dokon/takliflar', '/dokon/montajlar', '/dokon/montajlar/:id', '/dokon/sharhlar',
      '/dokon/profil', '/dokon/katalog', '/dokon/import', '/dokon/xizmatlar', '/dokon/filiallar', '/dokon/portfolio', '/dokon/vidjet',
      '/dokon/analitika', '/dokon/xodimlar', '/bildirishnomalar', '/sozlamalar',
    ],
  },
  admin: {
    auth: true,
    routes: [
      '/admin', '/admin/hisobot', '/admin/foydalanuvchilar', '/admin/foydalanuvchilar/:id', '/admin/adminlar', '/admin/dokonlar', '/admin/dokonlar/:id',
      '/admin/katalog', '/admin/sharhlar', '/admin/tariflar', '/admin/kalkulyator', '/admin/yordam', '/admin/yordam/:id', '/admin/bosh-sahifa',
      '/admin/kontent', '/admin/kontent/:id', '/admin/siyosatlar', '/admin/audit', '/admin/errorlar', '/admin/profil', '/admin/devops', '/bildirishnomalar',
    ],
  },
};

/** Parametrli sahifa uchun havola qayerdan izlanadi. */
const DISCOVER = {
  '/mijoz/natija/:id': ['/mijoz/hisoblar', /^\/mijoz\/natija\/[^/?#]+$/],
  '/mijoz/obyektlar/:id': ['/mijoz/obyektlar', /^\/mijoz\/obyektlar\/[^/?#]+$/],
  '/mijoz/sorovlar/:id': ['/mijoz/sorovlar', /^\/mijoz\/sorovlar\/[0-9a-f-]{36}$/],
  '/mijoz/sorovlar/:id/solishtirish': ['/mijoz/sorovlar/:id', /^\/mijoz\/sorovlar\/[^/]+\/solishtirish$/],
  '/mijoz/takliflar/:id': ['/mijoz/sorovlar/:id', /^\/mijoz\/takliflar\/[^/?#]+$/, 'main button:has-text("Batafsil")'],
  '/mijoz/chat/:rsId': ['/mijoz/chat', /^\/mijoz\/chat\/[^/?#]+$/],
  '/mijoz/montajlar/:id': ['/mijoz/montajlar', /^\/mijoz\/montajlar\/[^/?#]+$/],
  '/mijoz/tizimim/:id': ['/mijoz/tizimim', /^\/mijoz\/tizimim\/[^/?#]+$/],
  '/mijoz/murojaatlar/:id': ['/mijoz/murojaatlar', /^\/mijoz\/murojaatlar\/[^/?#]+$/],
  '/mijoz/dokonlar/:slug': ['/mijoz/dokonlar', /^\/mijoz\/dokonlar\/[^/?#]+$/],
  '/mijoz/mahsulotlar/:slug': ['/mijoz/mahsulotlar', /^\/mijoz\/mahsulotlar\/[^/?#]+$/],
  '/mijoz/bilim/:category': ['/mijoz/bilim', /^\/mijoz\/bilim\/[^/?#]+$/],
  '/mijoz/bilim/:category/:slug': ['/mijoz/bilim/:category', /^\/mijoz\/bilim\/[^/]+\/[^/?#]+$/],
  '/dokon/sorovlar/:rsId': ['/dokon/sorovlar', /^\/dokon\/sorovlar\/[^/?#]+$/, 'main .qs-req-card'],
  '/dokon/montajlar/:id': ['/dokon/montajlar', /^\/dokon\/montajlar\/[^/?#]+$/],
  // Ro‘yxat drawer ochadi — test mijozining profili ishlatiladi
  '/admin/foydalanuvchilar/:id': ['/admin/foydalanuvchilar', /^\/admin\/foydalanuvchilar\/[^/?#]+$/, null, `/admin/foydalanuvchilar/${process.env.UI_REVIEW_CUSTOMER_ID ?? '727f3d0b-78cc-4106-aa51-14eea4405169'}`],
  '/admin/dokonlar/:id': ['/admin/dokonlar', /^\/admin\/dokonlar\/[0-9a-f-]{36}$/, 'main tbody tr'],
  '/admin/yordam/:id': ['/admin/yordam', /^\/admin\/yordam\/[^/?#]+$/, 'main tbody tr, main .qs-req-card'],
  '/admin/kontent/:id': ['/admin/kontent', /^\/admin\/kontent\/[0-9a-f-]{36}$/, 'main tbody tr'],
};

const slug = (route) => (route.replace(/^\w+:/, '').replace(/^\//, '').replace(/[/:]+/g, '_') || 'home');
const NOISE = /GL Driver Message|GPU stall|\[vite\]|Download the React DevTools/;

async function makeContext(browser, { panel, width, theme, lang, auth }) {
  const mobile = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await ctx.addInitScript(([th, lg]) => {
    try { localStorage.setItem('quyosh.theme', th); localStorage.setItem('quyosh.lang', lg); localStorage.setItem('quyosh.cookie-consent', 'accepted'); } catch { /* */ }
  }, [theme, lang]);
  if (auth && tokens[panel]) {
    await ctx.addCookies([{ name: `accessToken_${panel}`, value: tokens[panel], domain: 'localhost', path: '/' }]);
    await ctx.addInitScript(() => localStorage.setItem('quyosh.auth-ui', JSON.stringify({ state: { hasSession: true }, version: 0 })));
  }
  return ctx;
}

/** Holatlar: bo‘sh (ro‘yxatlar bo‘shatiladi), yuklanish (API 4 s kechiktiriladi), xato (API GET → 500). Sessiya so‘rovlari tegilmaydi. */
async function applyState(page, state) {
  if (state === 'data') return;
  await page.route(API, async (route) => {
    const req = route.request();
    const url = req.url();
    const keep = /\/auth\/|\/users\/me(\?|$)|\/config|unread-count|\/i18n/.test(url) || req.method() !== 'GET';
    if (keep) return route.continue();
    if (state === 'loading') { await new Promise((r) => setTimeout(r, 4000)); return route.continue().catch(() => undefined); }
    if (state === 'error') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }) });
    if (state === 'empty') {
      const res = await route.fetch();
      let body = await res.text();
      try {
        const json = JSON.parse(body);
        const empty = (v) => (Array.isArray(v) ? [] : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? [] : x])) : v);
        body = JSON.stringify(empty(json));
      } catch { /* JSON emas */ }
      return route.fulfill({ response: res, body });
    }
    return route.continue();
  });
}

/** Sahifa ichidagi tekshiruvlar (brauzerda). */
function inspect({ mobile, lang }) {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const label = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  const text = (el) => (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const out = { hscroll: document.documentElement.scrollWidth > window.innerWidth + 1 ? document.documentElement.scrollWidth - window.innerWidth : 0, truncated: [], overlaps: [], small: [], bad: [], untranslated: [], h1: document.querySelectorAll('h1').length };

  // Kesilgan matn: overflow hidden/clip + ellipsis yo‘q + matn sig‘magan.
  for (const el of document.querySelectorAll('body *')) {
    if (out.truncated.length > 25) break;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'svg', 'CANVAS', 'IMG', 'VIDEO', 'IFRAME'].includes(el.tagName) || el.closest('svg, .maplibregl-map, canvas')) continue;
    const s = getComputedStyle(el);
    if (!/(hidden|clip)/.test(s.overflowX) || s.textOverflow === 'ellipsis' || +s.webkitLineClamp > 0 || s.webkitLineClamp !== 'none' && s.webkitLineClamp !== '') continue;
    if (!vis(el) || !el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (el.scrollWidth > el.clientWidth + 2) out.truncated.push(`${label(el)} «${text(el)}» ${el.clientWidth}/${el.scrollWidth}`);
  }

  // Interaktiv elementlar: ustma-ust tushish va kichik teginish maydoni.
  // Ko‘rinadigan qism: skroll/overflow konteynerlari kesgan joy hisobga olinadi
  const clipRect = (el) => {
    let r = el.getBoundingClientRect(); let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { const q = p.getBoundingClientRect(); box = { left: Math.max(box.left, q.left), top: Math.max(box.top, q.top), right: Math.min(box.right, q.right), bottom: Math.min(box.bottom, q.bottom) }; }
    }
    return box.right - box.left > 1 && box.bottom - box.top > 1 ? { ...box, width: box.right - box.left, height: box.bottom - box.top } : null;
  };
  const inter = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox]')].filter((el) => vis(el) && !el.closest('.gm-skip-link') && !el.matches('.gm-skip-link'));
  const rects = inter.map((el) => ({ el, r: clipRect(el), full: el.getBoundingClientRect() })).filter((x) => x.r);
  for (let i = 0; i < rects.length && out.overlaps.length < 15; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 4 && h > 4 && w * h > 40) {
        const cx = Math.max(a.r.left, b.r.left) + w / 2, cy = Math.max(a.r.top, b.r.top) + h / 2;
        const top = document.elementFromPoint(cx, cy);
        if (top && (a.el.contains(top) || b.el.contains(top))) out.overlaps.push(`${label(a.el)} «${text(a.el)}» × ${label(b.el)} «${text(b.el)}»`);
      }
    }
  }
  if (mobile) {
    for (const { el, full } of rects) {
      if (out.small.length > 25) break;
      const inline = getComputedStyle(el).display === 'inline' && el.parentElement && /\S/.test([...el.parentElement.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''));
      if (inline || el.closest('.maplibregl-ctrl, .maplibregl-map') || el.type === 'checkbox' || el.type === 'radio') continue;
      // ::after bilan kengaytirilgan teginish maydoni (gm-button--sm) hisobga olinadi
      // ::after bilan kengaytirilgan teginish maydoni hisobga olinadi
      const after = getComputedStyle(el, '::after');
      const ext = after.content !== 'none' && after.position === 'absolute' ? { w: parseFloat(after.width) || 0, h: parseFloat(after.height) || 0 } : { w: 0, h: 0 };
      if (Math.max(full.width, ext.w) < 44 - 0.5 || Math.max(full.height, ext.h) < 44 - 0.5) out.small.push(`${label(el)} «${text(el)}» ${Math.round(full.width)}×${Math.round(full.height)}`);
    }
  }

  // Matn: «undefined», «null», «NaN», [object Object], ISO sana, tarjima kaliti, ru/oz sahifada lotin o‘zbekcha.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const latinUz = /[A-Za-z]*[oOgG][‘ʻ'’][a-z]+|\b(va|uchun|bilan|yoki|hisob|so‘rov|taklif|do‘kon|kiriting|saqlash|yuborish)\b/;
  let node;
  while ((node = walker.nextNode())) {
    const t = node.textContent.trim();
    if (!t || !node.parentElement || !vis(node.parentElement) || node.parentElement.closest('script, style, code, pre, [contenteditable], .gm-lang__menu, [role=menu], [data-ui-review-ignore]')) continue;
    if (/\bundefined\b|\bNaN\b|\[object Object\]|^null$|\bnull\b(?! ?(?:ga|da))/.test(t)) out.bad.push(t.slice(0, 80));
    else if (/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) out.bad.push(`ISO: ${t.slice(0, 60)}`);
    else if (/^[a-z]+(?:[._][a-z0-9]+){2,}$/.test(t)) out.bad.push(`kalit: ${t}`);
    if (lang !== 'uz' && latinUz.test(t) && !/Quyosh|quyosh\.uz|Esri|OpenStreetMap|Google|Telegram|@/.test(t)) out.untranslated.push(t.slice(0, 80));
    if (out.bad.length > 20 || out.untranslated.length > 20) break;
  }
  return out;
}

async function discover(browser, panel, routes) {
  const ctx = await makeContext(browser, { panel, width: 1440, theme: 'light', lang: 'uz', auth: true });
  const page = await ctx.newPage();
  const found = {};
  const visit = async (path, pattern) => {
    await page.goto(`http://localhost:${PORT[panel]}${path}`, { waitUntil: 'load' }).catch(() => undefined);
    await page.waitForSelector('main', { timeout: 20000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
    // Ma’lumot kelib, havolalar chizilguncha (dev rejimda sekin)
    await page.waitForFunction((src) => [...document.querySelectorAll('a[href]')].some((a) => new RegExp(src).test(a.getAttribute('href').split(/[?#]/)[0])), pattern.source, { timeout: 6000 }).catch(() => undefined);
    return page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
  };
  for (const route of routes.filter((r) => r.includes(':'))) {
    const rule = DISCOVER[route];
    if (!rule) continue;
    const [fromRoute, pattern, clickSel, fallback] = rule;
    const from = fromRoute.includes(':') ? found[fromRoute] : fromRoute;
    if (!from) { if (fallback) found[route] = fallback; continue; }
    const hrefs = await visit(from, pattern);
    const hit = hrefs.find((h) => h && pattern.test(h.split(/[?#]/)[0]));
    if (hit) { found[route] = hit.split('#')[0]; continue; }
    if (clickSel && (await page.locator(clickSel).count())) {
      await page.locator(clickSel).first().click({ position: { x: 60, y: 15 } }).catch(() => undefined);
      await page.waitForTimeout(1500);
      const path = page.url().replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0];
      if (pattern.test(path)) { found[route] = path; continue; }
    }
    if (fallback) found[route] = fallback;
  }
  await ctx.close();
  return found;
}

async function shoot(browser, job, results) {
  const { panel, route, url, width, theme, lang, state, auth } = job;
  const ctx = await makeContext(browser, { panel, width, theme, lang, auth });
  const page = await ctx.newPage();
  const consoleMsgs = [], network = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !NOISE.test(m.text())) consoleMsgs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => consoleMsgs.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('response', (r) => { if (r.status() >= 400 && !/\.(png|jpg|svg|woff2?)$/.test(r.url())) network.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 120)}`); });
  await applyState(page, state);
  const langCode = Object.entries(EXTRA_LANGS).find(([, v]) => v === lang)?.[0] ?? 'uz';
  const file = join(SHOTS, panel, slug(route), `${width}-${theme}-${langCode}${state === 'data' ? '' : `-${state}`}.png`);
  mkdirSync(dirname(file), { recursive: true });
  const rec = { panel, route, url, width, theme, lang: langCode, state, file: file.replace(ROOT + '/', '') };
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    // Ilova qobig‘i chizilguncha kutiladi (dev rejimda modul yuklanishi 1–3 s)
    await page.waitForSelector('main, .gm-auth-page, .qs-portal, .qs-status', { timeout: 20000 }).catch(() => undefined);
    if (state === 'loading') await page.waitForTimeout(1000);
    else {
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
      // Lazy chunk / Suspense yuklovchisi yo‘qolguncha (og‘ir sahifalar — xarita, grafiklar)
      await page.waitForFunction(() => !document.querySelector('.gm-page-loader, [aria-busy="true"].gm-page-loader'), null, { timeout: 15000 }).catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
      await page.waitForTimeout(900);
    }
    rec.finalUrl = page.url().replace(/^https?:\/\/[^/]+/, '');
    rec.checks = await page.evaluate(inspect, { mobile: width <= 768, lang: langCode });
    rec.loader = state === 'data' && (await page.$('.gm-page-loader')) !== null;
    if (state === 'data' && (theme === 'light' || width === 390) ) {
      await page.addScriptTag({ content: AXE });
      const axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')}${n.any?.[0]?.message ? ' — ' + n.any[0].message.slice(0, 90) : ''}`) }));
      });
      rec.axe = axe;
    }
    await page.screenshot({ path: file, fullPage: true, timeout: 30000 }).catch(async () => page.screenshot({ path: file }));
  } catch (e) {
    rec.fatal = e.message.split('\n')[0].slice(0, 200);
  }
  rec.console = consoleMsgs.slice(0, 20);
  rec.network = [...new Set(network)].slice(0, 20);
  results.push(rec);
  await ctx.close();
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  const panels = (args.panel ? String(args.panel).split(',') : Object.keys(PAGES));
  const results = [];
  const jobsByPanel = {};
  for (const name of panels) {
    const def = PAGES[name];
    let routes = def.routes;
    if (args.only) { const only = String(args.only).split(','); routes = routes.filter((r) => only.includes(r.replace(/^\w+:/, ''))); }
    const found = def.auth ? await discover(browser, name, routes) : {};
    const jobs = [];
    for (const route of routes) {
      let target, port;
      if (name === 'auth') { const [p, path] = route.split(':'); port = PORT[p]; target = path; }
      else { port = PORT[name]; target = route.includes(':') ? found[route] : route; }
      if (!target) { results.push({ panel: name, route, skipped: 'parametr topilmadi (ma’lumot yo‘q)' }); continue; }
      const url = `http://localhost:${port}${target}`;
      const panel = name === 'auth' ? route.split(':')[0] : name;
      const base = { panel: name, route, url, auth: def.auth, tokenPanel: panel };
      for (const width of WIDTHS) for (const theme of THEMES) jobs.push({ ...base, width, theme, lang: 'uz', state: 'data' });
      for (const lang of Object.values(EXTRA_LANGS)) for (const width of LANG_WIDTHS) jobs.push({ ...base, width, theme: 'light', lang, state: 'data' });
      if (def.auth && !QUICK && !args['data-only']) for (const state of ['empty', 'loading', 'error']) for (const width of STATE_WIDTHS) jobs.push({ ...base, width, theme: 'light', lang: 'uz', state });
    }
    jobsByPanel[name] = jobs;
  }
  const total = Object.values(jobsByPanel).flat().filter((j) => !args['states-only'] || j.state !== 'data').length;
  let done = 0;
  const started = Date.now();
  const queue = Object.values(jobsByPanel).flat().filter((j) => !args['states-only'] || j.state !== 'data');
  const WORKERS = Number(args.workers ?? 6);
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const holder = [];
      await shoot(browser, { ...job, panel: job.panel === 'auth' ? job.tokenPanel : job.panel }, holder);
      const rec = holder[0];
      rec.panel = job.panel === 'auth' ? `auth-${job.tokenPanel}` : job.panel;
      results.push(rec);
      done++;
      if (done % 50 === 0) console.log(`${done}/${total} (${Math.round((Date.now() - started) / 1000)} s)`);
    }
  }));
  await browser.close();
  writeFileSync(join(OUT, args.only ? 'results-only.json' : args['states-only'] ? 'results-states.json' : 'results.json'), JSON.stringify(results, null, 1));
  const sum = (f) => results.filter(f).length;
  console.log(JSON.stringify({
    jobs: results.length,
    fatal: sum((r) => r.fatal),
    consoleErrors: sum((r) => r.console?.some((c) => !c.startsWith('warning'))),
    hscroll: sum((r) => r.checks?.hscroll > 0),
    truncated: sum((r) => r.checks?.truncated.length),
    overlaps: sum((r) => r.checks?.overlaps.length),
    smallTargets: sum((r) => r.checks?.small.length),
    badText: sum((r) => r.checks?.bad.length),
    untranslated: sum((r) => r.checks?.untranslated.length),
    axeSerious: sum((r) => r.axe?.some((v) => v.impact === 'critical' || v.impact === 'serious')),
  }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
