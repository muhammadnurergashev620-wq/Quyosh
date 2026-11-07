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
