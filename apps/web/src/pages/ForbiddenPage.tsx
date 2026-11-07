import { ShieldX } from 'lucide-react';
import { StatusPage } from '@/components/common/StatusPage';
import { t } from '@/i18n';

/** U21 SYS-06: rol bu sahifaga ruxsat bermaydi — o‘z bosh sahifasiga qaytish tugmasi bilan. */
export function ForbiddenPage({ home }: { home: string }) {
  return (
    <StatusPage
      inline
      code="403"
      icon={<ShieldX size={32} />}
      title={t('Ruxsat yo‘q')}
      description={t('Bu sahifa sizning hisobingiz uchun mo‘ljallanmagan. Kerakli bo‘limlar bosh sahifangizda.')}
      action={{ to: home, label: t('Bosh sahifamga o‘tish') }}
    />
  );
}
