import { t } from '@/i18n';

/** Asia/Tashkent bo‘yicha sana/vaqt yordamchilari (TZ 0: foydalanuvchiga Toshkent vaqtida ko‘rsatiladi). */

const MONTHS_FULL = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: string;
  minute: string;
}

function parts(value: string | Date): Parts {
  const date = value instanceof Date ? value : new Date(value);
  const map = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day), hour: map.hour!, minute: map.minute! };
}

/** «14:05» (Toshkent vaqti). */
export function clock(value: string | Date): string {
  const p = parts(value);
  return `${p.hour}:${p.minute}`;
}

export function dayKey(value: string | Date): string {
  const p = parts(value);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function daysBetween(a: string | Date, b: string | Date): number {
  const [ay, am, ad] = dayKey(a).split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = dayKey(b).split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Kun ajratgichi: «Bugun», «Kecha» yoki «24 sentabr» (boshqa yil bo‘lsa yili bilan). */
export function dayLabel(value: string | Date, now: Date = new Date()): string {
  const diff = daysBetween(value, now);
  if (diff === 0) return t('Bugun');
  if (diff === 1) return t('Kecha');
  const p = parts(value);
  const base = `${p.day} ${MONTHS_FULL[p.month - 1]}`;
  return p.year === parts(now).year ? base : `${base} ${p.year}`;
}
