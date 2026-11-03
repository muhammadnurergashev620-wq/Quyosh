import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/features/auth/services/auth.service';
import { env } from '@/lib/env';
import { useAppStore } from '@/store/app.store';
import { useAuthStore } from '@/store/auth.store';
import type { Role } from '@/types/common';
import { useMe } from './useMe';
import { t } from '@/i18n';

export interface CurrentRole {
  role: Role | null;
  isLoading: boolean;
  isError: boolean;
  /** Profilni yuklashdagi xato (tarmoq/server/avtorizatsiya). */
  error: unknown;
  refetch: () => void;
  needsShopOnboarding: boolean;
}

const WRONG_APP_MESSAGE: Record<Role, string> = {
  CUSTOMER: t('Bu akkaunt mijoz sifatida kira olmaydi.'),
  SHOP: t('Bu akkaunt do‘kon panelidan foydalana olmaydi.'),
  ADMIN: t('Bu akkaunt administrator emas.'),
};

export function useCurrentRole(): CurrentRole {
  const me = useMe();
  const queryClient = useQueryClient();
  const preferredRole = useAuthStore((s) => s.preferredRole);
  const setPreferredRole = useAuthStore((s) => s.setPreferredRole);
  const clear = useAuthStore((s) => s.clear);
  const pushToast = useAppStore((s) => s.pushToast);

  const actual = me.data?.roles ?? [];
  const wanted = env.appRole ?? preferredRole;

  let role: Role | null = null;
  let needsShopOnboarding = false;
  if (me.data) {
    if (wanted && actual.includes(wanted)) {
      role = wanted;
    } else if (wanted === 'SHOP' && actual.includes('CUSTOMER')) {
      role = 'SHOP';
      needsShopOnboarding = true;
    } else if (!env.appRole) {
      role = actual[0] ?? null;
    }
  }

  useEffect(() => {
    if (!env.appRole && role && !needsShopOnboarding && role !== preferredRole) setPreferredRole(role);
  }, [role, needsShopOnboarding, preferredRole, setPreferredRole]);

  const wrongApp = !!env.appRole && !!me.data && role === null;
  useEffect(() => {
    if (!wrongApp || !env.appRole) return;
    void authService.logout(false).catch(() => undefined);
    clear();
    queryClient.clear();
    pushToast(WRONG_APP_MESSAGE[env.appRole], 'error');
  }, [wrongApp, clear, queryClient, pushToast]);

  return { role, isLoading: me.isLoading, isError: me.isError, error: me.error, refetch: () => void me.refetch(), needsShopOnboarding };
}
