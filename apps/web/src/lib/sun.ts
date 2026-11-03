/**
 * Quyosh chiqishi/botishi (NOAA soddalashtirilgan algoritmi). TZ 11.2 / U1.3: faqat UI bezagi uchun klientda hisoblanadi —
 * kWh hisobi har doim serverda. Vaqt Asia/Tashkent (UTC+5, yozgi vaqt yo‘q).
 */
const RAD = Math.PI / 180;
const TZ_OFFSET_MIN = 300;

export const TASHKENT = { lat: 41.2995, lon: 69.2401 };

export interface SunTimes {
  /** Mahalliy (Toshkent) vaqt bo‘yicha daqiqalar, kun boshidan. */
  sunrise: number;
  sunset: number;
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

export function sunTimes(date: Date, lat = TASHKENT.lat, lon = TASHKENT.lon): SunTimes {
  const n = dayOfYear(date);
  const gamma = ((2 * Math.PI) / 365) * (n - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const cosHa = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
  const ha = Math.acos(Math.min(1, Math.max(-1, cosHa))) / RAD;
  const noonUtc = 720 - 4 * lon - eqTime;
  return { sunrise: noonUtc - 4 * ha + TZ_OFFSET_MIN, sunset: noonUtc + 4 * ha + TZ_OFFSET_MIN };
}

/** Toshkent vaqti bo‘yicha kun boshidan o‘tgan daqiqalar. */
export function localMinutes(date: Date): number {
  return (((date.getUTCHours() * 60 + date.getUTCMinutes() + TZ_OFFSET_MIN) % 1440) + 1440) % 1440;
}

export const hhmm = (minutes: number) => {
  const m = Math.round(((minutes % 1440) + 1440) % 1440);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export type DayPeriod = 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT';

/** U1.3: tong (chiqishdan +2 soat), kunduz, kech (botishdan 1,5 soat oldin), tun. */
export function sunState(date = new Date()) {
  const times = sunTimes(date);
  const now = localMinutes(date);
  const arc = (now - times.sunrise) / (times.sunset - times.sunrise);
  const period: DayPeriod = now < times.sunrise || now > times.sunset ? 'NIGHT' : now < times.sunrise + 120 ? 'DAWN' : now > times.sunset - 90 ? 'DUSK' : 'DAY';
  return { ...times, now, arc: Math.min(1, Math.max(0, arc)), period, daylight: times.sunset - times.sunrise };
}
