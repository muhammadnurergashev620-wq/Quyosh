import { Navigate } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { getNavItems } from '@/components/layout/nav-items';
import { useMe } from '@/features/session/hooks/useMe';
import { AdminDashboardPage } from './AdminDashboardPage';

/** «/admin» bosh sahifa: hisobotlarga huquqi bo‘lmagan admin o‘ziga ochiq birinchi bo‘limga yo‘naltiriladi. */
export function AdminHome() {
  const me = useMe();
  if (me.isLoading || !me.data) return <PageLoader />;
  const allowed = !!me.data.isSuperAdmin || (me.data.adminPermissions ?? []).includes('REPORTS');
  if (allowed) return <AdminDashboardPage />;
  const first = getNavItems('ADMIN', { permissions: me.data.adminPermissions }).find((item) => item.to !== '/admin' && item.group !== 'Akkaunt');
  return <Navigate to={first?.to ?? '/bildirishnomalar'} replace />;
}
