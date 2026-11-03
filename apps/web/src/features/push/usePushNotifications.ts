import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { env } from '@/lib/env';
import { notificationMeta } from '@/features/notification/notification-meta';
import { isNativeApp, sendPushToken } from './push-native';
import { isWebPushSupported, panelOfRole, registerWebPush } from './web-push';

/** Bildirishnoma ma’lumotidan (`data`) o‘tiladigan sahifani aniqlaydi (notificationMeta bilan bir xil qoida). */
function usePushTarget(): (data: Record<string, unknown>, title?: string, body?: string) => void {
  const navigate = useNavigate();
  return useCallback(
    (data, title = '', body = '') => {
      const isAdmin = env.appRole === 'ADMIN';
      const base = env.appRole === 'SHOP' ? '/dokon' : '/mijoz';
      const type = typeof data.type === 'string' ? data.type : undefined;
      const to = notificationMeta({ id: '', title, body, template: type ?? null, data, status: 'SENT', readAt: null, createdAt: new Date().toISOString() }, base, isAdmin).to;
      if (to) navigate(to);
    },
    [navigate],
  );
}

/**
 * Push bildirishnomalarni yoqadi.
 * Telefon ilovasida: ruxsat so‘raydi, qurilma tokenini yuboradi, bosilganda sahifani ochadi.
 * Brauzerda: ruxsat berilgan bo‘lsa tokenni yangilaydi va bildirishnoma bosilganda sahifani ochadi (ruxsatni «yoqish» tugmasi so‘raydi).
 */
export function usePushNotifications(enabled: boolean): void {
  const openTarget = usePushTarget();

  // Telefon ilovasi (Capacitor).
  useEffect(() => {
    if (!enabled || !isNativeApp()) return;
    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    const panel = panelOfRole();

    void (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        // Android 8+: bildirishnoma kanallari (qo‘ng‘iroq — yuqori ustuvorlik).
        await PushNotifications.createChannel({ id: 'default', name: 'Bildirishnomalar', importance: 4, visibility: 1, vibration: true }).catch(() => undefined);
        await PushNotifications.createChannel({ id: 'calls', name: 'Qo‘ng‘iroqlar', importance: 5, visibility: 1, vibration: true }).catch(() => undefined);

        handles.push(
          await PushNotifications.addListener('registration', (token) => {
            void sendPushToken(token.value, panel).catch(() => undefined);
          }),
          await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            openTarget((action.notification.data ?? {}) as Record<string, unknown>, action.notification.title ?? '', action.notification.body ?? '');
          }),
        );
        if (cancelled) return;

        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') permission = await PushNotifications.requestPermissions();
        if (permission.receive === 'granted' && !cancelled) await PushNotifications.register();
      } catch {
        /* push ishlamasa ham ilova ishlashda davom etadi */
      }
    })();

    return () => {
      cancelled = true;
      handles.forEach((handle) => void handle.remove().catch(() => undefined));
    };
  }, [enabled, openTarget]);

  // Brauzer (Web Push).
  useEffect(() => {
    if (!enabled || !isWebPushSupported()) return;
    void registerWebPush();
    const onMessage = (event: MessageEvent) => {
      const payload = event.data as { source?: string; data?: Record<string, unknown> } | null;
      if (payload?.source === 'gm-push' && payload.data) openTarget(payload.data);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    // Sayt yopiq edi va bildirishnoma bosilib ochildi: `?push=` parametridan sahifaga o‘tiladi.
    const raw = new URLSearchParams(window.location.search).get('push');
    if (raw) {
      try {
        openTarget(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        /* buzuq parametr e’tiborsiz */
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('push');
      window.history.replaceState(null, '', url.toString());
    }
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [enabled, openTarget]);
}
