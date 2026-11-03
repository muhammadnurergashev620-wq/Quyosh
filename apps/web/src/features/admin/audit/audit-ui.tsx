import type { BadgeTone } from '@/components/ui/Badge';
import { accountName } from '@/lib/account-name';
import { actionInfo } from '@/features/admin/audit-labels';
import type { AuditActorRole, AuditLog } from '@/features/admin/types';
import { t } from '@/i18n';

export const ROLE_NAME: Record<AuditActorRole, string> = { ADMIN: t('Admin'), SHOP: t('Do‘kon'), CUSTOMER: t('Mijoz'), SYSTEM: t('Tizim') };
export const OUTCOME: Record<'SUCCESS' | 'FAILED', { label: string; tone: BadgeTone }> = {
  SUCCESS: { label: t('Muvaffaqiyatli'), tone: 'success' },
  FAILED: { label: t('Rad etilgan / xato'), tone: 'danger' },
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface AuditChange {
  key: string;
  from: unknown;
  to: unknown;
  hasFrom: boolean;
  hasTo: boolean;
}

export function changesOf(log: AuditLog): AuditChange[] {
  const before = isObject(log.before) ? log.before : {};
  const after = isObject(log.after) ? log.after : {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.map((key) => ({ key, from: before[key], to: after[key], hasFrom: key in before, hasTo: key in after }));
}

/** «Akmaljon Karimov hujjatni tasdiqladi → Rustam Y.» ko‘rinishidagi qisqa tavsif. */
export function auditSentence(log: AuditLog): string {
  const info = actionInfo(log.action);
  const actorUser = log.actor ?? (!log.actorId && info.group === 'auth' ? log.targetUser : null);
  const who = actorUser ? accountName(actorUser) : t('Tizim');
  const self = !!actorUser && !!log.targetUser && actorUser.id === log.targetUser.id;
  return `${who} ${info.verb}${log.targetUser && !self ? ` → ${accountName(log.targetUser)}` : ''}`;
}

/** Obyekt sahifasiga yo‘l (bor bo‘lsa). */
export function targetPath(log: AuditLog): string | null {
  if (!log.targetId) return null;
  switch (log.targetType) {
    case 'User':
      return log.targetUser ? `/admin/foydalanuvchilar/${log.targetUser.accountNumber}` : null;
    case 'Order':
      return `/admin/buyurtmalar/${log.targetId}`;
    case 'Case':
      return '/admin/shikoyatlar';
    case 'MasterVerification':
    case 'MasterPortfolio':
      return '/admin/tasdiqlash';
    case 'Service':
    case 'ServiceCategory':
      return '/admin/katalog';
    default:
      return null;
  }
}
