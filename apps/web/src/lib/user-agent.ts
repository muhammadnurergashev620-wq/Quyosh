import { t } from '@/i18n';
export type DeviceKind = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface DeviceDescription {
  browser: string;
  os: string;
  kind: DeviceKind;
}

export function describeDevice(userAgent: string | null | undefined): DeviceDescription {
  const ua = userAgent ?? '';
  if (!ua) return { browser: t('Noma’lum brauzer'), os: t('Noma’lum qurilma'), kind: 'unknown' };

  let browser = 'Brauzer';
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser\//.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\/|CriOS\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/^(curl|node|undici|PostmanRuntime|insomnia)/i.test(ua)) browser = 'Dastur (API)';

  let os = t('Noma’lum tizim');
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux|X11/.test(ua)) os = 'Linux';

  let kind: DeviceKind = 'desktop';
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) kind = 'tablet';
  else if (/iPhone|iPod|Android|Mobile/.test(ua)) kind = 'mobile';
  else if (browser === 'Dastur (API)') kind = 'unknown';

  return { browser, os, kind };
}
