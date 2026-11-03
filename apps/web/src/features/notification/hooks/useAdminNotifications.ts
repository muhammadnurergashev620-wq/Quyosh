import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notification.service';
import type { AdminNotificationFilters } from '../admin-types';

export function useAdminNotifications(filters: AdminNotificationFilters, page: number, limit: number) {
  return useQuery({ queryKey: ['notifications', 'admin', 'list', filters, page, limit], queryFn: () => notificationService.adminList(filters, page, limit), placeholderData: keepPreviousData, refetchInterval: 20_000 });
}

export function useAdminNotificationStats() {
  return useQuery({ queryKey: ['notifications', 'admin', 'stats'], queryFn: () => notificationService.adminStats(), refetchInterval: 20_000 });
}

export function useAdminNotificationDetail(id: string | null) {
  return useQuery({ queryKey: ['notifications', 'admin', 'detail', id], queryFn: () => notificationService.adminDetail(id as string), enabled: !!id });
}

export function useAdminNotificationActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  return {
    markRead: useMutation({ mutationFn: (ids: string[]) => notificationService.adminMarkRead(ids), onSuccess: refresh }),
    markUnread: useMutation({ mutationFn: (id: string) => notificationService.adminMarkUnread(id), onSuccess: refresh }),
    markAll: useMutation({ mutationFn: () => notificationService.markAllAsRead(), onSuccess: refresh }),
  };
}
