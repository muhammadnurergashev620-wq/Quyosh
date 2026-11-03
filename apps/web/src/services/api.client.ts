import { env } from '@/lib/env';
import { ApiError, type ApiEnvelope } from '@/types/api';
import { reportClientError } from '@/lib/error-reporter';
import { t } from '@/i18n';

const AUTH_PATH_PREFIX = '/auth/';

const PANEL_HEADERS: Record<string, string> = env.appRole ? { 'X-App-Panel': env.appRole } : {};

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: PANEL_HEADERS,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export const SESSION_EXPIRED_EVENT = 'quyosh:session-expired';

let lastSessionExpiredAt = 0;

function notifySessionExpired(): void {
  // Bir nechta fon so'rovi bir vaqtda 401 qaytarsa ham, faqat bitta xabar ko'rsatiladi.
  const now = Date.now();
  if (now - lastSessionExpiredAt < 3000) return;
  lastSessionExpiredAt = now;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = { ...PANEL_HEADERS };
  if (!isFormData && options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let response: Response;
  let sessionExpired = false;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: isFormData ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (cause) {
    if (!(cause instanceof DOMException && cause.name === 'AbortError') && !path.startsWith('/client-errors')) {
      reportClientError({ kind: 'NETWORK', message: t('Internet aloqasi yo’q yoki server javob bermayapti.'), method: options.method ?? 'GET', path, status: 0, code: 'NETWORK_ERROR' });
    }
    throw new ApiError({
      statusCode: 0,
      code: 'NETWORK_ERROR',
      message: t('Internet aloqasi yo’q yoki server javob bermayapti.'),
      requestId: null,
    });
  }

  if (response.status === 401 && !isRetry && !path.startsWith(AUTH_PATH_PREFIX)) {
    const recovered = await refreshSession();
    if (recovered) return request<T>(path, options, true);
    notifySessionExpired();
    sessionExpired = true;
  }

  const text = await response.text();
  const envelope: ApiEnvelope<T> | null = text ? (JSON.parse(text) as ApiEnvelope<T>) : null;

  if (!response.ok || !envelope || envelope.success === false) {
    if (envelope && envelope.success === false) {
      const error = new ApiError(envelope);
      error.sessionExpired = sessionExpired;
      throw error;
    }
    throw new ApiError({
      statusCode: response.status,
      code: 'UNKNOWN_ERROR',
      message: t('Server kutilmagan javob qaytardi ({status}).', { status: response.status }),
      requestId: null,
    });
  }

  return envelope.data;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'GET', signal });
}

export function apiPost<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  return request<T>(path, { method: 'POST', body: body ?? {}, idempotencyKey });
}

export function apiUpload<T>(path: string, body: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: body ?? {} });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: body ?? {} });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

export interface StreamEvent {
  event: string;
  data: unknown;
}

/**
 * Server-Sent Events (SSE) oqimi: `fetch` bilan ochiladi, shuning uchun panel sarlavhasi va cookie yuboriladi
 * (brauzerning EventSource'i sarlavha qo‘sha olmaydi). Uzilsa — oshib boruvchi kutish bilan qayta ulanadi; 401 bo‘lsa sessiya yangilanadi.
 * Qaytgan funksiya oqimni to‘xtatadi.
 */
export function openEventStream(path: string, onEvent: (event: StreamEvent) => void, onStatus?: (connected: boolean) => void): () => void {
  const controller = new AbortController();
  let stopped = false;

  async function run() {
    let delay = 1000;
    while (!stopped) {
      try {
        const response = await fetch(`${env.apiBaseUrl}${path}`, {
          credentials: 'include',
          headers: { ...PANEL_HEADERS, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (response.status === 401) {
          if (!(await refreshSession())) {
            notifySessionExpired();
            await sleep(15_000);
          }
          continue;
        }
        if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
        onStatus?.(true);
        delay = 1000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let index: number;
          while ((index = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            const event = /^event: (.+)$/m.exec(chunk)?.[1];
            const data = /^data: (.+)$/m.exec(chunk)?.[1];
            if (event && data) {
              try {
                onEvent({ event, data: JSON.parse(data) as unknown });
              } catch {
                /* buzuq hodisa e’tiborsiz */
              }
            }
          }
        }
      } catch {
        if (stopped) return;
      }
      onStatus?.(false);
      if (stopped) return;
      await sleep(delay);
      delay = Math.min(delay * 2, 15_000);
    }
  }

  void run();
  return () => {
    stopped = true;
    controller.abort();
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Sahifa yopilayotganda (pagehide) ham yetib boradigan so‘rov: qo‘ng‘iroqni tugatish uchun. */
export function apiPostKeepalive(path: string, body: unknown = {}): void {
  try {
    void fetch(`${env.apiBaseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { ...PANEL_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    /* sahifa yopilmoqda */
  }
}

/** Xom fayl (masalan, qo‘ng‘iroq yozuvi) yuboradi; javob e'tiborga olinmaydi. */
export async function apiPostBlob(path: string, blob: Blob): Promise<void> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...PANEL_HEADERS, 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  });
  if (!response.ok) throw new Error(`upload ${response.status}`);
}

/** Faylni yuklab oladi (CSV va h.k.): panel sarlavhasi bilan so‘rov, so‘ng brauzerda saqlash. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, { credentials: 'include', headers: { ...PANEL_HEADERS } });
  if (!response.ok) {
    throw new ApiError({ statusCode: response.status, code: 'DOWNLOAD_FAILED', message: t('Faylni yuklab bo‘lmadi ({status}).', { status: response.status }), requestId: null });
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** POST, bekor qilinadigan (AbortController) — kalkulyatorda eski so‘rovni to‘xtatish uchun (U8.9). */
export function apiPostSignal<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'POST', body, signal });
}
