import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { getNavItems } from '@/components/layout/nav-items';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const hasSession = useAuthStore((s) => s.hasSession);
  const location = useLocation();

  if (!hasSession) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
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
