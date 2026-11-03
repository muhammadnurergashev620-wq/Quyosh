import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { fileURLToPath, URL } from 'node:url';

const PANELS: Record<string, { label: string; color: string }> = {
  CUSTOMER: { label: 'Mijoz paneli', color: '#2563EB' },
  SHOP: { label: 'Do‘kon paneli', color: '#059669' },
  ADMIN: { label: 'Admin paneli', color: '#1E3A8A' },
};

/** Frontend uchun Content-Security-Policy: faqat o‘z manbalar, API va kerakli tashqi xizmatlar (xarita, shriftlar). */
function buildCsp(html: string, apiBase: string | undefined): string {
  let apiOrigin = '';
  try {
    if (apiBase) apiOrigin = new URL(apiBase).origin;
  } catch {
    /* noto‘g‘ri URL — faqat 'self' */
  }
  // Index.html ichidagi inline mavzu skripti hash bilan ruxsat etiladi (unsafe-inline kerak emas).
  const inlineHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1] ?? '').digest('base64')}'`);
  return [
    "default-src 'self'",
    `script-src 'self' https://accounts.google.com ${inlineHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: https: ${apiOrigin}`.trim(),
    `media-src 'self' blob: https: ${apiOrigin}`.trim(),
    `connect-src 'self' https://accounts.google.com ${apiOrigin}`.trim(),
    "frame-src https://accounts.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * Interfeys o‘lchami: src/ ichidagi CSS'dagi barcha `px` build paytida `rem` ga o‘tkaziladi (1rem = 16px),
 * ildiz shrift esa 90% (global.css) — natijada butun interfeys aniq 10% kichik. vw/vh va @media o‘zgarmaydi,
 * 1px va undan ingichka chiziqlar ham o‘zgarmaydi. (CSS `zoom` ishlatilmaydi: u vw/vh va xarita koordinatalarini buzadi.)
 */
/** Yozuv va tugma o‘lchamlari qo‘shimcha 10% katta: font-size/font va tugma tokenlari (balandlik, shrift, ichki bo‘shliq). */
const TEXT_SCALE = 1.1;
const SCALED_TOKENS = /^--gm-(btn-(h|fs|px)|card-(title|label)-size)/;
/** Bosh sahifa va kirish sahifalari o‘z o‘lchamlariga ega — ular yuqoridagi qo‘shimcha kattalashtirishdan chiqarilgan. */
const SCALE_EXCLUDED = /\/src\/(pages\/landing\/|layouts\/AuthLayout)/;

const done = new WeakSet<object>();
const pxToRem = {
  postcssPlugin: 'quyosh-px-to-rem',
  Declaration(decl: { prop: string; value: string; source?: { input?: { file?: string } } }) {
    const file = decl.source?.input?.file?.replace(/\\/g, '/') ?? '';
    if (!file.includes('/src/') || done.has(decl)) return;
    const scaleText = !SCALE_EXCLUDED.test(file) && (decl.prop === 'font-size' || decl.prop === 'font' || SCALED_TOKENS.test(decl.prop));
    const k = scaleText ? TEXT_SCALE : 1;
    let next = decl.value;
    if (next.includes('px')) {
      next = next.replace(/(-?\d*\.?\d+)px\b/g, (match, n: string) => (Math.abs(Number(n)) <= 1 ? match : `${+((Number(n) * k) / 16).toFixed(4)}rem`));
    }
    // rem bilan yozilgan shriftlar ham shu koeffitsientga (px dan o‘tkazilganlari allaqachon hisoblangan)
    if (scaleText && decl.value === next && /rem\b/.test(next) && !next.includes('var(')) {
      next = next.replace(/(-?\d*\.?\d+)rem\b/g, (_m, n: string) => `${+(Number(n) * k).toFixed(4)}rem`);
    }
    done.add(decl);
    if (next !== decl.value) decl.value = next;
  },
};

/** Butun loyiha uchun BITTA .env — loyiha ildizida (apps/web ichida .env fayllari yo‘q). */
const ENV_DIR = fileURLToPath(new URL('../..', import.meta.url));
/** Panel roli rejimdan olinadi: `vite --mode customer|shop|admin`. Rejimsiz (asosiy sayt) — rol yo‘q. */
const ROLE_BY_MODE: Record<string, string> = { customer: 'CUSTOMER', shop: 'SHOP', admin: 'ADMIN' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, '');
  const role = ROLE_BY_MODE[mode] ?? env.VITE_APP_ROLE ?? '';
  const panel = PANELS[role];
  // Google client ID backend bilan umumiy: alohida VITE_ qiymat bo‘lmasa, GOOGLE_CLIENT_ID dan olinadi.
  const googleClientId = env.VITE_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || '';

  return {
    envDir: ENV_DIR,
    define: {
      'import.meta.env.VITE_APP_ROLE': JSON.stringify(role),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
    },
    plugins: [
      react(),
      {
        // Faqat production build: dev serverda HMR uchun CSP qo‘yilmaydi.
        name: 'quyosh-csp',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler: (html: string) =>
            html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${buildCsp(html, env.VITE_API_BASE_URL)}" />`),
        },
      },
      {
        name: 'quyosh-panel',
        transformIndexHtml: (html: string) =>
          panel
            ? html
                .replace('<title>Quyosh</title>', `<title>Quyosh — ${panel.label}</title>`)
                .replace('content="#2563EB"', `content="${panel.color}"`)
                .replace('<html ', `<html data-panel="${role}" `)
            : html,
        configureServer(server) {
          if (!panel) return;
          server.httpServer?.once('listening', () => {
            setTimeout(() => console.log(`\n  ➜  ${panel.label.toUpperCase()} (${role})\n`), 50);
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      allowedHosts: true,
      proxy: { '/api': { target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000', changeOrigin: false } },
      port: 5173,
      strictPort: true,
    },
    // Production'da kod minifikatsiya qilinadi, source map chiqarilmaydi, console/debugger olib tashlanadi.
    esbuild: mode === 'development' ? undefined : { drop: ['console', 'debugger'], legalComments: 'none' },
    css: { postcss: { plugins: [pxToRem] } },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  };
});
