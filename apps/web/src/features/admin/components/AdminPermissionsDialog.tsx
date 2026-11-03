import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/error-messages';
import { useSetAdminPermissions } from '../hooks/useAdmin';
import type { AdminAccount } from '../types';
import { PermissionPicker } from './PermissionPicker';
import { t } from '@/i18n';

/** Oddiy adminning ruxsat berilgan bo‘limlarini o‘zgartirish (faqat superadmin). */
export function AdminPermissionsDialog({ admin, onClose, allowed }: { admin: AdminAccount; onClose: () => void; allowed?: string[] }) {
  const save = useSetAdminPermissions();
  const [permissions, setPermissions] = useState<string[]>(admin.adminPermissions ?? []);
  const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.phone;

  return (
    <Modal
      open
      onClose={save.isPending ? () => undefined : onClose}
      title={t('Admin huquqlari')}
      large
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>{t('Bekor qilish')}</Button>
          <Button loading={save.isPending} disabled={permissions.length === 0} onClick={() => save.mutate({ id: admin.id, permissions }, { onSuccess: onClose })}>{t('Saqlash')}</Button>
        </>
      }
    >
      <div className="gm-newadm">
        <p style={{ margin: 0 }}>
          <strong>{name}</strong>{' '}{t('· ID {accountNumber}. Faqat belgilangan bo‘limlar ochiq bo‘ladi, qolganlari yashiriladi va serverda ham taqiqlanadi.', { accountNumber: admin.accountNumber })}</p>
        {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
        <PermissionPicker value={permissions} onChange={setPermissions} disabled={save.isPending} allowed={allowed} />
        {permissions.length === 0 && <Alert tone="warning">{t('Oddiy admin uchun kamida bitta bo‘lim tanlang.')}</Alert>}
      </div>
    </Modal>
  );
}
