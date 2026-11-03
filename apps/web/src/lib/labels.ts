import { t } from '@/i18n';
export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: t('Faol'),
  PENDING: t('Kutilmoqda'),
  BLOCKED: t('Bloklangan'),
  SUSPENDED: t('To‘xtatilgan'),
  DELETED: t('O‘chirilgan'),
  INACTIVE: t('Nofaol'),
  BUSY: t('Band'),
  RESTRICTED: t('Cheklangan'),
  UNDER_REVIEW: t('Ko‘rib chiqilmoqda'),
  CORRECTION_REQUESTED: t('Tuzatish so‘ralgan'),
  VERIFIED: t('Tasdiqlangan'),
  REJECTED: t('Rad etilgan'),
  EXPIRED: t('Muddati tugagan'),
  DRAFT: t('Qoralama'),
  SUBMITTED: t('Yuborilgan'),
  MATCHING: t('Usta qidirilmoqda'),
  OFFERS_RECEIVED: t('Takliflar keldi'),
  BOOKED: t('Bron qilingan'),
  CONFIRMED: t('Tasdiqlangan'),
  ON_THE_WAY: t('Yo‘lda'),
  ARRIVED: t('Yetib keldi'),
  IN_PROGRESS: t('Jarayonda'),
  WAITING_CONFIRMATION: t('Tasdiq kutilmoqda'),
  COMPLETED: t('Yakunlangan'),
  CANCELLED: t('Bekor qilingan'),
  DISPUTED: t('Nizoda'),
  PROCESSING: t('Jarayonda'),
  SUCCEEDED: t('Muvaffaqiyatli'),
  FAILED: t('Muvaffaqiyatsiz'),
  REFUNDED: t('Qaytarilgan'),
  PARTIALLY_REFUNDED: t('Qisman qaytarilgan'),
  REPORTED: t('Yuborilgan'),
  CONFIRMED_CASE: t('Tasdiqlangan'),
  DISMISSED: t('Rad etilgan'),
  RESOLVED: t('Hal qilingan'),
};

export function statusLabel(code: string): string {
  const label = STATUS_LABELS[code];
  return label ? t(label) : code;
}
