import type { Role } from '@/types/common';
import { t } from '@/i18n';
import { env } from './env';

export const PANEL_LABEL: Record<Role, string> = {
  CUSTOMER: t('Mijoz paneli'),
  SHOP: t('Do‘kon paneli'),
  ADMIN: t('Admin paneli'),
};

export const currentPanelLabel: string | null = env.appRole ? PANEL_LABEL[env.appRole] : null;

export const APP_TITLE = currentPanelLabel ? t('Quyosh — {currentPanelLabel}', { currentPanelLabel }) : 'Quyosh';
