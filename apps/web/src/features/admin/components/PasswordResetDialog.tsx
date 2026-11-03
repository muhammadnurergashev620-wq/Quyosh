import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/error-messages';
import { useSetUserPassword } from '../hooks/useAdmin';
import { t } from '@/i18n';

/** Tasodifiy, o‘qish oson (o‘xshash belgilarsiz) parol. */
function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (value) => chars.charAt(value % chars.length)).join('');
}

export function PasswordResetDialog({ userId, name, phone, onClose }: { userId: string; name: string; phone: string; onClose: () => void }) {
  const setPassword = useSetUserPassword();
  const [password, setPasswordText] = useState('');
  const [reason, setReason] = useState('');
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [doneWith, setDoneWith] = useState<string | null>(null);

  const valid = password.length >= 8 && password.length <= 128;

  function copy(text: string) {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <Modal
      open
      onClose={setPassword.isPending ? () => undefined : onClose}
      title={t('Parolni o‘zgartirish')}
      footer={
        doneWith ? (
          <Button onClick={onClose}>{t('Yopish')}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={setPassword.isPending}>{t('Bekor qilish')}</Button>
            <Button
              loading={setPassword.isPending}
              disabled={!valid}
              onClick={() => setPassword.mutate({ id: userId, password, reason: reason.trim() }, { onSuccess: () => setDoneWith(password) })}
            >
              <KeyRound size={16} />{' '}{t('Parolni saqlash')}</Button>
          </>
        )
      }
    >
      <div className="gm-form">
        <p>
          <strong>{name}</strong> · {phone}
        </p>
        {doneWith ? (
          <>
            <Alert tone="success">{t('Parol o‘zgartirildi. Foydalanuvchi barcha qurilmalardan chiqarildi.')}</Alert>
            <p className="gm-card__meta">{t('Yangi parolni foydalanuvchiga xavfsiz yo‘l bilan yetkazing. Bu oynani yopgach uni qayta ko‘rib bo‘lmaydi.')}</p>
            <div className="gm-pwreveal">
              <code>{doneWith}</code>
              <Button size="sm" variant="secondary" onClick={() => copy(doneWith)}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t('Nusxalandi') : t('Nusxalash')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert tone="warning">{t('Yangi parol belgilasangiz, foydalanuvchi hamma qurilmalardan chiqariladi va eski parol ishlamaydi.')}</Alert>
            {setPassword.isError && <Alert tone="danger">{getErrorMessage(setPassword.error)}</Alert>}
            <div className="gm-pwfield">
              <Input
                label={t('Yangi parol')}
                type={shown ? 'text' : 'password'}
                value={password}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                hint={t('Kamida 8 ta belgi')}
                onChange={(event) => setPasswordText(event.target.value)}
              />
              <div className="gm-pwfield__tools">
                <Button type="button" size="sm" variant="secondary" onClick={() => setShown((value) => !value)}>
                  {shown ? <EyeOff size={16} /> : <Eye size={16} />} {shown ? t('Yashirish') : t('Ko‘rsatish')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPasswordText(generatePassword());
                    setShown(true);
                  }}
                >
                  <RefreshCw size={16} />{' '}{t('Tasodifiy yaratish')}</Button>
              </div>
            </div>
            <Input label={t('Sabab (ixtiyoriy)')} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
          </>
        )}
      </div>
    </Modal>
  );
}
