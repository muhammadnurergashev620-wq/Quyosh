import { Banknote, Bell, ClipboardList, FileText, MessageCircle, Megaphone, Scale, Settings, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BadgeTone } from '@/components/ui/Badge';
import { AUDIT_ACTIONS } from '@/features/admin/audit-labels';
import type { AdminNotificationCategory, AdminNotificationPriority } from '../admin-types';
import { t } from '@/i18n';

export const CATEGORY: Record<AdminNotificationCategory, { label: string; icon: ReactNode; tone: 'green' | 'red' | 'violet' | 'blue' | 'amber' | 'teal' | 'pink' | 'gray' }> = {
  PAYMENT: { label: t('To‘lov'), icon: <Banknote size={17} />, tone: 'green' },
  DISPUTE: { label: t('Nizo'), icon: <Scale size={17} />, tone: 'red' },
  DOCUMENT: { label: t('Hujjat'), icon: <FileText size={17} />, tone: 'violet' },
  USER: { label: t('Foydalanuvchi'), icon: <UserRound size={17} />, tone: 'blue' },
  ORDER: { label: t('So‘rov'), icon: <ClipboardList size={17} />, tone: 'amber' },
  CHAT: { label: t('Suhbat'), icon: <MessageCircle size={17} />, tone: 'teal' },
  POST: { label: t('E’lon'), icon: <Megaphone size={17} />, tone: 'pink' },
  SYSTEM: { label: t('Tizim'), icon: <Settings size={17} />, tone: 'gray' },
};

export const PRIORITY: Record<AdminNotificationPriority, { label: string; tone: BadgeTone }> = {
  HIGH: { label: t('Yuqori'), tone: 'danger' },
  MEDIUM: { label: t('O‘rta'), tone: 'warning' },
  LOW: { label: t('Past'), tone: 'success' },
};

export const ROLE_LABEL: Record<string, string> = { ADMIN: t('Admin'), SHOP: t('Do‘kon'), CUSTOMER: t('Mijoz') };
export const FALLBACK_ICON = <Bell size={17} />;

/** Audit amalidan keladigan bildirishnomalarda sarlavha amal nomidan olinadi (tarjima qilinadi); qolganlarida — saqlangan sarlavha. */
export function notificationTitle(item: { title: string; action: string | null }): string {
  return item.action && AUDIT_ACTIONS[item.action] ? AUDIT_ACTIONS[item.action]!.label : item.title;
}
