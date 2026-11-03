import { LogOut } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useLogout } from '../hooks/useAuth';
import { t } from '@/i18n';

/** «Tizimdan chiqish» bosilganda: chiqishga ishonchingiz komilmi? — «Qolish» yoki «Tizimdan chiqish». */
export function LogoutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const logout = useLogout();
  return (
    <ConfirmDialog
      open={open}
      title={t('Tizimdan chiqish')}
      description={t('Tizimdan chiqishga ishonchingiz komilmi?')}
      icon={<LogOut size={28} />}
      showCancel
      cancelLabel={t('Qolish')}
      confirmLabel={t('Tizimdan chiqish')}
      loading={logout.isPending}
      onCancel={onClose}
      onConfirm={() => logout.mutate(false, { onSettled: onClose })}
    />
  );
}
