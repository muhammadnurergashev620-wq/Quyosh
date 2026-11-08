import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { useMe } from '@/features/session/hooks/useMe';
import { formatDate } from '@/lib/format';
import { t } from '@/i18n';
import { m7Service } from './m7.service';
import './m7.css';

/** TZ 16: o‘chirish rejalashtirilgan hisob — 14 kun ichida bekor qilish mumkin. */
export function DeletionBanner() {
  const me = useMe();
  const queryClient = useQueryClient();
  const cancel = useMutation({ mutationFn: m7Service.cancelDeletion, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users', 'me'] }) });
  const at = (me.data as { deletionScheduledAt?: string | null } | undefined)?.deletionScheduledAt;
  if (!at) return null;
  return (
    <div className="qs-banner-danger qs-mb-4" role="alert">
      <span>{t('Hisobingiz {d} da o‘chiriladi.', { d: formatDate(at) })}</span>
      <Button size="sm" variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate()}>{t('O‘chirishni bekor qilish')}</Button>
    </div>
  );
}
