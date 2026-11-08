import { t } from '@/i18n';
import { dayKey } from '@/lib/tashkent-time';
import { notificationMeta } from './notification-meta';
import type { AppNotification } from './types';

/** Bildirishnoma qaysi yorliqqa tushadi (panel va sahifa yorliqlari). */
export type NotificationGroup = 'offers' | 'install' | 'system';
export type NotificationFilter = 'all' | 'unread' | NotificationGroup;

/** Ikonka doirasi rangi: taklif — ko‘k, montaj — yashil, chat — binafsha, ogohlantirish — sariq, xato/xavf — qizil, tizim — kulrang. */
export type NotificationColor = 'blue' | 'green' | 'violet' | 'yellow' | 'red' | 'gray';

const OFFER = /^(QUOTE_|SITE_VISIT_)/;
const INSTALL = /^(INSTALLATION_|MAINTENANCE_|WARRANTY_)/;
const CHAT = /^(NEW_MESSAGE|SUPPORT_)/;

export function notificationGroup(item: AppNotification): NotificationGroup {
  const template = item.template ?? '';
  if (OFFER.test(template) || CHAT.test(template)) return 'offers';
  if (INSTALL.test(template)) return 'install';
  const entity = typeof item.data?.entityType === 'string' ? item.data.entityType : '';
  if (entity === 'Quote' || entity === 'QuoteRequest' || entity === 'RequestShop') return 'offers';
  if (entity === 'Installation' || entity === 'InstalledSystem') return 'install';
  return 'system';
}

export function notificationColor(item: AppNotification, base: '/mijoz' | '/dokon', admin: boolean): NotificationColor {
  const template = item.template ?? '';
  const { tone } = notificationMeta(item, base, admin);
  if (tone === 'danger' || /ALERT|ISSUE/.test(template)) return 'red';
  if (tone === 'warning' || /EXPIRING|REMINDER/.test(template)) return 'yellow';
  if (CHAT.test(template)) return 'violet';
  const group = notificationGroup(item);
  if (group === 'offers') return 'blue';
  if (group === 'install') return 'green';
  return tone === 'success' ? 'green' : 'gray';
}

export function matchesFilter(item: AppNotification, filter: NotificationFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unread') return item.status !== 'READ';
  return notificationGroup(item) === filter;
}

export const FILTERS: Array<{ value: NotificationFilter; label: () => string }> = [
  { value: 'all', label: () => t('Hammasi') },
  { value: 'unread', label: () => t('O‘qilmagan') },
  { value: 'offers', label: () => t('Takliflar') },
  { value: 'install', label: () => t('Montaj') },
  { value: 'system', label: () => t('Tizim') },
];

type Bucket = 'today' | 'yesterday' | 'week' | 'older';
const BUCKET_LABEL: Record<Bucket, () => string> = {
  today: () => t('Bugun'),
  yesterday: () => t('Kecha'),
  week: () => t('Shu hafta'),
  older: () => t('Oldinroq'),
};

function daysAgo(value: string, now: Date): number {
  const [ay, am, ad] = dayKey(value).split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = dayKey(now).split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

function bucketOf(value: string, now: Date): Bucket {
  const diff = daysAgo(value, now);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return 'week';
  return 'older';
}

/** Bugun · Kecha · Shu hafta · Oldinroq guruhlari (ro‘yxat yangidan eskiga tartiblangan deb olinadi). */
export function groupByDate(items: AppNotification[], now: Date = new Date()): Array<{ key: Bucket; label: string; items: AppNotification[] }> {
  const result: Array<{ key: Bucket; label: string; items: AppNotification[] }> = [];
  for (const item of items) {
    const key = bucketOf(item.createdAt, now);
    const last = result[result.length - 1];
    if (last?.key === key) last.items.push(item);
    else result.push({ key, label: BUCKET_LABEL[key](), items: [item] });
  }
  return result;
}
