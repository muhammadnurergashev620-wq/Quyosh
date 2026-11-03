import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/Switch';
import { getErrorMessage } from '@/lib/error-messages';
import { apiPatch } from '@/services/api.client';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';

/** Superadmin: admin akkaunt o‘ziga profil rasmi qo‘ya olishini yoqadi/o‘chiradi (o‘chirilganda mavjud rasm saqlanib qoladi, lekin o‘zi o‘zgartira olmaydi). */
export function AdminAvatarPermission({ adminId, allowed, className = 'gm-adm__twofa' }: { adminId: string; allowed: boolean; className?: string }) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((state) => state.pushToast);
  const mutation = useMutation({
    mutationFn: (next: boolean) => apiPatch<{ adminAvatarAllowed: boolean }>(`/admin/admins/${adminId}/avatar-permission`, { allowed: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      pushToast(t('Rasm qo‘yish ruxsati yangilandi'), 'success');
    },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
  return (
    <div className={className}>
      <div>
        <strong>{t('Profil rasmi qo‘yish ruxsati')}</strong>
        <span>{allowed ? t('Admin o‘ziga profil rasmi qo‘ya oladi.') : t('Admin o‘zi rasm qo‘ya olmaydi. Rasmni faqat superadmin qo‘yadi.')}</span>
      </div>
      <Switch label={allowed ? t('Ruxsat berilgan') : t('Ruxsat berilmagan')} checked={allowed} disabled={mutation.isPending} onChange={(next) => mutation.mutate(next)} />
    </div>
  );
}
