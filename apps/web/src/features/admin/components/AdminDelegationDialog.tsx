import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/error-messages';
import { useSetAdminDelegation } from '../hooks/useAdmin';
import type { AdminAccount } from '../types';
import { PermissionPicker } from './PermissionPicker';
import { t } from '@/i18n';

/** Superadmin: adminga yangi adminlar yaratish huquqini berish va unga qaysi huquqlarni bera olishini belgilash. */
export function AdminDelegationDialog({ admin, onClose }: { admin: AdminAccount; onClose: () => void }) {
  const save = useSetAdminDelegation();
  const [enabled, setEnabled] = useState(!!admin.canCreateAdmins);
  const [grantable, setGrantable] = useState<string[]>(admin.grantablePermissions ?? []);
  const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.phone;
  const invalid = enabled && grantable.length === 0;

  return (
    <Modal
      open
      onClose={save.isPending ? () => undefined : onClose}
      title={t('Admin yaratish vakolati')}
      large
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>{t('Bekor qilish')}</Button>
          <Button loading={save.isPending} disabled={invalid} onClick={() => save.mutate({ id: admin.id, canCreateAdmins: enabled, grantablePermissions: enabled ? grantable : [] }, { onSuccess: onClose })}>{t('Saqlash')}</Button>
        </>
      }
    >
      <div className="gm-newadm">
        <p style={{ margin: 0 }}>
          <strong>{name}</strong>{' '}{t('· ID {accountNumber}', { accountNumber: admin.accountNumber })}
        </p>
        {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
        <label className="gm-newadm__super">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={save.isPending} />
          <span>
            <strong>{t('Yangi adminlar yarata oladi')}</strong>
            <small>{t('Bu admin o‘zi yaratgan adminlarni boshqaradi. Superadmin va shu vakolatni bera olmaydi.')}</small>
          </span>
        </label>
        {enabled && <PermissionPicker value={grantable} onChange={setGrantable} disabled={save.isPending} title={t('Yangi adminlarga bera oladigan huquqlar')} />}
        {invalid && <Alert tone="warning">{t('Kamida bitta berilishi mumkin bo‘lgan huquq tanlang.')}</Alert>}
      </div>
    </Modal>
  );
}
