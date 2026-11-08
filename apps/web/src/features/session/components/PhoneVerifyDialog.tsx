import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/error-messages';
import { formatLocalPhone, localPhoneSchema, toFullPhone, toLocalDigits } from '@/features/auth/validation';
import { OtpCodeInput } from '@/features/auth/components/OtpCodeInput';
import { sessionService } from '../services/session.service';
import { t } from '@/i18n';

/** Telefonsiz (masalan, Google orqali ochilgan) akkaunt uchun: raqamni kiritish va SMS/Telegram kod bilan tasdiqlash. */
export function PhoneVerifyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [local, setLocal] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: () => sessionService.requestPhone(toFullPhone(toLocalDigits(local))),
    onSuccess: (result) => {
      setSent(true);
      setDevCode(result.developmentCode ?? null);
    },
  });
  const verify = useMutation({
    mutationFn: () => sessionService.verifyPhone(toFullPhone(toLocalDigits(local)), code),
    onSuccess: (me) => {
      queryClient.setQueryData(['users', 'me'], me);
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!sent) {
      const parsed = localPhoneSchema.safeParse(local);
      if (!parsed.success) return setPhoneError(parsed.error.issues[0]?.message ?? t('Telefon raqami noto‘g‘ri'));
      setPhoneError(null);
      request.mutate();
    } else if (/^\d{6}$/.test(code)) verify.mutate();
  }

  const error = request.error ?? verify.error;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Telefon raqamini tasdiqlash')}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('Bekor qilish')}
          </Button>
          <Button type="submit" form="gm-phone-form" loading={request.isPending || verify.isPending} disabled={sent && code.length !== 6}>
            {sent ? t('Tasdiqlash') : t('Kod yuborish')}
          </Button>
        </>
      }
    >
      <form id="gm-phone-form" className="gm-form" onSubmit={submit}>
        <p className="qs-m-0 qs-text-muted">
          {t('So‘rov yuborish uchun telefon raqamingiz kerak: do‘kon siz bilan shu raqam orqali bog‘lanadi.')}
        </p>
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
          disabled={sent}
          value={local}
          onChange={(event) => setLocal(event.target.value)}
          error={phoneError ?? undefined}
        />
        {sent && (
          <>
            {devCode && <Alert tone="warning" title={t('Test rejimi')}>{t('Sinov kodi: {code}', { code: devCode })}</Alert>}
            <OtpCodeInput value={code} onChange={setCode} label={t('Tasdiqlash kodi')} />
          </>
        )}
      </form>
    </Modal>
  );
}
