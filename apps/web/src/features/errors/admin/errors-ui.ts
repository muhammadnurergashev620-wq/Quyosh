import type { ErrorKind } from '../types';
import { t } from '@/i18n';

export const KIND_LABEL: Record<ErrorKind, string> = {
  HTTP: t('Server so‘rovi'),
  UNHANDLED: t('Ushlanmagan xato'),
  UI_CRASH: t('Interfeys qulashi'),
  UI_ERROR: t('Interfeys xatosi'),
  API_ERROR: t('API xabari'),
  NETWORK: t('Tarmoq xatosi'),
};
export const PANEL_LABEL: Record<string, string> = { CUSTOMER: t('Mijoz'), SHOP: t('Do‘kon'), ADMIN: t('Admin') };
export const PLATFORM_LABEL: Record<string, string> = { web: t('Veb sayt'), android: 'Android', ios: 'iOS' };

const STATUS_LABEL: Record<number, string> = {
  400: t('Noto‘g‘ri so‘rov'),
  401: t('Avtorizatsiya'),
  402: t('To‘lov talab qilinadi'),
  403: t('Ruxsat yo‘q'),
  404: t('Topilmadi'),
  405: t('Metod ruxsat etilmagan'),
  408: t('So‘rov vaqti tugadi'),
  409: t('Ziddiyat'),
  410: t('Mavjud emas'),
  413: t('Fayl juda katta'),
  415: t('Format qo‘llanmaydi'),
  422: t('Ma’lumot yaroqsiz'),
  423: t('Bloklangan'),
  429: t('Juda ko‘p so‘rov'),
  500: t('Server xatosi'),
  501: t('Amalga oshirilmagan'),
  502: t('Shlyuz xatosi'),
  503: t('Xizmat mavjud emas'),
  504: t('Shlyuz vaqti tugadi'),
};

export function statusName(status: number | null, kind?: ErrorKind): string {
  if (!status) return kind ? KIND_LABEL[kind] : t('Tarmoq / interfeys');
  return STATUS_LABEL[status] ?? (status >= 500 ? t('Server xatosi') : t('Mijoz xatosi'));
}

/** Endpoint yoki sahifa: «POST /payments» ko‘rinishida. */
export function whereOf(item: { method: string | null; path: string | null; pageUrl: string | null }): string {
  if (item.path) return `${item.method ? `${item.method} ` : ''}${item.path.replace(/^\/api\/v1/, '')}`;
  return item.pageUrl ?? '—';
}
