import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { GoogleAuth } from '@/features/auth/components/GoogleAuth';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { env } from '@/lib/env';
import { SupportContacts } from '@/features/public/SupportContacts';
import { useAuthStore } from '@/store/auth.store';
import { t } from '@/i18n';

export function LoginPage() {
  const isAdmin = useAuthStore((s) => s.preferredRole) === 'ADMIN';
  // Do‘kon paneli (v3.1): hisobni admin yaratadi — ro‘yxatdan o‘tish, Google va «Parolni unutdim» yo‘q.
  const isShop = env.appRole === 'SHOP';
  const byLogin = isShop || isAdmin || env.appRole === 'ADMIN';

  return (
    <div className="gm-auth-page">
      <h1>{isAdmin ? t('Administrator kirishi') : t('Kirish')}</h1>
      <p className="gm-auth-page__subtitle">{byLogin ? t('Login va parolingiz bilan kiring.') : t('Telefon raqami va parolingiz bilan kiring.')}</p>
      <LoginForm />
      {!isShop && <GoogleAuth />}
      {isShop ? (
        <>
          <p className="gm-auth-page__note gm-auth-page__note--always">
            <Lock size={14} aria-hidden="true" /> {t('Parolni tiklash uchun administratorga murojaat qiling.')}
          </p>
          <SupportContacts compact />
        </>
      ) : isAdmin ? (
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
