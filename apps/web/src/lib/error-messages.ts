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
  phone: t('Telefon raqami'),
  email: t('Email'),
  login: t('Login'),
  password: t('Parol'),
  newPassword: t('Yangi parol'),
  code: t('Kod'),
  name: t('Nomi'),
  title: t('Sarlavha'),
  description: t('Tavsif'),
  comment: t('Izoh'),
  note: t('Izoh'),
  notes: t('Izoh'),
  rating: t('Baho'),
  reason: t('Sabab'),
  message: t('Xabar'),
  text: t('Matn'),
  subject: t('Mavzu'),
  stir: t('STIR'),
  address: t('Manzil'),
  regionCode: t('Viloyat'),
  districtCode: t('Tuman'),
  lat: t('Kenglik'),
  lon: t('Uzunlik'),
  areaM2: t('Maydon'),
  tiltDeg: t('Qiyalik'),
  azimuthDeg: t('Yo‘nalish (azimut)'),
  monthlyKwh: t('Oylik iste’mol'),
  billAmount: t('Oylik to‘lov'),
  systemType: t('Tizim turi'),
  shopIds: t('Do‘konlar'),
  price: t('Narx'),
  unitPrice: t('Birlik narxi'),
  quantity: t('Miqdor'),
  initialCost: t('Tizim narxi'),
  downPayment: t('Boshlang‘ich to‘lov'),
  annualRate: t('Yillik stavka'),
  termMonths: t('Muddat (oy)'),
  budget: t('Byudjet'),
  validUntil: t('Amal qilish muddati'),
  durationDays: t('Montaj muddati (kun)'),
  warrantyEquipmentMonths: t('Uskuna kafolati (oy)'),
  warrantyInstallationMonths: t('Montaj kafolati (oy)'),
  includedScope: t('Narxga kiradi'),
  excludedScope: t('Narxga kirmaydi'),
  ownerLogin: t('Egasining logini'),
  ownerFirstName: t('Egasining ismi'),
  ownerPhone: t('Egasining telefoni'),
  categoryId: t('Kategoriya'),
  mediaAssetId: t('Fayl'),
  expiresAt: t('Amal qilish muddati'),
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
