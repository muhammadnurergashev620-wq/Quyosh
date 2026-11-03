import { Capacitor } from '@capacitor/core';
import { apiPost } from '@/services/api.client';

const TOKEN_KEY = 'gm-push-token';

/** Faqat telefon ilovasida (Capacitor) push ishlaydi; oddiy brauzerda hech narsa qilinmaydi. */
export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const readToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export function rememberPushToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* saqlab bo‘lmasa ham push ishlayveradi */
  }
}

/** Qurilma tokenini serverga yuboradi (har ochilganda yangilanadi). */
export function sendPushToken(token: string, panel: 'customer' | 'master' | 'admin', platform: 'android' | 'web' = 'android'): Promise<unknown> {
  rememberPushToken(token);
  return apiPost('/push/tokens', { token, platform, panel });
}

/** Chiqishda tokenni o‘chiradi: boshqa foydalanuvchining xabari shu telefonga kelmasin. Xato bo‘lsa chiqishga xalaqit bermaydi. */
export async function unregisterPushToken(): Promise<void> {
  const token = readToken();
  if (!token) return;
  try {
    await apiPost('/push/tokens/remove', { token });
  } catch {
    /* tarmoq xatosi — token baribir keyingi kirishda yangilanadi */
  }
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* e’tiborsiz */
  }
}
