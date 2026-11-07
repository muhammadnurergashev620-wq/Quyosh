import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { shopService } from './shop.service';
import type { MyShop } from './types';

interface ShopSelection {
  shopId: string | null;
  setShopId: (shopId: string | null) => void;
}

/** Tanlangan do‘kon (foydalanuvchi bir nechta do‘konga a’zo bo‘lishi mumkin — TZ 2.1). */
const useShopSelection = create<ShopSelection>()(
  persist((set) => ({ shopId: null, setShopId: (shopId) => set({ shopId }) }), { name: 'quyosh.shop' }),
);

export const myShopsKey = ['shop', 'mine'] as const;

function useMyShops() {
  const hasSession = useAuthStore((s) => s.hasSession);
  return useQuery({ queryKey: myShopsKey, queryFn: shopService.myShops, enabled: hasSession, staleTime: 30_000 });
}

export interface CurrentShop {
  shops: MyShop[];
  shop: MyShop | null;
  shopId: string | null;
  isLoading: boolean;
  setShopId: (shopId: string) => void;
  /** TZ 2.2: OWNER — hamma ruxsat; boshqalar — ro‘yxat bo‘yicha. */
  can: (permission: string) => boolean;
}

export function useCurrentShop(): CurrentShop {
  const mine = useMyShops();
  const { shopId: selected, setShopId } = useShopSelection();
  const shops = mine.data ?? [];
  const shop = shops.find((item) => item.id === selected) ?? shops[0] ?? null;
  return {
    shops,
    shop,
    shopId: shop?.id ?? null,
    isLoading: mine.isLoading,
    setShopId,
    can: (permission) => !!shop && (shop.memberRole === 'OWNER' || shop.permissions.includes(permission)),
  };
}
