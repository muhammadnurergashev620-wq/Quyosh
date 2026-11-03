import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import { RoleGuard } from './RoleGuard';

/**
 * Mijoz panelining ochiq sahifalari (katalog, do‘konlar — TZ 5.4): guest ham ko‘radi; kirgan foydalanuvchi uchun
 * odatdagi mijoz roli tekshiruvi. Do‘kon va admin panellarida bu sahifalar yo‘q.
 */
export function PublicCustomerRoute({ children }: { children: ReactNode }) {
  const hasSession = useAuthStore((s) => s.hasSession);
  if (env.appRole && env.appRole !== 'CUSTOMER') return <Navigate to="/" replace />;
  if (!hasSession) return children;
  return <RoleGuard roles={['CUSTOMER']}>{children}</RoleGuard>;
}
