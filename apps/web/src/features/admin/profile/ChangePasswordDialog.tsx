import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/error-messages';
import { useAppStore } from '@/store/app.store';
import { sessionService } from '@/features/session/services/session.service';
import { ApiError } from '@/types/api';
import { t } from '@/i18n';

/** Joriy parolni yangisiga almashtirish. Boshqa qurilmalar tizimdan chiqariladi, joriy qurilma qoladi. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((state) => state.pushToast);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const change = useMutation({
    mutationFn: () => sessionService.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'my-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      pushToast(result.revokedSessions > 0 ? t('Parol almashtirildi. {count} ta boshqa qurilma tizimdan chiqarildi.', { count: result.revokedSessions }) : t('Parol almashtirildi.'), 'success');
      onClose();
    },
  });
  const mismatch = again.length > 0 && next !== again;
  const tooShort = next.length > 0 && next.length < 8;
  const same = next.length > 0 && next === current;
  const valid = current.length > 0 && next.length >= 8 && next === again && !same;
  const wrong = change.error instanceof ApiError && change.error.code === 'UNAUTHORIZED';

  return (
    <Modal
      open
      onClose={change.isPending ? () => undefined : onClose}
      title={t('Parolni almashtirish')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={change.isPending}>{t('Bekor qilish')}</Button>
          <Button loading={change.isPending} disabled={!valid} onClick={() => change.mutate()}>{t('Parolni almashtirish')}</Button>
        </>
      }
    >
      <form className="gm-form" onSubmit={(event) => { event.preventDefault(); if (valid) change.mutate(); }}>
        {change.isError && <Alert tone="danger">{wrong ? t('Joriy parol noto‘g‘ri.') : getErrorMessage(change.error)}</Alert>}
        <Input label={t('Joriy parol')} type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
        <Input label={t('Yangi parol')} type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} error={tooShort ? t('Kamida 8 ta belgi') : same ? t('Yangi parol joriy paroldan farq qilsin') : undefined} hint={t('Kamida 8 ta belgi')} required />
        <Input label={t('Yangi parolni takrorlang')} type="password" autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} error={mismatch ? t('Parollar mos kelmadi') : undefined} required />
        <Alert tone="info">{t('Xavfsizlik uchun joriy qurilmadan boshqa barcha qurilmalar tizimdan chiqariladi.')}</Alert>
      </form>
    </Modal>
  );
}
