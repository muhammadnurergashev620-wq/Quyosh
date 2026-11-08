import '@/features/shop/shop.css';
import '@/features/catalog/catalog.css';
import '@/features/m7/m7.css';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Hozir ochiqmi (Toshkent vaqti bo‘yicha). */
export function openNow(hours: Partial<Record<string, Array<[string, string]>>> | null, now = new Date()): boolean | null {
  if (!hours) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((part) => [part.type, part.value]));
  const day = DAY_KEYS[['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday ?? '')];
  const time = `${parts.hour}:${parts.minute}`;
  return !!day && !!hours[day]?.some(([from, to]) => time >= from && time < to);
}
