import type { BadgeTone } from '@/components/ui/Badge';
import type { ManagedStatus } from '../types';
import { t } from '@/i18n';

export const USER_STATUS: Record<ManagedStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: t('Faol'), tone: 'success' },
  PENDING: { label: t('Tasdiqlanishi kutilmoqda'), tone: 'warning' },
  SUSPENDED: { label: t('Muzlatilgan'), tone: 'warning' },
  BLOCKED: { label: t('Bloklangan'), tone: 'danger' },
  DELETED: { label: t('O‘chirilgan'), tone: 'neutral' },
};

/** Uzun ro‘yxatda ko‘rinadigan sahifa raqamlari: 1 … 4 5 6 … 246. */
export function pageNumbers(current: number, total: number): Array<number | 'gap-left' | 'gap-right'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => pages.add(n));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => pages.add(n));
  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: Array<number | 'gap-left' | 'gap-right'> = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev > 1) out.push(i < sorted.length / 2 ? 'gap-left' : 'gap-right');
    out.push(n);
  });
  return out;
}
