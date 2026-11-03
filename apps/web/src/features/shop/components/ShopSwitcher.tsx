import { useQueryClient } from '@tanstack/react-query';
import { useCurrentShop } from '../current-shop';
import { t } from '@/i18n';

/** Bir nechta do‘konga a’zo foydalanuvchi uchun do‘kon almashtirgich (TZ 2.1). */
export function ShopSwitcher() {
  const { shops, shopId, setShopId } = useCurrentShop();
  const queryClient = useQueryClient();
  if (shops.length < 2) return null;
  return (
    <select
      className="qs-select"
      aria-label={t('Do‘konni tanlash')}
      value={shopId ?? ''}
      onChange={(e) => {
        setShopId(e.target.value);
        void queryClient.invalidateQueries({ queryKey: ['shop'] });
      }}
    >
      {shops.map((shop) => (
        <option key={shop.id} value={shop.id}>{shop.name}</option>
      ))}
    </select>
  );
}
