import { Navigate } from 'react-router-dom';
import { env } from '@/lib/env';
import { PortalPage } from './landing/portal/PortalPage';

/** `/` sahifasi: asosiy saytda (rol belgilanmagan) — bosh sayt; panellarda router o‘zi yo‘naltiradi. */
export function RoleSelectPage() {
  if (env.appRole) return <Navigate to="/" replace />;
  return <PortalPage />;
}
