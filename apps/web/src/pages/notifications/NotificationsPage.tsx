import { Suspense, lazy } from 'react';
import { PageLoader } from '@/components/common/PageLoader';
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
      <div className="gm-page-header">
        <div>
          <h1>{t('Bildirishnomalar')}</h1>
          <p className="gm-page-lead">{t('Buyurtma, chat va tasdiqlash bo‘yicha yangiliklar')}</p>
        </div>
      </div>
      <NotificationList />
    </div>
  );
}
