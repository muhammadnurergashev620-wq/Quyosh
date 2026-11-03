import { useEffect, useId, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/auth.store';
import { t } from '@/i18n';

/** Clipboard API bo‘lmasa (eski brauzer / ruxsatsiz muhit) — matnni belgilab, eski usulda nusxalaydi. */
async function copyText(text: string, fallbackTarget: HTMLElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallbackTarget) return false;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(fallbackTarget);
    selection?.removeAllRanges();
    selection?.addRange(range);
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

function CopyButton({ text, label, target, onCopied }: { text: string; label: string; target: React.RefObject<HTMLElement>; onCopied: (message: string) => void }) {
  const [done, setDone] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleClick() {
    const ok = await copyText(text, target.current);
    onCopied(ok ? t('{label}: nusxalandi', { label }) : t('Nusxalab bo‘lmadi, matnni qo‘lda belgilab nusxalang.'));
    if (!ok) return;
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 1800);
  }

  return (
    <button type="button" className={done ? 'gm-save__btn gm-save__btn--done' : 'gm-save__btn'} aria-label={label} onClick={() => void handleClick()}>
      {done ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      <span>{done ? t('Nusxalandi') : t('Nusxa')}</span>
    </button>
  );
}

/**
 * Ro‘yxatdan o‘tishdan keyin login va parol faqat BIR MARTA ko‘rsatiladi. Parol serverda faqat xesh ko‘rinishida
 * saqlanadi (qaytarib bo‘lmaydi); shu sabab uni o‘zingiz saqlab qo‘yishingiz kerak.
 * Kartochka yopilganda parol xotiradan o‘chiriladi.
 */
export function NewCredentialsCard({ onContinue, badge, continueLabel }: { onContinue: () => void; badge?: string; continueLabel?: string }) {
  const credentials = useAuthStore((s) => s.newCredentials);
  const setNewCredentials = useAuthStore((s) => s.setNewCredentials);
  const [shown, setShown] = useState(true);
  const [saved, setSaved] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const clearTimer = useRef(0);
  const loginRef = useRef<HTMLSpanElement>(null);
  const passwordRef = useRef<HTMLSpanElement>(null);
  const uid = useId();

  // Haqiqiy yopilishda xotiradan o‘chiriladi. StrictMode'ning sinov (mount→unmount→mount) siklida o‘chirib yubormaslik uchun kechiktirilgan va qayta mount bo‘lsa bekor qilinadi.
  useEffect(() => {
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    return () => {
      clearTimer.current = window.setTimeout(() => setNewCredentials(null), 0);
    };
  }, [setNewCredentials]);

  if (!credentials) return null;

  const titleId = `${uid}-title`;
  const loginLabelId = `${uid}-login`;
  const passwordLabelId = `${uid}-password`;
  const checkId = `${uid}-saved`;

  return (
    <section className="gm-save" aria-labelledby={titleId}>
      <span className="gm-save__ok">
        <CheckCircle2 size={16} aria-hidden="true" /> {badge ?? t('Hisobingiz yaratildi')}
      </span>
      <header className="gm-save__head">
        <h2 id={titleId}>{t('Login va parolingizni saqlang')}</h2>
        <p role="note">
          {t('Iltimos, login va parolni ishonchli joyda saqlang, chunki')} <strong>{t('parolni keyin qayta ko‘ra olmaysiz')}</strong>. {t('Uni yo‘qotsangiz, yangi parol o‘rnatish uchun administratorga murojaat qilishingiz kerak bo‘ladi.')}
        </p>
      </header>

      <div className="gm-save__field">
        <span className="gm-save__label" id={loginLabelId}>
          {t('Login (telefon)')}
        </span>
        <div className="gm-save__box">
          <span ref={loginRef} className="gm-save__value" role="textbox" aria-readonly="true" aria-labelledby={loginLabelId} tabIndex={0}>
            {credentials.phone}
          </span>
          <CopyButton text={credentials.phone} label={t('Loginni nusxalash')} target={loginRef} onCopied={setAnnouncement} />
        </div>
      </div>

      <div className="gm-save__field">
        <span className="gm-save__label" id={passwordLabelId}>
          {t('Parol')}
        </span>
        <div className="gm-save__box">
          <span
            ref={passwordRef}
            className={shown ? 'gm-save__value' : 'gm-save__value gm-save__value--masked'}
            role="textbox"
            aria-readonly="true"
            aria-labelledby={passwordLabelId}
            aria-description={shown ? undefined : t('Parol yashirilgan')}
            tabIndex={0}
          >
            {shown ? credentials.password : '•'.repeat(Math.min(credentials.password.length, 14))}
          </span>
          <button
            type="button"
            className="gm-save__btn gm-save__btn--icon"
            aria-pressed={shown}
            aria-label={shown ? t('Parolni yashirish') : t('Parolni ko‘rsatish')}
            onClick={() => setShown((value) => !value)}
          >
            {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
          <CopyButton text={credentials.password} label={t('Parolni nusxalash')} target={passwordRef} onCopied={setAnnouncement} />
        </div>
      </div>

      <label className="gm-save__confirm" htmlFor={checkId}>
        <input id={checkId} type="checkbox" required checked={saved} onChange={(event) => setSaved(event.target.checked)} />
        <span>{t('Login va parolni saqlab oldim')}</span>
      </label>

      <Button fullWidth className="gm-save__cta" disabled={!saved} onClick={onContinue}>
        {continueLabel ?? t('Kirishga o‘tish')}
      </Button>

      <p className="gm-save__sr" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
