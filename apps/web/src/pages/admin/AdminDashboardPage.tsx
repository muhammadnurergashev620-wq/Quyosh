import { Link } from 'react-router-dom';
import { Store, ShieldCheck, UserPlus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { formatNumber } from '@/lib/utils';
import { useDashboard } from '@/features/admin/hooks/useAdmin';
import './AdminDashboardPage.css';
import { t } from '@/i18n';
import { AdminQueues } from '@/pages/m7/AdminM7Pages';

function Kpi({ to, icon, value, label }: { to: string; icon: ReactNode; value: number; label: string }) {
  return (
    <Link to={to} className="qs-kpi">
      <span className="qs-kpi__icon" aria-hidden="true">{icon}</span>
      <strong>{formatNumber(value)}</strong>
      <small>{label}</small>
    </Link>
  );
}

/** Admin boshqaruv paneli (TZ U12.1): umumiy KPI va navbatlar (verifikatsiya, sertifikat, moderatsiya, yordam SLA, tariflar, kurs). */
export function AdminDashboardPage() {
  const dashboard = useDashboard({});
  if (dashboard.isLoading) return <PageLoader />;
  if (dashboard.isError || !dashboard.data) return <Alert tone="danger">{getErrorMessage(dashboard.error)}</Alert>;
  const d = dashboard.data;
  return (
    <div className="qs-dash">
      <h1>{t('Boshqaruv paneli')}</h1>
      <div className="qs-dash__grid">
        <Kpi to="/admin/foydalanuvchilar" icon={<Users size={20} />} value={d.users.total} label={t('Foydalanuvchilar')} />
        <Kpi to="/admin/foydalanuvchilar" icon={<UserPlus size={20} />} value={d.users.new} label={t('Yangi foydalanuvchilar')} />
        <Kpi to="/admin/dokonlar" icon={<Store size={20} />} value={d.shops.total} label={t('Do‘konlar')} />
        <Kpi to="/admin/tasdiqlash" icon={<ShieldCheck size={20} />} value={d.shops.pendingReview} label={t('Tekshiruv kutmoqda')} />
      </div>
      <AdminQueues />
    </div>
  );
}
