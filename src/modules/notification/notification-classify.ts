export type NotificationCategory = 'SHOP' | 'DISPUTE' | 'DOCUMENT' | 'USER' | 'ORDER' | 'CHAT' | 'CONTENT' | 'SYSTEM';
export type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = ['SHOP', 'ORDER', 'DISPUTE', 'DOCUMENT', 'USER', 'CHAT', 'CONTENT', 'SYSTEM'];

const starts = (value: string, prefixes: string[]) => prefixes.some((prefix) => value.startsWith(prefix));

/** Bildirishnoma turi (Quyosh): audit amali (`admin.audit`) yoki shablon/tur nomidan aniqlanadi. */
export function categoryOf(template: string | null | undefined, action: string | null | undefined): NotificationCategory {
  const key = action ?? '';
  const tpl = (template ?? '').toUpperCase();
  if (starts(key, ['INSTALLATION_DISPUTE', 'COMPLAINT_', 'REVIEW_MODERATED']) || starts(tpl, ['INSTALLATION_DISPUTE', 'COMPLAINT'])) return 'DISPUTE';
  if (starts(key, ['SHOP_BADGE_', 'POLICY_']) || starts(tpl, ['CERTIFICATION_'])) return 'DOCUMENT';
  if (starts(key, ['SHOP_', 'WIDGET_', 'OFFER_', 'IMPORT_'])) return 'SHOP';
  if (starts(key, ['AUTH_', 'ADMIN_', 'USER_'])) return 'USER';
  if (starts(key, ['QUOTE', 'INSTALLATION_', 'LEAD_', 'CALCULATION_', 'SITE_CREATED', 'SITE_ARCHIVED']) || starts(tpl, ['QUOTE', 'INSTALLATION', 'SITE_VISIT'])) return 'ORDER';
  if (starts(key, ['SUPPORT_']) || starts(tpl, ['MESSAGE', 'CHAT', 'SUPPORT'])) return 'CHAT';
  if (starts(key, ['ARTICLE_', 'SITE_BLOCK', 'CATEGORY_', 'PRODUCT_MODEL_'])) return 'CONTENT';
  return 'SYSTEM';
}

const HIGH_ACTIONS = new Set(['ADMIN_USER_DELETED', 'SHOP_SUSPENDED', 'SHOP_OWNER_CHANGED', 'INSTALLATION_DISPUTE_RESOLVED', 'ADMIN_SUPERADMIN_GRANTED', 'ADMIN_PERMISSIONS_CHANGED']);

/** Muhimlik darajasi: o‘chirish, do‘konni to‘xtatish, egalik/huquq o‘zgarishi, montaj nizosi — yuqori; hujjat va nizolar — o‘rta; qolgani — past. */
export function priorityOf(template: string | null | undefined, action: string | null | undefined): NotificationPriority {
  const key = action ?? '';
  if (HIGH_ACTIONS.has(key)) return 'HIGH';
  const category = categoryOf(template, action);
  if (category === 'DOCUMENT' || category === 'DISPUTE') return 'MEDIUM';
  if (starts(key, ['ADMIN_USER_', 'SHOP_PASSWORD_RESET', 'SHOP_MEMBER_'])) return 'MEDIUM';
  return 'LOW';
}
