import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notification.service';
import { useAuthStore } from '@/store/auth.store';

export function useNotifications(enabled = true) {
  return useQuery({ queryKey: ['notifications', 'mine'], queryFn: () => notificationService.listMine(), enabled, refetchInterval: 20_000 });
}

export function useUnreadCount() {
  // Guest (mijoz panelining ochiq sahifalari) uchun so‘rov yuborilmaydi — aks holda 401 «sessiya tugadi»ga olib keladi.
  const hasSession = useAuthStore((s) => s.hasSession);
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationService.unreadCount(),
    enabled: hasSession,
    refetchInterval: 20_000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
