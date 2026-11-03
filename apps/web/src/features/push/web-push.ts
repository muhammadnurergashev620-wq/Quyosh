import { env } from '@/lib/env';
import { isNativeApp, sendPushToken } from './push-native';

type Panel = 'customer' | 'master' | 'admin';

const DISMISS_KEY = 'gm-webpush-dismissed';

export const panelOfRole = (): Panel => (env.appRole === 'ADMIN' ? 'admin' : env.appRole === 'SHOP' ? 'master' : 'customer');

/** Brauzer push: sozlama berilgan, brauzer qo‘llab-quvvatlaydi va sayt xavfsiz ulanishda ochilgan (https yoki localhost). */
export function isWebPushSupported(): boolean {
  if (isNativeApp() || typeof window === 'undefined') return false;
  const { apiKey, projectId, messagingSenderId, appId, vapidKey } = env.firebase;
  if (!apiKey || !projectId || !messagingSenderId || !appId || !vapidKey) return false;
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export const webPushPermission = (): NotificationPermission => (typeof Notification === 'undefined' ? 'denied' : Notification.permission);

export function webPushDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissWebPush(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* saqlab bo‘lmasa, taklif keyingi safar yana chiqadi */
  }
}

/** Xizmat skriptini ro‘yxatdan o‘tkazadi, FCM tokenini oladi va serverga yuboradi. Ruxsat berilgan bo‘lishi kerak. */
export async function registerWebPush(panel: Panel = panelOfRole()): Promise<boolean> {
  if (!isWebPushSupported() || Notification.permission !== 'granted') return false;
  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return false;
    const registration = await navigator.serviceWorker.register('/push-sw.js');
    await navigator.serviceWorker.ready;
    const { vapidKey, ...config } = env.firebase;
    const app = getApps()[0] ?? initializeApp(config);
    const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return false;
    await sendPushToken(token, panel, 'web');
    return true;
  } catch (error) {
    // Push ishlamasa ham sayt ishlayveradi; sabab konsolda ko‘rinadi.
    console.warn('[push] Brauzer push yoqilmadi:', error);
    return false;
  }
}

/** Foydalanuvchi tugmani bosganda: ruxsat so‘raydi va muvaffaqiyatli bo‘lsa tokenni ro‘yxatdan o‘tkazadi. */
export async function enableWebPush(panel: Panel = panelOfRole()): Promise<NotificationPermission> {
  if (!isWebPushSupported()) return 'denied';
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission === 'granted') await registerWebPush(panel);
  return permission;
}
