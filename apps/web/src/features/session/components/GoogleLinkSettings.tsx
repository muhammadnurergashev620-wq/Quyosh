import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { NewCredentialsCard } from '@/features/auth/components/NewCredentialsCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { GoogleLogo } from '@/features/auth/components/GoogleLogo';
import { loadGoogleScript } from '@/features/auth/google-script';
import { env } from '@/lib/env';
import { getErrorMessage } from '@/lib/error-messages';
import { useAppStore } from '@/store/app.store';
import { useAuthStore } from '@/store/auth.store';
import { useMe } from '../hooks/useMe';
import { sessionService } from '../services/session.service';
import './TwoFactorSettings.css';
import { t } from '@/i18n';

/** Telefon orqali ochilgan akkauntga Google hisobini ulash: keyin shu akkauntga Google orqali ham kirish mumkin (ma'lumotlar o‘zgarmaydi). */
export function GoogleLinkSettings() {
  const me = useMe();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const isAdmin = useAuthStore((s) => s.preferredRole) === 'ADMIN' || env.appRole === 'ADMIN';
  const buttonRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const linked = me.data?.googleLinked === true;
  const hasPassword = me.data?.hasPassword !== false;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const ready = !!me.data && !isAdmin;

  async function onCredential(credential: string) {
    setError(null);
    setBusy(true);
    try {
      await sessionService.linkGoogle(credential);
      await queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      pushToast(t('Google akkaunt ulandi.'), 'success');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (password.length < 8) return setPasswordError(t('Kamida 8 ta belgi'));
    if (password !== confirm) return setPasswordError(t('Parollar bir xil emas'));
    setPasswordError(null);
    setError(null);
    setBusy(true);
    try {
      await sessionService.setPassword(password);
      // Login va yangi parol bir marta ko‘rsatiladi (ro‘yxatdan o‘tishdagi kabi); parol serverda faqat xesh ko‘rinishida saqlanadi.
      if (me.data?.phone) {
        useAuthStore.getState().setNewCredentials({ phone: me.data.phone, password });
        setCredentialsOpen(true);
      }
      setPassword('');
      setConfirm('');
      await queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setError(null);
    setBusy(true);
    try {
      await sessionService.unlinkGoogle();
      await queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      pushToast(t('Google akkaunt uzildi.'), 'success');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!ready || linked || !env.googleClientId) return;
    let cancelled = false;
    void loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google) return;
        window.google.accounts.id.initialize({ client_id: env.googleClientId, callback: (response) => void onCredential(response.credential) });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          width: Math.min(400, Math.max(200, buttonRef.current.parentElement?.clientWidth ?? 320)),
        });
      })
      .catch(() => setError(new Error(t('Google xizmatiga ulanib bo‘lmadi. Internetni tekshiring.'))));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, linked]);

  if (isAdmin) return null;
  if (me.isLoading || !me.data) return <Skeleton style={{ height: 120, borderRadius: 16 }} />;

  function closeCredentials() {
    useAuthStore.getState().setNewCredentials(null);
    setCredentialsOpen(false);
  }

  return (
    <section className="gm-detail-section gm-twofa" aria-labelledby="gm-google-title">
      <Modal open={credentialsOpen} onClose={closeCredentials} dismissible={false} title={t('Parol o‘rnatildi')}>
        <NewCredentialsCard badge={t('Parol o‘rnatildi')} continueLabel={t('Yopish')} onContinue={closeCredentials} />
      </Modal>
      <div className="gm-twofa__head">
        <span className={linked ? 'gm-twofa__icon gm-twofa__icon--on' : 'gm-twofa__icon'} aria-hidden="true">
          <GoogleLogo />
        </span>
        <div className="gm-twofa__title">
          <h2 id="gm-google-title">{t('Google akkaunt')}</h2>
          <Badge tone={linked ? 'success' : 'neutral'}>{linked ? t('Ulangan') : t('Ulanmagan')}</Badge>
        </div>
      </div>
      <p className="gm-twofa__text">
        {linked
          ? t('Google akkauntingiz ulangan{email}. Endi shu akkauntga Google orqali ham kirishingiz mumkin; barcha ma’lumotlaringiz saqlanadi.', { email: me.data.googleEmail ? ` (${me.data.googleEmail})` : '' })
          : t('Google akkauntingizni ulang: keyin telefon va parolsiz, Google orqali tez kirishingiz mumkin. Barcha ma’lumotlaringiz saqlanadi.')}
      </p>
      {!!error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      {linked && !hasPassword && (
        <form
          className="gm-twofa__form"
          onSubmit={(event) => {
            event.preventDefault();
            void savePassword();
          }}
          noValidate
        >
          <Alert tone="warning" title={t('Google akkauntni uzish uchun avval parol o‘rnating.')}>
            {t('Akkauntingiz Google orqali ochilgan va unda parol yo‘q. Google uzilsa, akkauntga kirishning boshqa yo‘li qolmaydi va akkauntingizni yo‘qotasiz. Shuning uchun avval parol o‘rnating, shundan keyingina Google akkauntni uzish mumkin bo‘ladi.')}
          </Alert>
          <Input label={t('Yangi parol')} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Input label={t('Parolni takrorlang')} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} error={passwordError ?? undefined} />
          <Button type="submit" loading={busy}>
            {t('Parolni o‘rnatish')}
          </Button>
        </form>
      )}
      {linked ? (
        <div className="gm-twofa__switch">
          <Button variant="secondary" loading={busy} disabled={!hasPassword || !me.data?.phone} onClick={() => void unlink()}>
            {t('Google akkauntni uzish')}
          </Button>
          {!me.data?.phone && <p className="gm-google__hint">{t('Google akkauntni uzish uchun avval telefon raqamingizni kiriting va tasdiqlang.')}</p>}
        </div>
      ) : env.googleClientId ? (
        <div className="gm-google__wrap">
          <span className="gm-google__fallback" aria-hidden="true">
            <GoogleLogo />
            {t('Google akkauntni ulash')}
          </span>
          <div className="gm-google__button" ref={buttonRef} aria-busy={busy} aria-label={t('Google akkauntni ulash')} />
        </div>
      ) : (
        <Alert tone="info">{t('Google orqali kirish hali sozlanmagan. Administrator Google Client ID ni kiritishi kerak.')}</Alert>
      )}
    </section>
  );
}
