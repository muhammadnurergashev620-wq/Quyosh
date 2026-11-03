import { isIP } from 'node:net';

export interface IpLocation {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  provider: string;
}

const CACHE_TTL_MS = 3_600_000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; value: IpLocation | null }>();

/** Lokal/ichki tarmoq manzillari uchun joylashuvni aniqlab bo‘lmaydi. */
export function isPrivateIp(ip: string): boolean {
  const value = ip.replace(/^::ffff:/, '');
  if (isIP(value) === 4) {
    const [a = 0, b = 0] = value.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  const lower = value.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

/**
 * IP bo‘yicha taxminiy joylashuv (shahar darajasida). Tashqi xizmat (ipwho.is, HTTPS) 3 soniya ichida javob bermasa — null.
 * Faqat hujumchi/urinuvchi IP si yuboriladi; natija 1 soat keshlanadi.
 */
export async function lookupIpLocation(ip: string): Promise<IpLocation | null> {
  if (!ip || isIP(ip.replace(/^::ffff:/, '')) === 0 || isPrivateIp(ip)) return null;
  const key = ip.replace(/^::ffff:/, '');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  let value: IpLocation | null = null;
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(key)}?fields=success,country,region,city,latitude,longitude,connection`, { signal: AbortSignal.timeout(3000) });
    const data = (await response.json()) as {
      success?: boolean;
      country?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      connection?: { isp?: string; org?: string };
    };
    if (data.success) {
      value = {
        country: data.country ?? '',
        region: data.region ?? '',
        city: data.city ?? '',
        latitude: data.latitude ?? 0,
        longitude: data.longitude ?? 0,
        provider: data.connection?.isp ?? data.connection?.org ?? '',
      };
    }
  } catch {
    value = null;
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** User-Agent dan qisqa «brauzer · tizim · qurilma turi». */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  if (!ua) return 'noma’lum qurilma';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl|python|okhttp|axios|node/i.test(ua) ? 'dastur/skript' : 'brauzer';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux|X11/.test(ua) ? 'Linux' : 'noma’lum tizim';
  const kind = /Mobile|Android|iPhone/.test(ua) ? 'telefon' : /iPad|Tablet/.test(ua) ? 'planshet' : 'kompyuter';
  return `${browser} · ${os} · ${kind}`;
}
