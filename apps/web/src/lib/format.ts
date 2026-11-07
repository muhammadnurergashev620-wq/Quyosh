import { MONTHS, lang, t } from '@/i18n';

/**
 * Yagona formatlash moduli (TZ U3): son, pul, kasr, foiz, quvvat/energiya va sana — Asia/Tashkent.
 * Qoidalar: minglar bo‘shliq bilan (en — vergul), kasr vergul bilan (en — nuqta): «1 250 000 so‘m», «6,6 kVt».
 * Brauzer ICU ma’lumotiga bog‘liq emas — hamma joyda bir xil chiqadi.
 */

const THOUSANDS: Record<string, string> = { uz: ' ', 'uz-Cyrl': ' ', ru: ' ', en: ',' };
const DECIMAL: Record<string, string> = { uz: ',', 'uz-Cyrl': ',', ru: ',', en: '.' };

const groupInt = (digits: string, joiner: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, joiner);

/** 31000000 → «31 000 000» (en: «31,000,000»). `joiner` — ajratgichni almashtirish (ko‘rsatishda uzilmaydigan bo‘shliq). */
export function formatNumber(value: number, joiner?: string): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(Math.abs(value));
  const grouped = groupInt(String(rounded), joiner ?? THOUSANDS[lang] ?? ' ');
  return value < 0 && rounded !== 0 ? `−${grouped}` : grouped;
}

/**
 * Kasr son: 6.6 → «6,6» (en: «6.6»). `maxDigits` — ko‘pi bilan nechta kasr xona, `minDigits` — kamida
 * (reyting uchun 1: 4 → «4,0»). Ortiqcha nollar `minDigits` dan keyin olib tashlanadi.
 */
export function formatDecimal(value: number, maxDigits = 1, minDigits = 0): string {
  if (!Number.isFinite(value)) return '—';
  const fixed = Math.abs(value).toFixed(maxDigits);
  let [int, frac = ''] = fixed.split('.');
  while (frac.length > minDigits && frac.endsWith('0')) frac = frac.slice(0, -1);
  const text = groupInt(int!, THOUSANDS[lang] ?? ' ') + (frac ? (DECIMAL[lang] ?? ',') + frac : '');
  return value < 0 && Number(fixed) !== 0 ? `−${text}` : text;
}

/** Ulush (0..1) → «22 %», «22,5 %». */
export const formatPercent = (fraction: number, digits = 1) => `${formatDecimal(fraction * 100, digits)} %`;

/** Reyting: har doim bitta kasr xona — «4,6». */
export const formatRating = (value: number | string) => formatDecimal(Number(value), 1, 1);

export const formatKw = (value: number) => `${formatDecimal(value, 2)} ${t('kVt')}`;
export const formatKwh = (value: number) => `${formatNumber(value)} kWh`;

export function formatMoney(amount: string | number, currency = 'UZS'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '—';
  // Uzilmaydigan bo‘shliq: summa va valyuta alohida qatorga bo‘linib ketmaydi.
  return `${formatNumber(value, THOUSANDS[lang] === ',' ? ',' : ' ')} ${currency}`;
}

/** So‘mda: «1 250 000 so‘m». */
export const formatSum = (value: number | string) => formatMoney(value, t('so‘m'));

/** Katta summalar qisqa: «12,4 mln so‘m», «850 ming so‘m». */
export function formatSumShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${formatDecimal(value / 1e9, 1)} ${t('mlrd so‘m')}`;
  if (abs >= 1e6) return `${formatDecimal(value / 1e6, 1)} ${t('mln so‘m')}`;
  if (abs >= 1e3) return `${formatNumber(Math.round(value / 1e3))} ${t('ming so‘m')}`;
  return formatSum(value);
}

/** Fayl hajmi: «512 B», «12,4 KB», «3,25 MB». */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatDecimal(bytes / 1024, 1)} KB`;
  return `${formatDecimal(bytes / 1024 / 1024, 2)} MB`;
}

// ───────────── Sana va vaqt (Asia/Tashkent) ─────────────

const MONTH_NAMES = MONTHS[lang];

const tashkentParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(date: Date): Record<string, string> {
  return Object.fromEntries(tashkentParts.formatToParts(date).map((part) => [part.type, part.value]));
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${Number(p.day)} ${MONTH_NAMES[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

/** Faqat vaqt: «16:11» (Toshkent vaqti). */
export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
}

/** Qisqa sana: «9.10» (Toshkent vaqti). */
export function formatDayMonth(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${Number(p.day)}.${p.month}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${Number(p.day)} ${MONTH_NAMES[Number(p.month) - 1]} ${p.year}`;
}

const RELATIVE_UNITS: Array<[label: string, seconds: number]> = [
  ['yil', 365 * 86_400],
  ['oy', 30 * 86_400],
  ['kun', 86_400],
  ['soat', 3_600],
  ['daqiqa', 60],
];

/** «3 kun oldin» / «2 soatdan keyin» — tilga mos (rus tilida birlik qisqa). */
function relativeText(amount: number, unit: string, past: boolean): string {
  if (lang === 'ru') {
    const short: Record<string, string> = { yil: 'г.', oy: 'мес.', kun: 'дн.', soat: 'ч.', daqiqa: 'мин.' };
    return past ? `${amount} ${short[unit]} назад` : `через ${amount} ${short[unit]}`;
  }
  if (lang === 'en') return past ? `${amount} ${t(unit)} ago` : `in ${amount} ${t(unit)}`;
  const label = t(unit);
  if (lang === 'uz-Cyrl') return past ? `${amount} ${label} олдин` : `${amount} ${label}дан кейин`;
  return past ? `${amount} ${label} oldin` : t('{amount} {label}dan keyin', { amount, label });
}

export function formatRelativeTime(value: string | Date, now: number = Date.now()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return t('hozirgina');
  for (const [label, seconds] of RELATIVE_UNITS) {
    if (abs >= seconds || label === 'daqiqa') {
      const amount = Math.max(1, Math.round(abs / seconds));
      return relativeText(amount, label, diff < 0);
    }
  }
  return t('hozirgina');
}

// ───────────── Kiritish maydonlari va davomiylik ─────────────

/** Pul maydoni uchun raqamlarni minglarga ajratadi — ko‘rsatiladigan summalar (formatMoney) bilan bir xil ajratgich bilan. */
export function groupAmount(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits ? formatNumber(Number(digits)) : '';
}
