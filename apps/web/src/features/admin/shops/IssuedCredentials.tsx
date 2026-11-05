import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';

/**
 * Admin yaratgan/tiklagan hisobning kirish ma’lumoti (TZ 3.7.1): vaqtincha parol FAQAT BIR MARTA ko‘rsatiladi.
 * "Nusxa olish" tugmalari bor; yopishdan oldin nusxa olganini tasdiqlash shart (yopilgach parolni qayta ko‘rib bo‘lmaydi).
 */
export function IssuedCredentials({ title, login, password, onClose, extra }: { title: string; login: string | null; password: string; onClose: () => void; extra?: React.ReactNode }) {
  const pushToast = useAppStore((s) => s.pushToast);
  const [copied, setCopied] = useState<'password' | 'both' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const copy = (kind: 'password' | 'both') => {
    const text = kind === 'password' ? password : `${t('Login')}: ${login ?? ''}\n${t('Parol')}: ${password}`;
    void navigator.clipboard.writeText(text).then(
      () => { setCopied(kind); setConfirmed(true); pushToast(t('Nusxa olindi'), 'success'); },
      () => pushToast(t('Nusxa olib bo‘lmadi: parolni qo‘lda ko‘chiring'), 'error'),
    );
  };
  return (
    <div className="qs-form">
      <Alert tone="warning" title={title}>{t('Bu parol faqat bir marta ko‘rsatiladi. Oyna yopilgach uni qayta ko‘rib bo‘lmaydi — yo‘qolsa, yangi vaqtincha parol bering. Egasi birinchi kirishda uni almashtiradi.')}</Alert>
      {extra}
      <dl className="qs-dl">
        <dt>{t('Login')}</dt><dd className="qs-mono">{login ?? '—'}</dd>
        <dt>{t('Vaqtincha parol')}</dt><dd><code className="qs-mono" style={{ fontSize: 18, letterSpacing: 1, userSelect: 'all' }}>{password}</code></dd>
      </dl>
      <div className="qs-page__actions">
        <Button variant="secondary" onClick={() => copy('password')}>{copied === 'password' ? <Check size={15} /> : <Copy size={15} />} {t('Nusxa olish')}</Button>
        <Button variant="ghost" onClick={() => copy('both')}>{copied === 'both' ? <Check size={15} /> : <Copy size={15} />} {t('Login va parolni nusxalash')}</Button>
      </div>
      <label className="qs-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> {t('Parolni nusxa oldim va egasiga yetkazaman')}</label>
      <div className="qs-form__actions">
        <Button disabled={!confirmed} onClick={onClose}>{t('Yopish')}</Button>
      </div>
    </div>
  );
}
