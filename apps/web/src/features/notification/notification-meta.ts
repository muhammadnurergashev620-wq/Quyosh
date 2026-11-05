import { t } from '@/i18n';
import { BadgeCheck, Bell, FileText, LifeBuoy, MessageSquare, ScrollText, ShieldCheck, Siren, Star, Sun, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppNotification } from './types';

export type NotificationTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface NotificationMeta {
  icon: LucideIcon;
  tone: NotificationTone;
  to?: string;
}

/** Admin audit bildirishnomasi turiga mos bo‘lim: bildirishnoma ochilmasa ham shu sahifaga kirilsa o‘qilgan bo‘ladi. */
export function adminAuditPath(action: string, fallback?: unknown): string {
  if (action.startsWith('SHOP_') || action.startsWith('VERIFICATION_')) return '/admin/dokonlar';
  if (action === 'AUTH_REGISTERED' || action === 'AUTH_REGISTRATION_VERIFIED' || action.startsWith('ADMIN_USER_')) return '/admin/foydalanuvchilar';
  return typeof fallback === 'string' ? fallback : '/admin/audit';
}

/** Eski yozuvlarda `entityType` yo‘q — shablon bo‘yicha taxmin (TZ 14.2 turlari). */
const TEMPLATE_ENTITY: Record<string, string> = {
  QUOTE_REQUEST_RECEIVED: 'RequestShop', NEW_MESSAGE: 'RequestShop', SITE_VISIT_PROPOSED: 'RequestShop', SITE_VISIT_CONFIRMED: 'RequestShop', QUOTE_NOT_SELECTED: 'RequestShop',
  QUOTE_RECEIVED: 'Quote', QUOTE_REVISED: 'Quote', QUOTE_EXPIRING: 'Quote',
  QUOTE_ACCEPTED: 'Installation', INSTALLATION_STATUS_CHANGED: 'Installation', INSTALLATION_CONFIRM_REMINDER: 'Installation', INSTALLATION_ISSUE_REPORTED: 'Installation',
  REVIEW_PUBLISHED: 'Review', REVIEW_REPLY: 'Review',
  MAINTENANCE_REMINDER: 'InstalledSystem', WARRANTY_EXPIRING: 'InstalledSystem',
  SUPPORT_REPLY: 'SupportTicket', SUPPORT_RESOLVED: 'SupportTicket',
  CERTIFICATION_RESULT: 'ShopCertification', CERTIFICATION_EXPIRING: 'ShopCertification',
};

const ENTITY_ICON: Record<string, LucideIcon> = {
  RequestShop: MessageSquare, Quote: FileText, QuoteRequest: FileText, Installation: Wrench, Review: Star,
  InstalledSystem: Sun, SupportTicket: LifeBuoy, ShopCertification: BadgeCheck,
};

/** Obyekt turi va panelga qarab sahifa (server email havolalari bilan bir xil: notification-channels `linkFor`). */
export function entityPath(entityType: string | undefined, id: string | undefined, base: '/mijoz' | '/dokon'): string | undefined {
  const shop = base === '/dokon';
  const safeId = id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined;
  switch (entityType) {
    case 'RequestShop': return safeId ? (shop ? `/dokon/sorovlar/${safeId}` : `/mijoz/chat/${safeId}`) : undefined;
    case 'Quote': return shop ? '/dokon/takliflar' : safeId ? `/mijoz/takliflar/${safeId}` : undefined;
    case 'QuoteRequest': return shop ? '/dokon/sorovlar' : safeId ? `/mijoz/sorovlar/${safeId}` : '/mijoz/sorovlar';
    case 'Installation': return safeId ? `${base}/montajlar/${safeId}` : `${base}/montajlar`;
    case 'Review': return shop ? '/dokon/sharhlar' : '/mijoz/montajlar';
    case 'InstalledSystem': return shop ? undefined : safeId ? `/mijoz/tizimim/${safeId}` : '/mijoz/tizimim';
    case 'SupportTicket': return shop ? undefined : safeId ? `/mijoz/murojaatlar/${safeId}` : '/mijoz/murojaatlar';
    case 'ShopCertification': return shop ? '/dokon' : undefined;
    default: return undefined;
  }
}

/** Bildirishnoma turiga qarab ikona, rang va (mumkin bo‘lsa) o‘tiladigan sahifa. */
export function notificationMeta(item: AppNotification, base: '/mijoz' | '/dokon' = '/mijoz', admin = false): NotificationMeta {
  const data = item.data ?? {};
  switch (item.template) {
    case 'admin.audit': {
      const action = typeof data.action === 'string' ? data.action : '';
      const tone: NotificationTone = /DELETED|REJECT|MISMATCH|SUSPENDED/.test(action) ? 'danger' : /APPROVE|REACTIVATED/.test(action) ? 'success' : /SUBMITTED|REGISTERED|CREATED/.test(action) ? 'primary' : 'warning';
      return { icon: ScrollText, tone, to: adminAuditPath(action, data.path) };
    }
    case 'shop.verification':
      return { icon: ShieldCheck, tone: data.decision === 'APPROVE' ? 'success' : 'warning', to: '/dokon' };
    case 'OPS_ALERT':
      return { icon: Siren, tone: 'danger', to: admin ? '/admin/devops' : undefined };
    case 'report.ready':
      return { icon: FileText, tone: 'success', to: admin ? undefined : '/mijoz/hisoblar' };
  }
  const entityType = typeof data.entityType === 'string' ? data.entityType : item.template ? TEMPLATE_ENTITY[item.template] : undefined;
  if (!entityType) return { icon: Bell, tone: 'neutral' };
  const tone: NotificationTone = /EXPIRING|ISSUE|NOT_SELECTED/.test(item.template ?? '') ? 'warning' : /ACCEPTED|CONFIRMED|RESOLVED|PUBLISHED/.test(item.template ?? '') ? 'success' : 'primary';
  return {
    icon: ENTITY_ICON[entityType] ?? Bell,
    tone,
    to: admin ? undefined : entityPath(entityType, typeof data.entityId === 'string' ? data.entityId : undefined, base),
  };
}

/** Ko‘rinadigan sarlavha va matn (serverda tayyor yoziladi). */
export function notificationText(item: AppNotification, _base: '/mijoz' | '/dokon' = '/mijoz'): { title: string; body: string } {
  return { title: t(item.title), body: t(item.body) };
}
