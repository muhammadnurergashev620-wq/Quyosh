import { MONTHS, lang, t } from '@/i18n';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** Pul maydoni uchun: faqat raqamlar va birinchi raqam 0 bo‘lmaydi («0», «007» → «», «7»). Xato ko‘rsatilmaydi — 0 shunchaki yozilmaydi. */
export function sanitizeMoney(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  // Server chegarasi: 1 milliarddan oshmaydi.
  return digits.length > 10 || Number(digits) > 1_000_000_000 ? '1000000000' : digits;
}

/** Minglarga ajratgich: uz/ru — bo‘shliq, en — vergul. Brauzerdagi ICU ma’lumotiga bog‘liq emas, shuning uchun hamma joyda bir xil chiqadi. */
const THOUSANDS: Record<string, string> = { uz: ' ', 'uz-Cyrl': ' ', ru: ' ', en: ',' };

/** 31000000 → «31 000 000» (en: «31,000,000»). `joiner` — ajratgichni almashtirish (ko‘rsatishda uzilmaydigan bo‘shliq). */
export function formatNumber(value: number, joiner?: string): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(Math.abs(value));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, joiner ?? THOUSANDS[lang] ?? ' ');
  return value < 0 && rounded !== 0 ? `−${grouped}` : grouped;
}

export function formatMoney(amount: string | number, currency = 'UZS'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '—';
  // Uzilmaydigan bo‘shliq: summa va «UZS» alohida qatorga bo‘linib ketmaydi.
  return `${formatNumber(value, THOUSANDS[lang] === ',' ? ',' : '\u00A0')}\u00A0${currency}`;
}

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

/** `ms` — qolgan millisekund (masalan `useCountdown` dan). Kun/soat/daqiqa ko‘rinishida chiqaradi. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return t('Muddati tugagan');
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return t('{days} kun {hours} soat qoldi', { days, hours });
  if (hours > 0) return t('{hours} soat {minutes} daqiqa qoldi', { hours, minutes });
  if (minutes > 0) return t('{minutes} daqiqa qoldi', { minutes });
  return t('1 daqiqadan kam qoldi');
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function initials(name: string | null | undefined): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word));
  if (words.length === 0) return '•';
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

/** Raqamlarni minglik guruhlaydi: «200000» → «200 000» (kiritish maydoni uchun). */
/** Pul maydoni uchun raqamlarni minglarga ajratadi — ko‘rsatiladigan summalar (formatMoney) bilan bir xil ajratgich bilan. */
export function groupAmount(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits ? formatNumber(Number(digits)) : '';
}

export function groupDigits(value: string): string {
  return value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Daqiqani o‘qiladigan ko‘rinishga keltiradi: 90 → «1 soat 30 daqiqa», 45 → «45 daqiqa». */
export function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return '';
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  return [
    days && t('{n} kun', { n: days }),
    hours && t('{n} soat', { n: hours }),
    minutes && t('{n} daqiqa', { n: minutes }),
  ]
    .filter(Boolean)
    .join(' ');
}
