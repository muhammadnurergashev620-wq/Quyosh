import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/error-messages';
import { splitFullName } from '@/lib/account-name';
import { useMe } from '../hooks/useMe';
import { sessionService } from '../services/session.service';
import { t } from '@/i18n';

const noop = () => undefined;

/** Ism yoki familiya kiritilmagan mijoz/usta akkauntlari davom etishdan oldin ularni kiritishi shart. */
export function NameRequiredDialog() {
  const me = useMe();
  const queryClient = useQueryClient();
  const user = me.data;
  const [fullName, setFullName] = useState('');
  const names = splitFullName(fullName);
  const save = useMutation({
    mutationFn: () => sessionService.updateName(names as { firstName: string; lastName: string }),
    onSuccess: (updated) => queryClient.setQueryData(['users', 'me'], updated),
  });

  // Google'dan olingan ism/familiya qayta so‘ralmaydi: faqat yetishmayotgani kiritiladi.
  const needsName = !!user && !user.roles.includes('ADMIN') && (!user.firstName?.trim() || !user.lastName?.trim());
  if (!needsName) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (names) save.mutate();
  }

  return (
    <Modal
      open
      dismissible={false}
      onClose={noop}
      title={t('To‘liq ismingizni kiriting')}
      footer={
        <Button type="submit" form="gm-name-form" loading={save.isPending} disabled={!names}>
          {t('Saqlash')}
        </Button>
      }
    >
      <form id="gm-name-form" className="gm-form" onSubmit={handleSubmit}>
        <p className="qs-m-0 qs-text-muted">
          {t('Boshqa foydalanuvchilar sizni ismingiz bilan ko‘radi. Davom etish uchun ism va familiyangizni birga yozing.')}
        </p>
        {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
        <Input label={t('To‘liq ism')} placeholder={t('Masalan: Kamronbek Ziyovuddinov')} autoComplete="name" required autoFocus maxLength={200} value={fullName} onChange={(event) => setFullName(event.target.value)} />
      </form>
    </Modal>
  );
}
