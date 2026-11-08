import { useMe } from '@/features/session/hooks/useMe';
import { accountName } from '@/lib/account-name';
import { env } from '@/lib/env';
import type { Role } from '@/types/common';
import { t } from '@/i18n';

/** Joriy panel foydalanuvchisi: ism, rol yozuvi va profil sahifasi (header va yon panel uchun bitta manba). */
export function usePanelIdentity(role: Role | null) {
  const me = useMe();
  const user = me.data;
  const panelRole: Role = role ?? env.appRole ?? 'CUSTOMER';
  const isAdmin = panelRole === 'ADMIN';
  const isSuper = !!user?.isSuperAdmin;
  const name = accountName(user);
  const displayName = name === t('Ism kiritilmagan') ? user?.phone ?? t('Menyu') : name;
  const roleText = isAdmin ? (isSuper ? t('Superadmin') : t('Administrator')) : panelRole === 'SHOP' ? t('Do‘kon xodimi') : t('Mijoz');
  const profilePath = isAdmin ? '/admin/profil' : panelRole === 'SHOP' ? '/sozlamalar' : '/mijoz/profil';
  return { user, panelRole, isAdmin, isSuper, name, displayName, roleText, profilePath };
}
