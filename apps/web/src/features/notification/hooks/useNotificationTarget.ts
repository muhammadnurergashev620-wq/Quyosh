import { useNavigate } from 'react-router-dom';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import { notificationMeta } from '../notification-meta';
import type { AppNotification } from '../types';
import { useMarkAsRead } from './useNotifications';

/** Joriy panel (mijoz / do‘kon / admin) va bildirishnomani ochish: o‘qilgan qiladi va tegishli sahifaga o‘tadi. */
export function useNotificationTarget() {
  const navigate = useNavigate();
  const preferredRole = useAuthStore((state) => state.preferredRole);
  const role = env.appRole ?? preferredRole;
  const base: '/mijoz' | '/dokon' = role === 'SHOP' ? '/dokon' : '/mijoz';
  const admin = role === 'ADMIN';
  const markAsRead = useMarkAsRead();

  function open(item: AppNotification, after?: () => void) {
    if (item.status !== 'READ') markAsRead.mutate(item.id);
    const { to } = notificationMeta(item, base, admin);
    after?.();
    if (to) navigate(to);
  }

  return { base, admin, open, markRead: (id: string) => markAsRead.mutate(id) };
}
