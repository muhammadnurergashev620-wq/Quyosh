/**
 * Yordam markazi SLA (TZ 4.20, 17.2): birinchi javob muddati ish vaqti bo‘yicha —
 * Dushanba–Juma 09:00–18:00 Asia/Tashkent (UTC+5, yozgi vaqt yo‘q). Dam olish kunlari va 18:00 dan keyin hisoblanmaydi.
 */
export const WORK_START = 9;
export const WORK_END = 18;
const TZ_OFFSET_MS = 5 * 3_600_000;
const HOUR = 3_600_000;

export type Priority = 'URGENT' | 'HIGH' | 'NORMAL';
export const SLA_HOURS: Record<Priority, number> = { URGENT: 1, HIGH: 2, NORMAL: 4 };

/** Kategoriya → standart ustuvorlik. */
export const SUPPORT_CATEGORIES = ['ACCOUNT', 'CALCULATOR', 'REQUEST_QUOTE', 'INSTALLATION', 'SHOP', 'TECHNICAL', 'SECURITY', 'OTHER'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export const CATEGORY_PRIORITY: Record<SupportCategory, Priority> = {
  ACCOUNT: 'NORMAL', CALCULATOR: 'NORMAL', REQUEST_QUOTE: 'HIGH', INSTALLATION: 'HIGH', SHOP: 'NORMAL', TECHNICAL: 'HIGH', SECURITY: 'URGENT', OTHER: 'NORMAL',
};

/** Toshkent "devor soati" sifatida ishlash uchun: UTC vaqtni +5 ga siljitib, getUTC* bilan o‘qiymiz. */
const local = (ms: number) => new Date(ms + TZ_OFFSET_MS);
const isWorkday = (d: Date) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;

/** Berilgan vaqtdan keyingi eng yaqin ish vaqti boshlanishi (agar hozir ish vaqti bo‘lsa — o‘zi). */
export function nextWorkMoment(at: Date): Date {
  let ms = at.getTime();
  for (let i = 0; i < 14; i += 1) {
    const l = local(ms);
    const h = l.getUTCHours() + l.getUTCMinutes() / 60 + l.getUTCSeconds() / 3600;
    if (isWorkday(l) && h >= WORK_START && h < WORK_END) return new Date(ms);
    const dayStart = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - TZ_OFFSET_MS;
    if (isWorkday(l) && h < WORK_START) return new Date(dayStart + WORK_START * HOUR);
    ms = dayStart + 24 * HOUR + WORK_START * HOUR;
    const n = local(ms);
    if (isWorkday(n)) return new Date(ms);
  }
  return new Date(ms);
}

/** Ish soatlarini qo‘shish. */
export function addBusinessHours(start: Date, hours: number): Date {
  let at = nextWorkMoment(start);
  let left = hours * HOUR;
  for (let i = 0; i < 60 && left > 0; i += 1) {
    const l = local(at.getTime());
    const dayEnd = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - TZ_OFFSET_MS + WORK_END * HOUR;
    const available = dayEnd - at.getTime();
    if (left <= available) return new Date(at.getTime() + left);
    left -= available;
    at = nextWorkMoment(new Date(dayEnd + 1));
  }
  return at;
}

export function firstResponseDue(createdAt: Date, priority: Priority): Date {
  return addBusinessHours(createdAt, SLA_HOURS[priority]);
}

export const formatTicketNumber = (n: number) => `SUP-${String(n).padStart(6, '0')}`;
