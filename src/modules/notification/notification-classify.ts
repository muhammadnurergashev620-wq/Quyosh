export type NotificationCategory = 'PAYMENT' | 'DISPUTE' | 'DOCUMENT' | 'USER' | 'ORDER' | 'CHAT' | 'POST' | 'SYSTEM';
export type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = ['PAYMENT', 'DISPUTE', 'DOCUMENT', 'USER', 'ORDER', 'CHAT', 'POST', 'SYSTEM'];

const starts = (value: string, prefixes: string[]) => prefixes.some((prefix) => value.startsWith(prefix));

/** Bildirishnoma turi: audit amali (`admin.audit`) yoki shablon nomidan aniqlanadi. */
export function categoryOf(template: string | null | undefined, action: string | null | undefined): NotificationCategory {
  const key = action ?? '';
  const tpl = template ?? '';
  if (starts(key, ['PAYMENT_']) || starts(tpl, ['payment.'])) return 'PAYMENT';
  if (starts(key, ['DISPUTE_', 'COMPLAINT_', 'APPEAL_', 'WARRANTY_CLAIM_']) || key === 'ORDER_DISPUTED') return 'DISPUTE';
  if (starts(key, ['VERIFICATION_', 'ADMIN_PORTFOLIO_', 'MASTER_PROFILE_']) || starts(tpl, ['trust.', 'portfolio.'])) return 'DOCUMENT';
  if (starts(key, ['AUTH_', 'ADMIN_USER_', 'USER_'])) return 'USER';
  if (starts(key, ['ADMIN_ORDER_', 'ORDER_']) || starts(tpl, ['order.', 'matching.', 'offer.'])) return 'ORDER';
  if (starts(key, ['CHAT_']) || starts(tpl, ['chat.', 'call.'])) return 'CHAT';
  if (starts(key, ['WORK_POST_'])) return 'POST';
  return 'SYSTEM';
}

const HIGH_ACTIONS = new Set(['ORDER_DISPUTED', 'PAYMENT_WEBHOOK_MISMATCH', 'ADMIN_USER_DELETED', 'ADMIN_USER_SUSPENDED', 'USER_ACTION_CREATED', 'APPEAL_CREATED', 'WARRANTY_CLAIM_CREATED', 'ADMIN_ORDER_CANCELLED', 'PAYMENT_REFUNDED']);

/** Muhimlik darajasi: nizo, to‘lov nomuvofiqligi va cheklov/o‘chirish — yuqori; to‘lov, hujjat, shikoyat — o‘rta; qolgani — past. */
export function priorityOf(template: string | null | undefined, action: string | null | undefined): NotificationPriority {
  const key = action ?? '';
  const tpl = template ?? '';
  if (HIGH_ACTIONS.has(key) || key.startsWith('DISPUTE_') || tpl === 'payment.failed') return 'HIGH';
  const category = categoryOf(template, action);
  if (category === 'PAYMENT' || category === 'DOCUMENT' || category === 'DISPUTE') return 'MEDIUM';
  if (starts(key, ['ADMIN_ORDER_', 'ADMIN_USER_'])) return 'MEDIUM';
  return 'LOW';
}
