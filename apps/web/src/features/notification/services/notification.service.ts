import { apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { AppNotification } from '../types';
import type { AdminNotificationDetail, AdminNotificationFilters, AdminNotificationStats, AdminNotificationsPage } from '../admin-types';

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const notificationService = {
  listMine() {
    return apiGet<CursorPage<AppNotification>>('/notifications');
  },
  unreadCount() {
    return apiGet<{ count: number }>('/notifications/meta/unread-count');
  },
  markAsRead(id: string) {
    return apiPatch<AppNotification>(`/notifications/${id}/read`);
  },
  adminList(filters: AdminNotificationFilters, page: number, limit: number) {
    return apiGet<AdminNotificationsPage>(`/admin/notifications${qs({ ...filters, page: String(page), limit: String(limit) })}`);
  },
  adminStats() {
    return apiGet<AdminNotificationStats>('/admin/notifications/stats');
  },
  adminDetail(id: string) {
    return apiGet<AdminNotificationDetail>(`/admin/notifications/${id}`);
  },
  adminMarkRead(ids: string[]) {
    return apiPost<{ count: number }>('/admin/notifications/read', { ids });
  },
  adminMarkUnread(id: string) {
    return apiPatch<{ id: string; read: boolean }>(`/admin/notifications/${id}/unread`);
  },
  markAllAsRead() {
    return apiPatch<unknown>('/notifications/read-all');
  },
};
