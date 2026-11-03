import { ApiError } from '@/types/api';
import { t } from '@/i18n';

const CODE_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: t('Internet aloqasi yo‘q yoki server javob bermayapti.'),
  UNAUTHORIZED: t('Telefon raqami yoki parol noto‘g‘ri.'),
};

/** Server tekshiruv xatolaridagi maydon nomlari («experienceYears: …») foydalanuvchi tilida. */
const FIELD_LABELS: Record<string, string> = {
  firstName: t('Ism'),
  lastName: t('Familiya'),
  profession: t('Kasb'),
  workPlace: t('Ish joyi'),
  bio: t('O‘zingiz haqingizda'),
  experienceYears: t('Tajriba (yil)'),
  workRadiusKm: t('Ish radiusi (km)'),
  serviceAreas: t('Ish hududlari'),
  latitude: t('Kenglik'),
  longitude: t('Uzunlik'),
  phone: t('Telefon raqami'),
  password: t('Parol'),
  email: t('Email'),
  code: t('Kod'),
  title: t('Sarlavha'),
  description: t('Tavsif'),
  comment: t('Izoh'),
  rating: t('Baho'),
  reason: t('Sabab'),
  message: t('Xabar'),
  text: t('Matn'),
  subject: t('Mavzu'),
  note: t('Izoh'),
  price: t('Narx'),
  amount: t('Summa'),
  basePrice: t('Narx'),
  estimatedMinutes: t('Davomiylik (daqiqa)'),
  addressLine: t('Manzil'),
  city: t('Shahar'),
  district: t('Tuman'),
  name: t('Nomi'),
  language: t('Til'),
  currency: t('Valyuta'),
  paymentMethod: t('To‘lov usuli'),
  preferredStartAt: t('Boshlanish vaqti'),
  preferredEndAt: t('Tugash vaqti'),
  scheduledStartAt: t('Vaqt'),
  availableAt: t('Kelish vaqti'),
  expiresAt: t('Amal qilish muddati'),
  startTime: t('Boshlanish vaqti'),
  endTime: t('Tugash vaqti'),
  dayOfWeek: t('Hafta kuni'),
  documentType: t('Hujjat turi'),
  serviceId: t('Xizmat'),
  categoryId: t('Kategoriya'),
  orderId: t('Buyurtma'),
  requestId: t('So‘rov'),
  masterId: t('Usta'),
  mediaAssetId: t('Fayl'),
  beforeMediaAssetId: t('«Oldin» surati'),
  q: t('Qidiruv'),
  limit: t('Soni'),
};

/** «experienceYears: 70 dan katta bo‘lmasligi kerak» → «Tajriba (yil): 70 dan katta bo‘lmasligi kerak». */
function labelDetail(detail: string): string {
  const match = /^([A-Za-z][\w]*)(?:[.[]\w+\]?)*:\s*(.+)$/.exec(detail);
  if (!match) return t(detail);
  const [, field, message] = match as unknown as [string, string, string];
  const label = FIELD_LABELS[field];
  if (!label) return t(detail);
  return `${label}: ${t(message)}`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.sessionExpired) return t('Sessiya muddati tugadi. Iltimos, qayta kiring.');
    if (error.details.length > 0) return error.details.map(labelDetail).join('\n');
    return CODE_MESSAGES[error.code] ?? t(error.message);
  }
  if (error instanceof Error) return error.message;
  return t('Kutilmagan xatolik yuz berdi.');
}
