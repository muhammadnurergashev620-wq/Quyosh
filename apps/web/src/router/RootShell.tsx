import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useSessionExpiredListener } from '@/features/auth/hooks/useAuth';

export function RootShell() {
  useSessionExpiredListener();
  return (
    <Suspense fallback={null}>
      <Outlet />
    </Suspense>
  );
}
