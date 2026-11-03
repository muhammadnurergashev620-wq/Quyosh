import type { BadgeTone } from '@/components/ui/Badge';
import { t } from '@/i18n';
import type { InstallationStatus, PipelineStage, QuoteRequestStatus, QuoteStatus, RequestShopStatus } from './types';

type Label = { label: string; tone: BadgeTone };

export const REQUEST_STATUS: Record<QuoteRequestStatus, Label> = {
  OPEN: { label: t('Ochiq'), tone: 'primary' },
  CLOSED_SELECTED: { label: t('Do‘kon tanlandi'), tone: 'success' },
  CLOSED_NO_SELECTION: { label: t('Yopilgan'), tone: 'neutral' },
  EXPIRED: { label: t('Muddati o‘tgan'), tone: 'neutral' },
  CANCELLED: { label: t('Bekor qilingan'), tone: 'neutral' },
};

/** Mijoz ko‘rinishi: do‘kon javobi holati. */
export const SHOP_REPLY_STATUS: Record<RequestShopStatus, Label> = {
  SENT: { label: t('Yuborildi'), tone: 'neutral' },
  VIEWED: { label: t('Ko‘rildi'), tone: 'primary' },
  CLARIFICATION_REQUESTED: { label: t('Savol berdi'), tone: 'warning' },
  QUOTED: { label: t('Taklif yubordi'), tone: 'success' },
  DECLINED: { label: t('Rad etdi'), tone: 'danger' },
  SELECTED: { label: t('Tanlandi'), tone: 'success' },
  NOT_SELECTED: { label: t('Tanlanmadi'), tone: 'neutral' },
};

/** Do‘kon inbox ko‘rinishi. */
export const LEAD_STATUS: Record<RequestShopStatus, Label> = {
  SENT: { label: t('Yangi'), tone: 'primary' },
  VIEWED: { label: t('Ko‘rilgan'), tone: 'neutral' },
  CLARIFICATION_REQUESTED: { label: t('Javob kutilmoqda'), tone: 'warning' },
  QUOTED: { label: t('Taklif yuborilgan'), tone: 'success' },
  DECLINED: { label: t('Rad etilgan'), tone: 'neutral' },
  SELECTED: { label: t('Tanlandi'), tone: 'success' },
  NOT_SELECTED: { label: t('Tanlanmadi'), tone: 'neutral' },
};

export const PIPELINE: Record<PipelineStage, string> = {
  NEW: t('Yangi'),
  CONTACTED: t('Bog‘lanildi'),
  SITE_VISIT: t('O‘lchov'),
  PROPOSAL: t('Taklif'),
  WON: t('Yutildi'),
  LOST: t('Yutqazildi'),
};

export const QUOTE_STATUS: Record<QuoteStatus, Label> = {
  DRAFT: { label: t('Qoralama'), tone: 'neutral' },
  SENT: { label: t('Yuborilgan'), tone: 'primary' },
  VIEWED: { label: t('Ko‘rilgan'), tone: 'primary' },
  ACCEPTED: { label: t('Tanlangan'), tone: 'success' },
  REJECTED: { label: t('Rad etilgan'), tone: 'neutral' },
  EXPIRED: { label: t('Muddati o‘tgan'), tone: 'warning' },
  WITHDRAWN: { label: t('Qaytarib olingan'), tone: 'neutral' },
};

export const INSTALLATION_STATUS: Record<InstallationStatus, Label> = {
  AGREED: { label: t('Kelishildi'), tone: 'primary' },
  SITE_VISIT_SCHEDULED: { label: t('O‘lchov belgilandi'), tone: 'primary' },
  INSTALLATION_SCHEDULED: { label: t('Montaj sanasi belgilandi'), tone: 'primary' },
  INSTALLED: { label: t('Montaj bajarildi'), tone: 'warning' },
  CONFIRMED: { label: t('Qabul qilindi'), tone: 'success' },
  DISPUTED: { label: t('E’tiroz'), tone: 'danger' },
  CANCELLED: { label: t('Bekor qilindi'), tone: 'neutral' },
};

/** U9.8 timeline bosqichlari. */
export const TIMELINE: Array<{ status: InstallationStatus; label: string }> = [
  { status: 'AGREED', label: t('Kelishildi') },
  { status: 'SITE_VISIT_SCHEDULED', label: t('O‘lchov') },
  { status: 'INSTALLATION_SCHEDULED', label: t('Montaj sanasi') },
  { status: 'INSTALLED', label: t('Montaj bajarildi') },
  { status: 'CONFIRMED', label: t('Qabul qilindi') },
];

export const BADGE_TEXT: Record<string, string> = {
  CHEAPEST_PER_KW: t('Eng arzon (1 kVt uchun)'),
  LONGEST_WARRANTY: t('Eng uzoq kafolat'),
  FASTEST_INSTALL: t('Eng tez montaj'),
};

export const ITEM_TYPE: Record<string, string> = {
  EQUIPMENT: t('Uskuna'),
  INSTALLATION: t('Montaj'),
  DELIVERY: t('Yetkazish'),
  OTHER: t('Boshqa'),
};

export const DECLINE_PRESETS = [t('Hududimizdan tashqarida'), t('Hozir band — qabul qila olmaymiz'), t('Bunday tizim bilan ishlamaymiz')];

export const num = (v: unknown) => Number(v ?? 0);
export const months = (n: number | null | undefined) => (n == null ? '—' : t('{n} oy', { n }));
export const days = (n: number | null | undefined) => (n == null ? '—' : t('{n} kun', { n }));
export const responseTime = (minutes: number | null | undefined) =>
  minutes == null ? null : minutes < 60 ? t('~{n} daqiqada javob beradi', { n: minutes }) : minutes < 1440 ? t('~{n} soatda javob beradi', { n: Math.round(minutes / 60) }) : t('~{n} kunda javob beradi', { n: Math.round(minutes / 1440) });
