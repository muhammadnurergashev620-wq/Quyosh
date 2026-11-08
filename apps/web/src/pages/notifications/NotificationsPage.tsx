import { Suspense, lazy } from 'react';
import { Bell, Settings2 } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { NotificationList } from '@/features/notification/components/NotificationList';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import { t } from '@/i18n';

const AdminNotificationsPage = lazy(() => import('@/pages/admin/AdminNotificationsPage').then((module) => ({ default: module.AdminNotificationsPage })));

export function NotificationsPage() {
  const preferredRole = useAuthStore((state) => state.preferredRole);
  if ((env.appRole ?? preferredRole) === 'ADMIN') {
    return (
      <Suspense fallback={<PageLoader />}>
        <AdminNotificationsPage />
      </Suspense>
    );
  }
  return (
    <div className="gm-notify-page">
      <PageHeader
        icon={<Bell />}
        title={t('Bildirishnomalar')}
        description={t('So‘rov, taklif, montaj va chat bo‘yicha yangiliklar')}
        actions={<ButtonLink to="/sozlamalar/bildirishnomalar" variant="secondary" size="sm" leftIcon={<Settings2 />}>{t('Kanal sozlamalari')}</ButtonLink>}
      />
      <NotificationList />
    </div>
  );
}
