import { useEffect, useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { NewCredentialsCard } from '@/features/auth/components/NewCredentialsCard';
import { OtpForm } from '@/features/auth/components/OtpForm';
import { useVerifyOtp, useVerifyRegistration } from '@/features/auth/hooks/useAuth';
import { googlePending } from '@/features/auth/google-pending';
import { loginSecret } from '@/features/auth/login-secret';
import { authService } from '@/features/auth/services/auth.service';
import { useAppStore } from '@/store/app.store';
import { useAuthStore } from '@/store/auth.store';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { APP_TITLE } from '@/lib/panel';
import { getNavItems } from '@/components/layout/nav-items';
import { t } from '@/i18n';
import { consumeReturnTo } from '@/lib/return-to';

type Flow = 'register' | 'login';

export function OtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pendingPhone = useAuthStore((s) => s.pendingPhone);
  const preferredRole = useAuthStore((s) => s.preferredRole);
  const devCode = useAuthStore((s) => s.devCode);
  const deviceLimit = useAuthStore((s) => s.deviceLimit);
  const delivery = useAuthStore((s) => s.delivery);
  const smsAvailable = useAuthStore((s) => s.smsAvailable);
  const hasNewCredentials = useAuthStore((s) => s.newCredentials !== null);
  const [created, setCreated] = useState(false);
  const setDevCode = useAuthStore((s) => s.setDevCode);
  const setPendingPhone = useAuthStore((s) => s.setPendingPhone);
  const pushToast = useAppStore((s) => s.pushToast);
  const [resendError, setResendError] = useState<unknown>(null);
  const flow: Flow = (location.state as { flow?: Flow } | null)?.flow ?? 'login';

  const verifyRegistration = useVerifyRegistration();
  const verifyOtp = useVerifyOtp();

  useEffect(() => {
    document.title = flow === 'register' ? `${t('Ro‘yxatdan o‘tishni tasdiqlash')} — ${APP_TITLE}` : `${t('Kirishni tasdiqlash')} — ${APP_TITLE}`;
  }, [flow]);

  if (created) {
    return (
      <div className="gm-auth-page">
        <NewCredentialsCard
          onContinue={() => {
            setPendingPhone(null);
            navigate('/login', { replace: true });
          }}
        />
      </div>
    );
  }

  if (!pendingPhone) {
    return <Navigate to={flow === 'register' ? '/register' : '/login'} replace />;
  }

  const isRegisterFlow = flow === 'register';
  const mutation = isRegisterFlow ? verifyRegistration : verifyOtp;

  async function handleResend(): Promise<boolean> {
    setResendError(null);
    try {
      const password = isRegisterFlow ? null : loginSecret.get(pendingPhone as string);
      const result = isRegisterFlow
        ? await authService.resendRegistration(pendingPhone as string)
        : await authService.login({ phone: pendingPhone as string, password: password as string });
      setDevCode(result.developmentCode ?? null);
      if (!isRegisterFlow) useAuthStore.getState().setDelivery(('delivery' in result ? result.delivery : null) ?? null, ('smsAvailable' in result && result.smsAvailable === true));
      pushToast(t('Yangi kod yuborildi.'), 'success');
      return true;
    } catch (error) {
      setResendError(error);
      return false;
    }
  }

  /** Kodni email o‘rniga SMS orqali olish (parol xotirada saqlangan bo‘lsa — kirish so‘rovi SMS kanali bilan takrorlanadi). */
  async function handleSendSms(): Promise<boolean> {
    setResendError(null);
    try {
      const password = loginSecret.get(pendingPhone as string);
      const result = await authService.login({ phone: pendingPhone as string, password: password as string, codeChannel: 'SMS' });
      setDevCode(result.developmentCode ?? null);
      useAuthStore.getState().setDelivery(result.delivery ?? null, result.smsAvailable === true);
      pushToast(t('Kod SMS orqali yuborildi.'), 'success');
      return true;
    } catch (error) {
      setResendError(error);
      return false;
    }
  }

  function handleSubmit(values: { code: string }) {
    if (isRegisterFlow) {
      verifyRegistration.mutate(
        { phone: pendingPhone as string, code: values.code },
        {
          onSuccess: () => {
            // Login va parol bir marta ko‘rsatiladi; ko‘rsatiladigan narsa bo‘lmasa — to‘g‘ridan-to‘g‘ri kirishga.
            const credential = googlePending.take();
            if (credential) {
              // Google orqali ro‘yxatdan o‘tgan: parol yo‘q, shuning uchun darhol Google bilan kiriladi.
              void authService
                .googleSignIn({ credential })
                .then(() => {
                  useAuthStore.getState().setSession(true);
                  setPendingPhone(null);
                  const [firstItem] = getNavItems(preferredRole, { superAdmin: true });
                  navigate(consumeReturnTo() ?? firstItem?.to ?? '/', { replace: true });
                })
                .catch(() => {
                  setPendingPhone(null);
                  navigate('/login', { replace: true });
                });
              return;
            }
            if (hasNewCredentials) setCreated(true);
            else {
              setPendingPhone(null);
              navigate('/login', { replace: true });
            }
          },
        },
      );
      return;
    }
    verifyOtp.mutate(
      { phone: pendingPhone as string, code: values.code },
      {
        onSuccess: () => {
          const [firstItem] = getNavItems(preferredRole, { superAdmin: true });
          navigate(consumeReturnTo() ?? firstItem?.to ?? '/', { replace: true });
        },
      },
    );
  }

  return (
    <div className="gm-auth-page gm-otp-page">
      <h1>{isRegisterFlow ? t('Ro‘yxatdan o‘tishni tasdiqlash') : t('Kirishni tasdiqlash')}</h1>
      {devCode && (
        <Alert tone="info" title={t('Dev rejim')}>
          {t('Tasdiqlash kodi:')} <strong>{devCode}</strong>
        </Alert>
      )}
      {!isRegisterFlow && deviceLimit && (
        <div className="gm-devlimit" role="alert">
          <span className="gm-devlimit__icon" aria-hidden="true">
            <MonitorSmartphone size={20} />
          </span>
          <div>
            <strong>{t('Qurilmalar limiti to‘lgan ({active}/{max})', { active: deviceLimit.active, max: deviceLimit.max })}</strong>
            <p>
              {t('Akkauntingizda faol qurilmalar soni chegaraga yetgan, shuning uchun bu qurilmadan kirish kodni to‘g‘ri kiritsangiz ham rad etiladi. Avval boshqa qurilmangizdan «Sozlamalar → Faol qurilmalar» orqali chiqing, so‘ng bu yerga qaytib login qiling.')}
            </p>
          </div>
        </div>
      )}
      {isRegisterFlow && verifyRegistration.isError && (
        <Alert tone="info" title={t('Kod mos kelmadimi?')}>
          {t('Agar bu telefon raqami bilan avval ro‘yxatdan o‘tgan bo‘lsangiz,')} <Link to="/login">{t('kirish sahifasidan')}</Link> {t('foydalaning. Aks holda kodni qayta tekshirib kiriting.')}
        </Alert>
      )}
      {!!resendError && !/Soatiga/.test(getErrorMessage(resendError)) && <Alert tone="danger">{getErrorMessage(resendError)}</Alert>}
      <OtpForm
        phone={pendingPhone}
        loading={mutation.isPending}
        error={mutation.error}
        onSubmit={handleSubmit}
        onResend={isRegisterFlow || loginSecret.get(pendingPhone) ? handleResend : undefined}
        actionError={resendError}
        delivery={isRegisterFlow ? null : delivery}
        onSendSms={!isRegisterFlow && smsAvailable && delivery?.channel !== 'SMS' && loginSecret.get(pendingPhone) ? handleSendSms : undefined}
      />
    </div>
  );
}
