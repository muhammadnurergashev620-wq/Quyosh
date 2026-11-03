import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { useDeleteUser, useSetRegistrationBlock, useSetUserStatus } from '../hooks/useAdmin';
import { USER_ACTION_COPY, displayName } from '../user-actions';
import type { UserAction } from '../user-actions';
import type { AdminUser } from '../types';
import { t } from '@/i18n';

export function UserActionDialog({ user, action, onClose, onDeleted }: { user: AdminUser; action: UserAction; onClose: () => void; onDeleted?: () => void }) {
  const copy = USER_ACTION_COPY[action];
  const setStatus = useSetUserStatus();
  const deleteUser = useDeleteUser();
  const regBlock = useSetRegistrationBlock();
  const [reason, setReason] = useState('');

  const pending = setStatus.isPending || deleteUser.isPending || regBlock.isPending;
  const error = setStatus.error ?? deleteUser.error ?? regBlock.error;
  const valid = !copy.reasonRequired || reason.trim().length >= 3;

  function confirm() {
    const done = { onSuccess: onClose };
    const trimmed = reason.trim();
    if (action === 'BLOCK_REGISTRATION' || action === 'ALLOW_REGISTRATION') regBlock.mutate({ id: user.id, blocked: action === 'BLOCK_REGISTRATION', reason: trimmed || undefined }, done);
    else if (action === 'DELETE') deleteUser.mutate({ id: user.id, reason: trimmed }, { onSuccess: () => (onDeleted ?? onClose)() });
    else if (action === 'ACTIVATE') setStatus.mutate({ id: user.id, status: 'ACTIVE' }, done);
    else setStatus.mutate({ id: user.id, status: action === 'SUSPEND' ? 'SUSPENDED' : 'BLOCKED', reason: trimmed }, done);
  }

  return (
    <Modal
      open
      onClose={pending ? () => undefined : onClose}
      title={copy.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>{t('Bekor qilish')}</Button>
          <Button variant={copy.variant} loading={pending} disabled={!valid} onClick={confirm}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="gm-form">
        <p>
          <strong>{displayName(user)}</strong> · {user.phone}
        </p>
        <Alert tone={copy.variant === 'danger' ? 'warning' : 'info'}>{copy.text}</Alert>
        {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
        {(action === 'BLOCK_REGISTRATION' || action === 'ALLOW_REGISTRATION') && (
          <Textarea label={t('Izoh (ixtiyoriy)')} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        )}
        {copy.reasonRequired && (
          <Textarea
            label={t('Sabab')}
            required
            rows={3}
            maxLength={500}
            hint={t('Audit jurnaliga yoziladi (kamida 3 ta belgi)')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}
