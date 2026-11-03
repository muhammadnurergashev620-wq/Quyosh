import { Link, Navigate } from 'react-router-dom';
import { GoogleAuth } from '@/features/auth/components/GoogleAuth';
import { RegisterForm } from '@/features/auth/components/RegisterForm';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import { t } from '@/i18n';

export function RegisterPage() {
  const isAdmin = useAuthStore((s) => s.preferredRole) === 'ADMIN';
  if (isAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="gm-auth-page">
      <h1>{t('Ro‘yxatdan o‘tish')}</h1>
      <p className="gm-auth-page__subtitle">{env.appRole === 'SHOP'
          ? t('Ro‘yxatdan o‘ting, so‘ng do‘kon profilingizni to‘ldiring.')
          : t('Mijoz sifatida ro‘yxatdan o‘ting va birinchi so‘rovingizni yarating.')}</p>
      <RegisterForm />
      <GoogleAuth />
      <p className="gm-auth-page__switch">
        {t('Akkauntingiz bormi?')} <Link to="/login">{t('Kirish')}</Link>
      </p>
    </div>
  );
}
