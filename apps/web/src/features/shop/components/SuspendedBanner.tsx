import { Alert } from '@/components/ui/Alert';
import { useCurrentShop } from '@/features/shop/current-shop';
import { t } from '@/i18n';

/** TZ 3.7.3: to‘xtatilgan do‘kon — har bir kabinet sahifasida “faqat o‘qish” banneri (yozish amallari serverda 423). */
export function SuspendedBanner() {
  const { shop } = useCurrentShop();
  if (shop?.status !== 'SUSPENDED') return null;
  return (
    <Alert tone="danger" title={t('Do‘kon vaqtincha to‘xtatilgan')}>
      {t('Faqat ko‘rish mumkin: o‘zgartirish, taklif yuborish va yangi so‘rov qabul qilish yopiq. Sabab: {reason}', { reason: shop.suspendReason ?? '—' })}{' '}
      {t('Savollar bo‘yicha administratorga murojaat qiling.')}
    </Alert>
  );
}
