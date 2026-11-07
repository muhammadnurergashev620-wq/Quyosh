import { Navigate, useParams } from 'react-router-dom';
import { getNavItems } from '@/components/layout/nav-items';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';

/**
 * Panel ildizi (TZ 5.4): kirmagan foydalanuvchi — mijoz panelida kalkulyatorga (guest ham ishlata oladi),
 * do‘kon va admin panelida /login ga; kirgan — menyudagi birinchi bo‘limga.
 */
export function PanelRoot() {
  const hasSession = useAuthStore((s) => s.hasSession);
  const role = env.appRole ?? 'CUSTOMER';
  if (!hasSession) return <Navigate to={role === 'CUSTOMER' ? '/mijoz/kalkulyator' : '/login'} replace />;
  const [first] = getNavItems(role, { superAdmin: false });
  return <Navigate to={first?.to ?? '/'} replace />;
}

/** Eski `/mijoz/montaj/:id` → `/mijoz/montajlar/:id`. */
export function LegacyInstallationRedirect() {
  const { id } = useParams();
  return <Navigate to={`/mijoz/montajlar/${id ?? ''}`} replace />;
}
