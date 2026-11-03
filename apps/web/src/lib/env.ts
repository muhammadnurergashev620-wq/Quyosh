import type { Role } from '@/types/common';

const ROLES: readonly Role[] = ['CUSTOMER', 'SHOP', 'ADMIN'];
const configuredRole = import.meta.env.VITE_APP_ROLE as string | undefined;

/** Dev: sayt boshqa qurilmadan yoki tunnel orqali ochilsa, «localhost» API manzili o‘rniga bir xil origin (/api/v1, Vite proxy) ishlatiladi. */
function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
  if (typeof window === 'undefined') return configured;
  const { hostname, protocol } = window.location;
  if (!/^https?:$/.test(protocol) || hostname === 'localhost' || hostname === '127.0.0.1') return configured;
  return /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(configured) ? '/api/v1' : configured;
}

/** Asosiy sayt (quyosh.uz) yo‘naltiradigan panellar manzili. Bir domenda: quyosh.uz/mijoz va quyosh.uz/dokon. Dev'da ildizdagi .env ichida VITE_DEV_CUSTOMER_URL / VITE_DEV_SHOP_URL beriladi (productionga ta’sir qilmaydi). */
const devOnly = (value: unknown) => (import.meta.env.DEV ? (value as string | undefined) : undefined);
const customerUrl = devOnly(import.meta.env.VITE_DEV_CUSTOMER_URL) || (import.meta.env.VITE_CUSTOMER_URL as string | undefined) || '/mijoz';
const shopUrl = devOnly(import.meta.env.VITE_DEV_SHOP_URL) || (import.meta.env.VITE_SHOP_URL as string | undefined) || '/dokon';

export const env = {
  customerUrl,
  shopUrl,
  apiBaseUrl: resolveApiBaseUrl(),
  /** Google profilidan telefonni ham so‘rash (Google Cloud'da People API va user.phonenumbers.read ruxsati sozlangan bo‘lsa). */
  googlePhone: import.meta.env.VITE_GOOGLE_PHONE === '1',
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '',
  /** Aloqa ma’lumotlari (ixtiyoriy): faqat berilganlari «Savollar» sahifasida ko‘rsatiladi. */
  support: {
    telegram: (import.meta.env.VITE_SUPPORT_TELEGRAM as string | undefined)?.replace(/^@/, '') ?? '',
    phone: (import.meta.env.VITE_SUPPORT_PHONE as string | undefined) ?? '',
    email: (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? '',
  },
  /** Brauzer push (Firebase veb-ilova). Hammasi berilgan bo‘lsagina yoqiladi. */
  firebase: {
    apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ?? '',
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ?? '',
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? '',
    storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ?? '',
    messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ?? '',
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ?? '',
    vapidKey: (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) ?? '',
  },
  appRole: ROLES.find((role) => role === configuredRole) ?? null,
} as const;
