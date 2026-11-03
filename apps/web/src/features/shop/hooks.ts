import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app.store';
import { getErrorMessage } from '@/lib/error-messages';
import { shopService } from './shop.service';
import { myShopsKey } from './current-shop';
import { t } from '@/i18n';

export const shopKey = (shopId: string | null, ...rest: string[]) => ['shop', shopId ?? '-', ...rest];

export function useManagedShop(shopId: string | null) {
  return useQuery({ queryKey: shopKey(shopId), queryFn: () => shopService.get(shopId!), enabled: !!shopId });
}

export function useShopDocuments(shopId: string | null) {
  return useQuery({ queryKey: shopKey(shopId, 'documents'), queryFn: () => shopService.documents(shopId!), enabled: !!shopId });
}

export function useShopBranches(shopId: string | null) {
  return useQuery({ queryKey: shopKey(shopId, 'branches'), queryFn: () => shopService.branches(shopId!), enabled: !!shopId });
}

export function useShopServices(shopId: string | null) {
  return useQuery({ queryKey: shopKey(shopId, 'services'), queryFn: () => shopService.services(shopId!), enabled: !!shopId });
}

export function useShopMembers(shopId: string | null, enabled = true) {
  return useQuery({ queryKey: shopKey(shopId, 'members'), queryFn: () => shopService.members(shopId!), enabled: !!shopId && enabled });
}

/** Do‘kon ma’lumotini o‘zgartiradigan amal: muvaffaqiyatda do‘kon keshini yangilaydi va xabar chiqaradi. */
export function useShopMutation<TVars, TResult>(shopId: string | null, fn: (shopId: string, vars: TVars) => Promise<TResult>, options: { success?: string; keys?: string[][] } = {}) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (vars: TVars) => fn(shopId!, vars),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shopKey(shopId) });
      void queryClient.invalidateQueries({ queryKey: myShopsKey });
      for (const key of options.keys ?? []) void queryClient.invalidateQueries({ queryKey: key });
      if (options.success) pushToast(options.success, 'success');
    },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
}

export const savedToast = () => t('Saqlandi');
