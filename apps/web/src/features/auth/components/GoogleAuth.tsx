import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleLogo } from './GoogleLogo';
import { loadGoogleScript, requestGoogleAccessToken } from '../google-script';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { env } from '@/lib/env';
import { getErrorMessage } from '@/lib/error-messages';
import { getNavItems } from '@/components/layout/nav-items';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '../services/auth.service';
import { formatLocalPhone, localPhoneSchema, toFullPhone, toLocalDigits } from '../validation';
import { t } from '@/i18n';

/** «Google orqali kirish / ro‘yxatdan o‘tish» tugmasi. GOOGLE client ID sozlanmagan yoki administrator paneli bo‘lsa ko‘rinmaydi. */
export function GoogleAuth() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.preferredRole) === 'ADMIN' || env.appRole === 'ADMIN';
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState<{ token: string } | null>(null);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const configured = !!env.googleClientId;
  const enabled = configured && !isAdmin;

  // Google skripti oldindan yuklanadi, shunda tugma bosilganda ruxsat oynasi darhol ochiladi.
  useEffect(() => {
    if (enabled) void loadGoogleScript().catch(() => undefined);
  }, [enabled]);

  if (isAdmin) return null;
  if (!configured) {
    // Client ID hali kiritilmagan: tugma ko‘rinadi, bosilganda sozlash kerakligi aytiladi.
    return (
      <div className="gm-google">
        <div className="gm-google__divider" role="separator">
          <span>{t('yoki')}</span>
        </div>
        {!!error && <Alert tone="info">{getErrorMessage(error)}</Alert>}
        <button type="button" className="gm-google__fallback" onClick={() => setError(new Error(t('Google orqali kirish hali sozlanmagan. Administrator Google Client ID ni kiritishi kerak.')))}>
          <GoogleLogo />
          {t('Google orqali davom etish')}
        </button>
      </div>
    );
  }

  async function continueWithGoogle() {
    setError(null);
    setBusy(true);
    try {
      await loadGoogleScript();
      const accessToken = await requestGoogleAccessToken(env.googleClientId, env.googlePhone);
      const result = await authService.googleSignIn({ accessToken });
      if (result.needsPhone) {
        // Google telefonni bermagan: faqat shu bitta narsa so‘raladi.
        setSignup({ token: result.signupToken });
        return;
      }
      useAuthStore.getState().setSession(true);
      const [firstItem] = getNavItems(useAuthStore.getState().preferredRole, { superAdmin: true });
      navigate(firstItem?.to ?? '/', { replace: true });
    } catch (e) {
      // Foydalanuvchi ruxsat oynasini yopsa — xato ko‘rsatilmaydi.
      if (!(e instanceof Error && e.message === 'google-oauth')) setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitPhone() {
    if (!signup) return;
    const parsed = localPhoneSchema.safeParse(phoneLocal);
    const nextPhoneError = parsed.success ? null : (parsed.error.issues[0]?.message ?? t('Telefon raqami noto‘g‘ri'));
    setPhoneError(nextPhoneError);
    if (nextPhoneError) return;
    setError(null);
    setBusy(true);
    try {
      const phone = toFullPhone(toLocalDigits(phoneLocal));
      await authService.googleRegister(signup.token, phone);
      // Google orqali kirishda SMS-kod so‘ralmaydi: sessiya shu javobda ochilgan.
      useAuthStore.getState().setSession(true);
      setSignup(null);
      const [firstItem] = getNavItems(useAuthStore.getState().preferredRole, { superAdmin: true });
      navigate(firstItem?.to ?? '/', { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const phoneModal = (
    <Modal
      open={!!signup}
      onClose={() => setSignup(null)}
      title={t('Telefon raqamingizni kiriting')}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => setSignup(null)}>
            {t('Bekor qilish')}
          </Button>
          <Button type="button" loading={busy} onClick={() => void submitPhone()}>
            {t('Davom etish')}
          </Button>
        </>
      }
    >
      <div className="gm-google gm-google--phone">
        <p className="gm-google__hint">{t('Google hisobingizda tasdiqlangan telefon raqami yo‘q. Faqat shu bitta ma‘lumot kerak: telefon raqamingizni kiriting.')}</p>
        {!!error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
        <Input
          label={t('Telefon raqami')}
          prefix="+998"
          inputMode="numeric"
          placeholder="90 123 45 67"
          autoComplete="tel-national"
          maxLength={12}
          formatValue={formatLocalPhone}
          required
          value={phoneLocal}
          onChange={(event) => setPhoneLocal(event.target.value)}
          error={phoneError ?? undefined}
        />
        <p className="gm-google__hint">
          {t('Davom etish orqali')}{' '}
          <Link to="/shartlar" target="_blank" rel="noopener">
            {t('Foydalanish shartlari')}
          </Link>{' '}
          {t('ni qabul qilasiz.')}
        </p>
      </div>
    </Modal>
  );

  return (
    <div className="gm-google">
      <div className="gm-google__divider" role="separator">
        <span>{t('yoki')}</span>
      </div>
      {!!error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      {phoneModal}
      <button type="button" className="gm-google__fallback" onClick={() => void continueWithGoogle()} disabled={busy}>
        <GoogleLogo />
        {t('Google orqali davom etish')}
      </button>
      <p className="gm-google__hint">
        {t('Davom etish orqali')}{' '}
        <Link to="/shartlar" target="_blank" rel="noopener">
          {t('Foydalanish shartlari')}
        </Link>{' '}
        {t('ni qabul qilasiz.')}
      </p>
    </div>
  );
}
