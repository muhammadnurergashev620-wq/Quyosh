/**
 * Tayyor (build qilingan) saytni juda tez uzatadigan kichik server — dev serverdan bir necha baravar tez.
 *  - matn fayllari oldindan brotli/gzip bilan siqiladi (xotirada), /assets doimiy keshlanadi;
 *  - video/surat uchun Range (qismlab yuklash) qo‘llab-quvvatlanadi;
 *  - /api so‘rovlari backendga o‘tkaziladi (bir domen, CORS yo‘q);
 *  - SPA: noma’lum yo‘llar index.html ga qaytadi.
 * Ishlatish: node scripts/serve-dist.mjs <port> <papka> [backend=http://127.0.0.1:3000]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [, , portArg, dirArg, apiArg = 'http://127.0.0.1:3000'] = process.argv;
const port = Number(portArg);
const root = path.resolve(dirArg);
const api = new URL(apiArg);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt', '.md']);

/** @type {Map<string, {file:string,size:number,type:string,br?:Buffer,gz?:Buffer,raw?:Buffer,ext:string}>} */
const files = new Map();
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else {
      const ext = path.extname(entry.name).toLowerCase();
      const url = '/' + path.relative(root, full).split(path.sep).join('/');
      const stat = fs.statSync(full);
      const item = { file: full, size: stat.size, type: TYPES[ext] ?? 'application/octet-stream', ext };
      if (COMPRESSIBLE.has(ext) && stat.size < 4_000_000) {
        const raw = fs.readFileSync(full);
        item.raw = raw;
        item.br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 8, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } });
        item.gz = zlib.gzipSync(raw, { level: 9 });
      }
      files.set(url, item);
    }
  }
}
scan(root);
const index = files.get('/index.html');
if (!index) throw new Error(`${root}/index.html topilmadi — avval build qiling`);

const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };

function proxy(req, res) {
  const upstream = http.request(
    { host: api.hostname, port: api.port || 80, method: req.method, path: req.url, headers: { ...req.headers, 'x-forwarded-host': req.headers.host ?? '' } },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end('{"success":false,"message":"Backend javob bermayapti"}');
  });
  req.pipe(upstream);
}

function send(req, res, url, item, status = 200) {
  const headers = { 'Content-Type': item.type, ...SECURITY };
  if (url.startsWith('/assets/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  else if (item.ext === '.html') headers['Cache-Control'] = 'no-cache';
  else headers['Cache-Control'] = 'public, max-age=86400';

  if (item.br) {
    const accept = String(req.headers['accept-encoding'] ?? '');
    headers.Vary = 'Accept-Encoding';
    let body = item.raw;
    if (/\bbr\b/.test(accept)) { body = item.br; headers['Content-Encoding'] = 'br'; }
    else if (/\bgzip\b/.test(accept)) { body = item.gz; headers['Content-Encoding'] = 'gzip'; }
    headers['Content-Length'] = body.length;
    res.writeHead(status, headers);
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  headers['Accept-Ranges'] = 'bytes';
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  if (range) {
    let start = range[1] ? Number(range[1]) : item.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : item.size - 1;
    start = Math.max(0, start); end = Math.min(item.size - 1, end);
    if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${item.size}` }); return res.end(); }
    headers['Content-Range'] = `bytes ${start}-${end}/${item.size}`;
    headers['Content-Length'] = end - start + 1;
    res.writeHead(206, headers);
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(item.file, { start, end }).pipe(res);
  }
  headers['Content-Length'] = item.size;
  res.writeHead(status, headers);
  return req.method === 'HEAD' ? res.end() : fs.createReadStream(item.file).pipe(res);
}

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (url.startsWith('/api/')) return proxy(req, res);
    if (url.includes('..')) { res.writeHead(400); return res.end(); }
    const exact = files.get(url) ?? (url.endsWith('/') ? files.get(`${url}index.html`) : undefined);
    if (exact) return send(req, res, url, exact);
    // fayl kengaytmasi bor, lekin topilmadi (masalan /media/hero/portal.mp4) — 404, SPA index.html emas
    if (path.extname(url)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    return send(req, res, '/index.html', index);
  })
  .listen(port, '0.0.0.0', () => console.log(`serve-dist :${port} ← ${root} (${files.size} fayl) → ${api.origin}`));
