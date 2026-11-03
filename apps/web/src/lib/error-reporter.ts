import { env } from '@/lib/env';

/**
 * Veb va ilovadagi xatoliklarni serverdagi «Errorlar» bo‘limiga yuboradi (superadmin ko‘radi).
 * Asosiy API klientidan foydalanmaydi: xabar yuborishning o‘zi xatolik tug‘dirsa, aylanib qolmasin.
 */
export type ClientErrorKind = 'UI_CRASH' | 'UI_ERROR' | 'API_ERROR' | 'NETWORK';

export interface ClientErrorReport {
  kind: ClientErrorKind;
  message: string;
  stack?: string;
  status?: number;
  code?: string;
  method?: string;
  path?: string;
  requestId?: string | null;
  context?: Record<string, unknown>;
}

const MAX_PER_SESSION = 30;
const SAME_ERROR_WINDOW_MS = 30_000;
const recent = new Map<string, number>();
let sent = 0;

function platform(): 'web' | 'android' | 'ios' {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.();
  return cap === 'android' || cap === 'ios' ? cap : 'web';
}

export function reportClientError(report: ClientErrorReport): void {
  try {
    if (typeof window === 'undefined' || sent >= MAX_PER_SESSION) return;
    const key = `${report.kind}|${report.status ?? ''}|${report.path ?? ''}|${report.message.slice(0, 80)}`;
    const now = Date.now();
    if (now - (recent.get(key) ?? 0) < SAME_ERROR_WINDOW_MS) return;
    recent.set(key, now);
    sent += 1;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.appRole) headers['X-App-Panel'] = env.appRole;
    void fetch(`${env.apiBaseUrl}/client-errors`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers,
      body: JSON.stringify({
        ...report,
        message: report.message.slice(0, 2000),
        stack: report.stack?.slice(0, 8000),
        requestId: report.requestId ?? undefined,
        pageUrl: `${window.location.pathname}${window.location.hash ?? ''}`,
        platform: platform(),
        appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? undefined,
        context: { online: navigator.onLine, viewport: `${window.innerWidth}x${window.innerHeight}`, language: navigator.language, ...report.context },
      }),
    }).catch(() => undefined);
  } catch {
    // xabar yuborish hech qachon ilovani buzmasin
  }
}

let installed = false;

/** Ushlanmagan JS xatolari va rad etilgan promise’larni avtomatik yuboradi. */
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    // Rasm/skript yuklanmaganda (resurs xatosi) event.error bo‘lmaydi — shovqin, o‘tkazib yuboriladi.
    if (!event.error && !event.message) return;
    reportClientError({
      kind: 'UI_ERROR',
      message: event.message || String(event.error),
      stack: event.error instanceof Error ? event.error.stack : undefined,
      context: { source: event.filename, line: event.lineno, column: event.colno },
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as unknown;
    if (reason && typeof reason === 'object' && 'statusCode' in reason) return; // API xatolari serverda allaqachon yozilgan
    reportClientError({
      kind: 'UI_ERROR',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      context: { type: 'unhandledrejection' },
    });
  });
}
