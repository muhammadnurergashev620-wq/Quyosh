import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { ApiError } from '@/types/api';
import { otpSchema } from '../validation';
import type { CodeDelivery } from '../types';
import { OtpCodeInput } from './OtpCodeInput';
import './OtpForm.css';
import { t } from '@/i18n';

const CODE_LENGTH = 6;

export interface OtpFormProps {
  phone: string;
  loading: boolean;
  error: unknown;
  onSubmit: (values: { code: string }) => void;
  /** Yangi kod so‘rash. Muvaffaqiyatli bo‘lsa true qaytaradi. */
  onResend?: () => Promise<boolean>;
  /** Kod qayerga yuborilgani (email / SMS); berilsa, tushuntirish shu bo‘yicha ko‘rsatiladi. */
  delivery?: CodeDelivery | null;
  /** Kodni SMS orqali olish (faqat SMS ulangan va hozir SMS tanlanmagan bo‘lsa beriladi). */
  onSendSms?: () => Promise<boolean>;
  /** «Qayta yuborish» / «SMS» so‘rovidagi oxirgi xato: soatlik chegara tugagan bo‘lsa, tugmalar bloklanadi. */
  actionError?: unknown;
}

/** Kodni qayta yuborish 2 daqiqadan keyin mumkin (backend: OTP_RESEND_SECONDS=120 bilan mos). */
const RESEND_COOLDOWN_SECONDS = 120;

/** Soatiga 3 tadan ortiq kod so‘rab bo‘lmaydi (server 429 va shu matn bilan javob beradi). */
const isHourlyLimit = (error: unknown) => error instanceof ApiError && error.statusCode === 429 && /Soatiga/.test(error.message);

const clock = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;

export function OtpForm({ phone, loading, error, onSubmit, onResend, delivery, onSendSms, actionError }: OtpFormProps) {
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');
  /** Soatlik kod so‘rash chegarasi tugagan bo‘lsa — qayta yuborish va SMS tugmalari bloklanadi (xabar bilan). */
  const [limitMessage, setLimitMessage] = useState('');
  const submitted = useRef('');

  useEffect(() => {
    if (isHourlyLimit(actionError)) setLimitMessage(getErrorMessage(actionError));
  }, [actionError]);

  useEffect(() => {
    const timer = window.setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function submit(value: string) {
    const parsed = otpSchema.safeParse({ code: value });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? t('6 xonali kodni kiriting'));
      return;
    }
    setLocalError('');
    submitted.current = value;
    onSubmit({ code: parsed.data.code });
  }

  function change(value: string) {
    setCode(value);
    setLocalError('');
    if (value.length < CODE_LENGTH) submitted.current = '';
    // To‘liq kod kiritilishi bilan o‘zi yuboriladi (bir xil kod ikki marta yuborilmaydi).
    else if (!loading && submitted.current !== value) submit(value);
  }

  function reset() {
    setResendIn(RESEND_COOLDOWN_SECONDS);
    setCode('');
    setLocalError('');
    submitted.current = '';
  }

  async function resend() {
    if (!onResend || resending) return;
    setResending(true);
    const ok = await onResend().catch(() => false);
    setResending(false);
    if (ok) reset();
  }

  async function sendSms() {
    if (!onSendSms || sendingSms) return;
    setSendingSms(true);
    const ok = await onSendSms().catch(() => false);
    setSendingSms(false);
    if (ok) reset();
  }

  const rejected = !!error && code.length === CODE_LENGTH && submitted.current === code;
  const invalid = rejected || !!localError;
  const errorText = localError || (rejected ? getErrorMessage(error) : '');
  const DeliveryIcon = delivery?.channel === 'EMAIL' ? Mail : delivery?.channel === 'SMS' ? Smartphone : ShieldCheck;

  return (
    <form
      className="gm-otp"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        submit(code);
      }}
      noValidate
    >
      <span className="gm-otp__icon" aria-hidden="true">
        <DeliveryIcon size={30} strokeWidth={1.9} />
      </span>

      {delivery && delivery.channel !== 'NONE' ? (
        <p className="gm-otp__lead">
          <span>{delivery.channel === 'EMAIL' ? t('Tasdiqlash kodi emailingizga yuborildi.') : t('Tasdiqlash kodi SMS orqali yuborildi.')}</span>
          <strong>{delivery.destination}</strong>
        </p>
      ) : (
        <p className="gm-otp__lead">
          <strong>+{phone.replace('+', '')}</strong>
          <span>{t('raqamiga yuborilgan 6 xonali kodni kiriting.')}</span>
        </p>
      )}

      <OtpCodeInput value={code} onChange={change} label={t('Tasdiqlash kodi')} invalid={invalid} length={CODE_LENGTH} />

      {errorText && (
        <p className="gm-otp__error" role="alert">
          {errorText}
        </p>
      )}

      <Button type="submit" size="lg" loading={loading} disabled={code.length < CODE_LENGTH} fullWidth>
        {t('Tasdiqlash')}
      </Button>

      {limitMessage ? (
        <p className="gm-otp__limit" role="alert">
          {limitMessage}
        </p>
      ) : (
        <>
          {onSendSms && (
            <Button type="button" variant="secondary" size="lg" fullWidth loading={sendingSms} onClick={() => void sendSms()}>
              <Smartphone size={17} aria-hidden="true" /> {t('Kodni SMS orqali olish')}
            </Button>
          )}
          {onResend && (
            <p className="gm-otp__resendrow">
              {t('Kod kelmadimi?')}{' '}
              <button type="button" className="gm-otp__resend" disabled={resendIn > 0 || resending} onClick={() => void resend()}>
                {resendIn > 0 ? t('Qayta yuborish ({time})', { time: clock(resendIn) }) : t('Qayta yuborish')}
              </button>
            </p>
          )}
        </>
      )}
    </form>
  );
}
