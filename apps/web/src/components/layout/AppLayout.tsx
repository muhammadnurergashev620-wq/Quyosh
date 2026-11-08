import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DeletionBanner } from '@/features/m7/DeletionBanner';
import { PageLoader } from '@/components/common/PageLoader';
import { PanelHeader } from './PanelHeader';
import { Sidebar } from './Sidebar';
import { MobileNavigation } from './MobileNavigation';
import { Footer } from './Footer';
import { useCurrentRole } from '@/features/session/hooks/useCurrentRole';
import { useAutoReadNotifications } from '@/features/notification/hooks/useAutoReadNotifications';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { PhoneRequiredBanner } from '@/features/session/components/PhoneRequiredBanner';
import { NameRequiredDialog } from '@/features/session/components/NameRequiredDialog';
import { usePushNotifications } from '@/features/push/usePushNotifications';
import { WebPushPrompt } from '@/features/push/WebPushPrompt';
import { t } from '@/i18n';
import './AppLayout.css';

export function AppLayout() {
  const { role } = useCurrentRole();
  const { pathname } = useLocation();
  useAutoReadNotifications();
  // Telefon ilovasida push yoqiladi (mijoz, do‘kon va admin).
  usePushNotifications(role === 'CUSTOMER' || role === 'SHOP' || role === 'ADMIN');
  return (
    <div className="gm-app-layout">
      <a href="#gm-main-content" className="gm-skip-link">
        {t('Asosiy kontentga o‘tish')}
      </a>
      <OfflineBanner />
      <PanelHeader role={role} />
      <div className="gm-app-layout__body">
        <Sidebar />
        <main id="gm-main-content" className="gm-app-layout__content">
          <WebPushPrompt />
          {role === 'CUSTOMER' && <PhoneRequiredBanner />}
          <Suspense fallback={<PageLoader />}>
            <DeletionBanner />
            {/* Sahifa almashganda yumshoq paydo bo‘lish (fade + 6 px) */}
            <div key={pathname} className="gm-page-enter">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
      <MobileNavigation />
      <NameRequiredDialog />
      <Footer />
    </div>
  );
}
