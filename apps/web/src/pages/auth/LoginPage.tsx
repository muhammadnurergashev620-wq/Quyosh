import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { GoogleAuth } from '@/features/auth/components/GoogleAuth';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import { t } from '@/i18n';

export function LoginPage() {
  const isAdmin = useAuthStore((s) => s.preferredRole) === 'ADMIN';

  return (
    <div className="gm-auth-page">
      <h1>{isAdmin ? t('Administrator kirishi') : t('Kirish')}</h1>
      <p className="gm-auth-page__subtitle">{t('Telefon raqami va parolingiz bilan kiring.')}</p>
      <LoginForm />
      <GoogleAuth />
      {isAdmin ? (
        <>
          <p className="gm-auth-page__note">
            <Lock size={14} aria-hidden="true" /> {t('Faqat vakolatli xodimlar uchun. Har bir kirish audit jurnaliga yoziladi.')}
          </p>
          {!env.appRole && (
            <p className="gm-auth-page__switch">
              <Link to="/">{t('Boshqa rolni tanlash')}</Link>
            </p>
          )}
        </>
      ) : (
        <p className="gm-auth-page__switch">
          {t('Akkauntingiz yo‘qmi?')} <Link to="/register">{t('Ro‘yxatdan o‘tish')}</Link>
        </p>
      )}
    </div>
  );
}
