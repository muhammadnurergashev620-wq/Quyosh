import type { BadgeTone } from '@/components/ui/Badge';
import { t } from '@/i18n';

export const ADMIN_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: t('Faol'), tone: 'success' },
  SUSPENDED: { label: t('Muzlatilgan'), tone: 'warning' },
  BLOCKED: { label: t('Bloklangan'), tone: 'danger' },
  PENDING: { label: t('Tasdiqlanmagan'), tone: 'neutral' },
};
