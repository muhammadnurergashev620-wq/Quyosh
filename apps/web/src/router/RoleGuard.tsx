import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Button } from '@/components/ui/Button';
import { getNavItems } from '@/components/layout/nav-items';
import { useCurrentRole } from '@/features/session/hooks/useCurrentRole';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/types/api';
import type { Role } from '@/types/common';
import { t } from '@/i18n';

/** Server/tarmoq muammosi (avtorizatsiya emas): sessiyani saqlab, qayta urinishni taklif qiladi. */
const isConnectionProblem = (error: unknown) => error instanceof ApiError && (error.statusCode === 0 || error.statusCode >= 500);

function ConnectionProblem({ onRetry }: { onRetry: () => void }) {
  const clear = useAuthStore((s) => s.clear);
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70dvh', padding: 24, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center', maxWidth: 320 }}>
        <WifiOff size={36} aria-hidden="true" />
        <h2>{t('Serverga ulanib bo‘lmadi')}</h2>
        <p style={{ color: 'var(--qs-color-text-muted)' }}>{t('Internetni tekshiring yoki birozdan keyin qayta urinib ko‘ring.')}</p>
        <Button onClick={onRetry}>{t('Qayta urinish')}</Button>
        <Button variant="ghost" size="sm" onClick={() => clear()}>{t('Akkauntdan chiqish')}</Button>
      </div>
    </div>
  );
}

/** Sessiya yaroqsiz bo‘lsa: saqlangan holatni tozalab, kirish sahifasiga yuboradi (cheksiz yo‘naltirish bo‘lmasligi uchun). */
function ExpiredSession() {
  const clear = useAuthStore((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);
  return <Navigate to="/login" replace />;
}

export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role, isLoading, isError, error, refetch } = useCurrentRole();

  if (isLoading) return <PageLoader label="Yuklanmoqda…" />;
  if (isError && isConnectionProblem(error)) return <ConnectionProblem onRetry={refetch} />;
  if (isError || !role) return <ExpiredSession />;
  if (!roles.includes(role)) {
    const [first] = getNavItems(role, { superAdmin: true }); // bosh sahifa; bo‘lim huquqlarini «/admin» o‘zi tekshiradi
    return <Navigate to={first?.to ?? '/'} replace />;
  }
  return children;
}
