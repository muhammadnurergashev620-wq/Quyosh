import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { ApiError } from '@/types/api';
import { useAppStore } from '@/store/app.store';
import { useAuthStore } from '@/store/auth.store';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import { useMe } from '../hooks/useMe';
import { t } from '@/i18n';

/** Hisobni o‘chirish: qaytarib bo‘lmaydi — parol bilan tasdiqlanadi (parolsiz Google akkaunti uchun faqat tasdiqlash). */
export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const remove = useDeleteAccount();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [password, setPassword] = useState('');
  const needsPassword = me.data?.hasPassword !== false;
  const wrongPassword = remove.error instanceof ApiError && remove.error.code === 'UNAUTHORIZED';

  function close() {
    if (remove.isPending) return;
    setPassword('');
    remove.reset();
    onClose();
  }

  function confirm() {
    remove.mutate(needsPassword ? password : undefined, {
      onSuccess: () => {
        useAuthStore.getState().clear();
        queryClient.clear();
        pushToast(t('Akkauntingiz o‘chirildi.'), 'success');
        navigate('/', { replace: true });
      },
    });
  }

  return (
    <ConfirmDialog
      open={open}
      title={t('Hisobni o‘chirish')}
      description={t('Akkauntingiz butunlay o‘chiriladi: kirish to‘xtatiladi, ochiq so‘rovlar bekor qilinadi. Bu amalni qaytarib bo‘lmaydi.')}
      tone="danger"
      confirmLabel={t('O‘chirish')}
      loading={remove.isPending}
      confirmDisabled={needsPassword && password.length < 1}
      onCancel={close}
      onConfirm={confirm}
    >
      {needsPassword && (
        <Input
          label={t('Joriy parol')}
          type="password"
          autoComplete="current-password"
          placeholder={t('Parolingizni kiriting')}
          value={password}
          error={wrongPassword ? t('Kiritilgan parol noto‘g‘ri.') : undefined}
          onChange={(event) => {
            setPassword(event.target.value);
            if (remove.isError) remove.reset();
          }}
        />
      )}
      {remove.isError && !wrongPassword && <Alert tone="danger">{getErrorMessage(remove.error)}</Alert>}
    </ConfirmDialog>
  );
}
