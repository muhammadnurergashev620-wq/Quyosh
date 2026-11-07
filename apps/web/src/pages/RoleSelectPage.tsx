import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { env } from '@/lib/env';

/** Bosh sayt (GSAP, Lenis, Three.js film) faqat asosiy saytda kerak — panellar bundle’iga tushmasligi uchun lazy (audit A-02). */
const PortalPage = lazy(() => import('./landing/portal/PortalPage').then((m) => ({ default: m.PortalPage })));

/** `/` sahifasi: asosiy saytda (rol belgilanmagan) — bosh sayt; panellarda router o‘zi yo‘naltiradi. */
export function RoleSelectPage() {
  if (env.appRole) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<PageLoader />}>
      <PortalPage />
    </Suspense>
  );
}
