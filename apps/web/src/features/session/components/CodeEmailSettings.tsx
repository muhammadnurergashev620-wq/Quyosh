import { useState } from 'react';
import type { FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { useAppStore } from '@/store/app.store';
import { useMe } from '../hooks/useMe';
import { useSetEmail } from '../hooks/useTwoFactor';
import './CodeEmailSettings.css';
import { t } from '@/i18n';

const maskEmail = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, '$1•••$2');

/** Tasdiqlash kodlari avval shu emailga yuboriladi; SMS esa kod kiritish sahifasidagi tugma orqali olinadi. */
export function CodeEmailSettings() {
  const me = useMe();
  const setEmail = useSetEmail();
  const pushToast = useAppStore((s) => s.pushToast);
  const [email, setEmailValue] = useState('');
  const [password, setPassword] = useState('');
  const [editing, setEditing] = useState(false);

  if (!me.data) return null;
  const user = me.data;
  const hasEmail = !!user.email;
  const showForm = !hasEmail || editing;

  function save(event: FormEvent) {
    event.preventDefault();
    setEmail.mutate(
      { email: email.trim(), password: user.hasPassword ? password : undefined },
      {
        onSuccess: () => {
          setEmailValue('');
          setPassword('');
          setEditing(false);
          pushToast(t('Email saqlandi.'), 'success');
        },
      },
    );
  }

  return (
    <section className="gm-codemail" aria-labelledby="gm-codemail-title">
      <div className="gm-codemail__head">
        <span className="gm-codemail__icon" aria-hidden="true">
          <Mail size={22} />
        </span>
        <h2 id="gm-codemail-title">{t('Tasdiqlash kodi emaili')}</h2>
      </div>
      <p className="gm-codemail__text">
        {t('Kirishda tasdiqlash kodi avval shu emailga yuboriladi. SMS orqali olish uchun kod kiritish sahifasidagi «SMS orqali olish» tugmasidan foydalaning.')}
      </p>

      {!showForm && (
        <div className="gm-codemail__current">
          <span>{maskEmail(user.email as string)}</span>
          <button type="button" onClick={() => setEditing(true)}>{t('Emailni o‘zgartirish')}</button>
        </div>
      )}

      {showForm && (
        <form className="gm-codemail__form" onSubmit={save} noValidate>
          {!hasEmail && <Alert tone="info">{t('Email kiritilmagan — hozircha kod faqat telefon orqali keladi.')}</Alert>}
          <Input label={t('Email manzil')} type="email" autoComplete="email" placeholder="ism@example.com" value={email} onChange={(event) => setEmailValue(event.target.value)} />
          {user.hasPassword && (
            <Input label={t('Joriy parol')} type="password" autoComplete="current-password" placeholder={t('Parolingizni kiriting')} value={password} onChange={(event) => setPassword(event.target.value)} />
          )}
          {setEmail.isError && <Alert tone="danger">{getErrorMessage(setEmail.error)}</Alert>}
          <div className="gm-codemail__actions">
            <Button type="submit" loading={setEmail.isPending} disabled={!email.includes('@') || (user.hasPassword && !password)}>{t('Emailni saqlash')}</Button>
            {hasEmail && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>{t('Bekor qilish')}</Button>}
          </div>
        </form>
      )}
    </section>
  );
}
