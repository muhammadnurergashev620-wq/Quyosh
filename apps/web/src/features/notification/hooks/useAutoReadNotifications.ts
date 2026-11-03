import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { env } from '@/lib/env';
import { notificationMeta } from '../notification-meta';
import { useMarkAsRead, useNotifications } from './useNotifications';

/**
 * Foydalanuvchi bildirishnoma ko‘rsatayotgan sahifaning o‘ziga kirgan bo‘lsa (masalan, buyurtma yoki
 * so‘rov sahifasi), bildirishnomani ochmasdan ham o‘qilgan deb belgilaydi.
 * Suhbatlar serverda o‘qilganda belgilanadi.
 */
export function useAutoReadNotifications() {
  const { pathname } = useLocation();
  const preferredRole = useAuthStore((state) => state.preferredRole);
  const hasSession = useAuthStore((state) => state.hasSession);
  const role = env.appRole ?? preferredRole;
  const admin = role === 'ADMIN';
  const base = role === 'SHOP' ? '/dokon' : '/mijoz';
  const notifications = useNotifications(hasSession);
  const { mutate } = useMarkAsRead();
  const sent = useRef(new Set<string>());

  useEffect(() => {
    for (const item of notifications.data?.items ?? []) {
      if (item.status === 'READ' || sent.current.has(item.id)) continue;
      if (item.template === 'chat.message') continue;
      const target = notificationMeta(item, base, admin).to?.split(/[?#]/)[0];
      if (target && target === pathname) {
        sent.current.add(item.id);
        mutate(item.id);
      }
    }
  }, [notifications.data, pathname, base, admin, mutate]);
}
