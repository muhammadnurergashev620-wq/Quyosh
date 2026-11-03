import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { useAppStore } from '@/store/app.store';
import { sessionService } from '@/features/session/services/session.service';
import { t } from '@/i18n';

/** Ism va familiyani tahrirlash (sarlavhadagi profil nomi ham shu zahoti yangilanadi). */
export function NameForm({ firstName, lastName }: { firstName: string | null; lastName: string | null }) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((state) => state.pushToast);
  const [first, setFirst] = useState(firstName ?? '');
  const [last, setLast] = useState(lastName ?? '');
  useEffect(() => {
    setFirst(firstName ?? '');
    setLast(lastName ?? '');
  }, [firstName, lastName]);
  const save = useMutation({
    mutationFn: () => sessionService.updateName({ firstName: first.trim(), lastName: last.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'my-profile'] });
      pushToast(t('Ism yangilandi'), 'success');
    },
  });
  const dirty = first.trim() !== (firstName ?? '') || last.trim() !== (lastName ?? '');
  const valid = first.trim().length >= 2 && last.trim().length >= 2;
  return (
    <form className="gm-aprof__nameform" onSubmit={(event) => { event.preventDefault(); if (dirty && valid) save.mutate(); }}>
      {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
      <div className="gm-aprof__two">
        <Input label={t('Ism')} value={first} onChange={(event) => setFirst(event.target.value)} maxLength={60} required />
        <Input label={t('Familiya')} value={last} onChange={(event) => setLast(event.target.value)} maxLength={60} required />
      </div>
      <Button type="submit" size="sm" loading={save.isPending} disabled={!dirty || !valid}><Check size={15} aria-hidden="true" /> {t('Saqlash')}</Button>
    </form>
  );
}
