import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { useAuthStore } from '@/store/auth.store';
import { useMe } from '@/features/session/hooks/useMe';
import { getNavItems } from '@/components/layout/nav-items';

/** Birinchi kirishda parol almashtirish ekrani (admin bergan vaqtincha parol, TZ 3.5). */
export const FIRST_PASSWORD_PATH = '/yangi-parol';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const hasSession = useAuthStore((s) => s.hasSession);
  const location = useLocation();
  const me = useMe();

  if (!hasSession) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // Profil kelguncha panel so‘rovlari yuborilmasin: vaqtincha parol bilan ular 403 qaytaradi.
  if (me.isLoading) return <PageLoader />;
  if (me.data?.mustPasswordChange) return <Navigate to={FIRST_PASSWORD_PATH} replace />;
  return children;
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const hasSession = useAuthStore((s) => s.hasSession);
  const preferredRole = useAuthStore((s) => s.preferredRole);

  if (hasSession) {
    const [firstItem] = getNavItems(preferredRole, { superAdmin: true });
    return <Navigate to={firstItem?.to ?? '/'} replace />;
  }
  return children;
}
