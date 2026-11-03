import type { BadgeTone } from '@/components/ui/Badge';
import { t } from '@/i18n';

export type AuditGroup =
  | 'auth'
  | 'verification'
  | 'users'
  | 'profile'
  | 'catalog'
  | 'requests'
  | 'offers'
  | 'orderFlow'
  | 'orders'
  | 'payments'
  | 'reviews'
  | 'customer'
  | 'disputes'
  | 'chat'
  | 'other';

export interface AuditActionInfo {
  /** Qisqa sarlavha. */
  label: string;
  /** Aktordan keyin keladigan fe’l: «Admin … hujjatni tasdiqladi». */
  verb: string;
  group: AuditGroup;
  tone: BadgeTone;
}

export const GROUP_INFO: Record<AuditGroup, { label: string; prefix?: string }> = {
  auth: { label: t('Kirish va sessiyalar'), prefix: 'AUTH_' },
  verification: { label: t('Do‘konlarni tasdiqlash'), prefix: 'VERIFICATION_' },
  users: { label: t('Foydalanuvchilar'), prefix: 'ADMIN_USER_' },
  profile: { label: t('Usta faoliyati'), prefix: 'MASTER_' },
  catalog: { label: t('Xizmatlar katalogi'), prefix: 'SERVICE_' },
  requests: { label: t('So‘rovlar'), prefix: 'REQUEST_' },
  offers: { label: t('Takliflar'), prefix: 'OFFER_' },
  orderFlow: { label: t('Buyurtma jarayoni'), prefix: 'ORDER_' },
  orders: { label: t('Admin — buyurtmalar'), prefix: 'ADMIN_ORDER_' },
  payments: { label: t('To‘lovlar'), prefix: 'PAYMENT_' },
  reviews: { label: t('Sharhlar'), prefix: 'REVIEW_' },
  customer: { label: t('Mijoz profili'), prefix: 'CUSTOMER_' },
  disputes: { label: t('Nizo va shikoyatlar'), prefix: 'DISPUTE_' },
  chat: { label: t('Chat moderatsiyasi'), prefix: 'CHAT_' },
  other: { label: t('Boshqa') },
};

export const AUDIT_ACTIONS: Record<string, AuditActionInfo> = {
  AUTH_REGISTERED: { label: t('Ro‘yxatdan o‘tdi'), verb: t('ro‘yxatdan o‘tdi'), group: 'auth', tone: 'primary' },
  AUTH_REGISTRATION_VERIFIED: { label: t('Ro‘yxatdan o‘tish tasdiqlandi'), verb: t('telefon raqamini tasdiqladi'), group: 'auth', tone: 'success' },
  AUTH_LOGIN_COMPLETED: { label: t('Tizimga kirdi'), verb: t('tizimga kirdi'), group: 'auth', tone: 'success' },
  AUTH_LOGOUT: { label: t('Tizimdan chiqdi'), verb: t('tizimdan chiqdi'), group: 'auth', tone: 'neutral' },
  AUTH_LOGOUT_ALL: { label: t('Barcha qurilmalardan chiqdi'), verb: t('barcha qurilmalardan chiqdi'), group: 'auth', tone: 'warning' },
  AUTH_REFRESH_ROTATED: { label: t('Sessiya yangilandi'), verb: t('sessiyasini yangiladi'), group: 'auth', tone: 'neutral' },
  AUTH_SESSION_REVOKED: { label: t('Qurilma sessiyasi tugatildi'), verb: t('qurilma sessiyasini tugatdi'), group: 'auth', tone: 'warning' },
  AUTH_OTHER_SESSIONS_REVOKED: { label: t('Boshqa qurilmalar chiqarildi'), verb: t('boshqa qurilmalarini tizimdan chiqardi'), group: 'auth', tone: 'warning' },

  VERIFICATION_SUBMITTED: { label: t('Hujjat yuborildi'), verb: t('tasdiqlash uchun hujjat yubordi'), group: 'verification', tone: 'primary' },
  VERIFICATION_START_REVIEW: { label: t('Ko‘rib chiqish boshlandi'), verb: t('hujjatni ko‘rib chiqishni boshladi'), group: 'verification', tone: 'primary' },
  VERIFICATION_APPROVE: { label: t('Hujjat tasdiqlandi'), verb: t('hujjatni tasdiqladi'), group: 'verification', tone: 'success' },
  VERIFICATION_REJECT: { label: t('Hujjat rad etildi'), verb: t('hujjatni rad etdi'), group: 'verification', tone: 'danger' },
  VERIFICATION_REQUEST_CORRECTION: { label: t('Tuzatish so‘raldi'), verb: t('hujjatni tuzatishni so‘radi'), group: 'verification', tone: 'warning' },
  VERIFICATION_DELETED: { label: t('Hujjat o‘chirildi'), verb: t('hujjatni o‘chirdi'), group: 'verification', tone: 'danger' },

  ADMIN_USER_SUSPENDED: { label: t('Foydalanuvchi to‘xtatildi'), verb: t('foydalanuvchini to‘xtatdi'), group: 'users', tone: 'warning' },
  ADMIN_USER_REACTIVATED: { label: t('Foydalanuvchi qayta faollashtirildi'), verb: t('foydalanuvchini qayta faollashtirdi'), group: 'users', tone: 'success' },
  ADMIN_USER_PASSWORD_VIEWED: { label: t('Parol ko‘rilgan (eski yozuv)'), verb: t('foydalanuvchi parolini ko‘rgan (bu imkoniyat bekor qilingan)'), group: 'users', tone: 'warning' },
  AUTH_REGISTER_DUPLICATE_ATTEMPT: { label: t('Takroriy ro‘yxatdan o‘tish urinishi'), verb: t('mavjud raqam/email bilan ro‘yxatdan o‘tmoqchi bo‘ldi'), group: 'users', tone: 'warning' },
  ADMIN_USER_PASSWORD_RESET: { label: t('Parol o‘zgartirildi'), verb: t('foydalanuvchi parolini o‘zgartirdi'), group: 'users', tone: 'warning' },
  ADMIN_ADMIN_CREATED: { label: t('Admin yaratildi'), verb: t('yangi admin yaratdi'), group: 'users', tone: 'success' },
  ADMIN_PERMISSIONS_CHANGED: { label: t('Admin huquqlari o‘zgardi'), verb: t('admin huquqlarini o‘zgartirdi'), group: 'users', tone: 'primary' },
  ADMIN_SUPERADMIN_GRANTED: { label: t('Superadmin qilindi'), verb: t('superadmin huquqini berdi'), group: 'users', tone: 'warning' },
  ADMIN_SUPERADMIN_REVOKED: { label: t('Superadminlik olib tashlandi'), verb: t('superadmin huquqini oldi'), group: 'users', tone: 'warning' },
  ADMIN_TWO_FACTOR_ENABLED: { label: t('Kirish kodi yoqildi'), verb: t('kirishdagi tasdiqlash kodini yoqdi'), group: 'users', tone: 'success' },
  ADMIN_TWO_FACTOR_DISABLED: { label: t('Kirish kodi o‘chirildi'), verb: t('kirishdagi tasdiqlash kodini o‘chirdi'), group: 'users', tone: 'warning' },
  ADMIN_USER_DELETED: { label: t('Foydalanuvchi o‘chirildi'), verb: t('foydalanuvchini o‘chirdi'), group: 'users', tone: 'danger' },
  ADMIN_REGISTRATION_BLOCKED: { label: t('Qayta ro‘yxatdan o‘tish bloklandi'), verb: t('qayta ro‘yxatdan o‘tishni blokladi'), group: 'users', tone: 'danger' },
  ADMIN_REGISTRATION_ALLOWED: { label: t('Qayta ro‘yxatdan o‘tishga ruxsat berildi'), verb: t('qayta ro‘yxatdan o‘tishga ruxsat berdi'), group: 'users', tone: 'success' },
  USER_ACTION_CREATED: { label: t('Choralar qo‘llandi'), verb: t('foydalanuvchiga chora qo‘lladi'), group: 'users', tone: 'warning' },

  MASTER_PROFILE_CREATED: { label: t('Usta profili yaratildi'), verb: t('usta profilini yaratdi'), group: 'profile', tone: 'primary' },
  MASTER_PROFILE_UPDATED: { label: t('Usta profili yangilandi'), verb: t('usta profilini yangiladi'), group: 'profile', tone: 'neutral' },
  MASTER_STATUS_CHANGED: { label: t('Usta holati o‘zgardi'), verb: t('profil holatini o‘zgartirdi'), group: 'profile', tone: 'neutral' },
  MASTER_PAUSED: { label: t('Usta pauza qo‘ydi'), verb: t('qabul qilishni pauza qildi'), group: 'profile', tone: 'warning' },
  MASTER_RESUMED: { label: t('Usta pauzadan chiqdi'), verb: t('pauzadan chiqdi'), group: 'profile', tone: 'success' },
  MASTER_PORTFOLIO_CREATED: { label: t('Portfolio ishi qo‘shildi'), verb: t('portfoliosiga yangi ish qo‘shdi'), group: 'profile', tone: 'primary' },
  MASTER_PORTFOLIO_UPDATED: { label: t('Portfolio ishi yangilandi'), verb: t('portfolio ishini yangiladi'), group: 'profile', tone: 'neutral' },
  MASTER_PORTFOLIO_REMOVED: { label: t('Portfolio ishi o‘chirildi'), verb: t('portfolio ishini o‘chirdi'), group: 'profile', tone: 'warning' },
  ADMIN_PORTFOLIO_APPROVED: { label: t('Portfolio tasdiqlandi'), verb: t('portfolio ishini tasdiqladi'), group: 'profile', tone: 'success' },
  ADMIN_PORTFOLIO_REJECTED: { label: t('Portfolio rad etildi'), verb: t('portfolio ishini rad etdi'), group: 'profile', tone: 'danger' },

  REQUEST_CREATED: { label: t('So‘rov yaratildi'), verb: t('yangi so‘rov yaratdi'), group: 'requests', tone: 'primary' },
  REQUEST_UPDATED: { label: t('So‘rov yangilandi'), verb: t('so‘rovni yangiladi'), group: 'requests', tone: 'neutral' },
  REQUEST_SUBMITTED: { label: t('So‘rov yuborildi'), verb: t('so‘rovni ustalarga yubordi'), group: 'requests', tone: 'primary' },
  REQUEST_CANCELLED: { label: t('So‘rov bekor qilindi'), verb: t('so‘rovni bekor qildi'), group: 'requests', tone: 'danger' },

  OFFER_CREATED: { label: t('Taklif berildi'), verb: t('so‘rovga taklif berdi'), group: 'offers', tone: 'primary' },
  OFFER_WITHDRAWN: { label: t('Taklif qaytarib olindi'), verb: t('taklifini qaytarib oldi'), group: 'offers', tone: 'warning' },
  OFFER_ACCEPTED: { label: t('Taklif qabul qilindi'), verb: t('taklifni qabul qildi'), group: 'offers', tone: 'success' },

  ORDER_CONFIRMED: { label: t('Buyurtma tasdiqlandi'), verb: t('buyurtmani tasdiqladi'), group: 'orderFlow', tone: 'primary' },
  ORDER_ON_THE_WAY: { label: t('Usta yo‘lga chiqdi'), verb: t('ish joyiga yo‘lga chiqdi'), group: 'orderFlow', tone: 'primary' },
  ORDER_ARRIVED: { label: t('Usta yetib keldi'), verb: t('ish joyiga yetib keldi'), group: 'orderFlow', tone: 'primary' },
  ORDER_IN_PROGRESS: { label: t('Ish boshlandi'), verb: t('ishni boshladi'), group: 'orderFlow', tone: 'primary' },
  ORDER_WAITING_CONFIRMATION: { label: t('Tasdiq kutilmoqda'), verb: t('ish yakunini tasdiqlash uchun yubordi'), group: 'orderFlow', tone: 'warning' },
  ORDER_COMPLETED: { label: t('Buyurtma yakunlandi'), verb: t('buyurtmani yakunladi'), group: 'orderFlow', tone: 'success' },
  ORDER_CANCELLED: { label: t('Buyurtma bekor qilindi'), verb: t('buyurtmani bekor qildi'), group: 'orderFlow', tone: 'danger' },
  ORDER_DISPUTED: { label: t('Buyurtma bo‘yicha nizo ochildi'), verb: t('buyurtma bo‘yicha nizo ochdi'), group: 'orderFlow', tone: 'danger' },
  ORDER_RESCHEDULE_PROPOSED: { label: t('Yangi vaqt taklif qilindi'), verb: t('buyurtma vaqtini o‘zgartirishni taklif qildi'), group: 'orderFlow', tone: 'neutral' },
  ORDER_RESCHEDULE_ACCEPTED: { label: t('Yangi vaqt tasdiqlandi'), verb: t('yangi vaqtni tasdiqladi'), group: 'orderFlow', tone: 'success' },
  ORDER_RESCHEDULE_DECLINED: { label: t('Yangi vaqt rad etildi'), verb: t('taklif qilingan vaqtni rad etdi'), group: 'orderFlow', tone: 'warning' },

  ADMIN_ORDER_CANCELLED: { label: t('Buyurtma bekor qilindi'), verb: t('buyurtmani bekor qildi'), group: 'orders', tone: 'danger' },
  ADMIN_ORDER_COMPLETED: { label: t('Nizoli buyurtma yakunlandi'), verb: t('nizoli buyurtmani yakunladi'), group: 'orders', tone: 'success' },

  SERVICE_CATEGORY_CREATED: { label: t('Kategoriya yaratildi'), verb: t('xizmat kategoriyasini yaratdi'), group: 'catalog', tone: 'primary' },
  SERVICE_CREATED: { label: t('Xizmat yaratildi'), verb: t('yangi xizmat qo‘shdi'), group: 'catalog', tone: 'primary' },
  SERVICE_UPDATED: { label: t('Xizmat yangilandi'), verb: t('xizmatni yangiladi'), group: 'catalog', tone: 'neutral' },
  SERVICE_DEACTIVATED: { label: t('Xizmat o‘chirildi'), verb: t('xizmatni faolsizlantirdi'), group: 'catalog', tone: 'warning' },

  DISPUTE_STATUS_CHANGED: { label: t('Nizo holati o‘zgardi'), verb: t('nizo holatini o‘zgartirdi'), group: 'disputes', tone: 'warning' },
  COMPLAINT_STATUS_CHANGED: { label: t('Shikoyat holati o‘zgardi'), verb: t('shikoyat holatini o‘zgartirdi'), group: 'disputes', tone: 'warning' },
  APPEAL_CREATED: { label: t('Apellyatsiya yuborildi'), verb: t('apellyatsiya yubordi'), group: 'disputes', tone: 'primary' },
  APPEAL_UPDATED: { label: t('Apellyatsiya yangilandi'), verb: t('apellyatsiyani ko‘rib chiqdi'), group: 'disputes', tone: 'warning' },
  WARRANTY_CREATED: { label: t('Kafolat ochildi'), verb: t('buyurtmaga kafolat ochdi'), group: 'disputes', tone: 'primary' },
  WARRANTY_CLAIM_CREATED: { label: t('Kafolat da’vosi yuborildi'), verb: t('kafolat bo‘yicha da’vo yubordi'), group: 'disputes', tone: 'primary' },
  WARRANTY_CLAIM_UPDATED: { label: t('Kafolat da’vosi yangilandi'), verb: t('kafolat da’vosini yangiladi'), group: 'disputes', tone: 'warning' },
  COMPENSATION_CREATED: { label: t('Kompensatsiya berildi'), verb: t('kompensatsiya ajratdi'), group: 'disputes', tone: 'success' },

  CHAT_MESSAGE_EDITED: { label: t('Xabar tahrirlandi'), verb: t('chatdagi xabarni tahrir qildi'), group: 'chat', tone: 'warning' },
  CHAT_MESSAGE_DELETED: { label: t('Xabar o‘chirildi'), verb: t('chatdagi xabarni o‘chirdi'), group: 'chat', tone: 'danger' },

  PAYMENT_CASH_CONFIRMED: { label: t('Naqd to‘lov tasdiqlandi'), verb: t('naqd to‘lovni tasdiqladi'), group: 'payments', tone: 'success' },
  PAYMENT_REFUNDED: { label: t('To‘lov qaytarildi'), verb: t('to‘lovni qaytardi'), group: 'payments', tone: 'warning' },
  PAYMENT_REFUNDED_AMOUNT_RECONCILED: { label: t('Qaytarilgan summa tekshirildi'), verb: t('qaytarilgan summani to‘lovlar jurnali bilan solishtirib to‘g‘rilab qo‘ydi'), group: 'payments', tone: 'warning' },
  PAYMENT_WEBHOOK_MISMATCH: { label: t('To‘lov webhook’i mos kelmadi'), verb: t('to‘lov webhook’i mos kelmadi'), group: 'payments', tone: 'danger' },

  REVIEW_CREATED: { label: t('Sharh qoldirildi'), verb: t('ustaga sharh qoldirdi'), group: 'reviews', tone: 'primary' },

  CUSTOMER_PROFILE_UPDATED: { label: t('Mijoz profili yangilandi'), verb: t('profilini yangiladi'), group: 'customer', tone: 'neutral' },
  CUSTOMER_ADDRESS_CREATED: { label: t('Manzil qo‘shildi'), verb: t('yangi manzil qo‘shdi'), group: 'customer', tone: 'primary' },
  CUSTOMER_ADDRESS_UPDATED: { label: t('Manzil yangilandi'), verb: t('manzilni yangiladi'), group: 'customer', tone: 'neutral' },
  CUSTOMER_ADDRESS_REMOVED: { label: t('Manzil o‘chirildi'), verb: t('manzilni o‘chirdi'), group: 'customer', tone: 'warning' },

  ADMIN_CHAT_REPLY_ALLOWED: { label: t('Javob yozishga ruxsat berildi'), verb: t('foydalanuvchiga yordam suhbatida javob yozishga ruxsat berdi'), group: 'chat', tone: 'primary' },
  ADMIN_CHAT_REPLY_DENIED: { label: t('Javob yozish taqiqlandi'), verb: t('foydalanuvchining javob yozishini taqiqladi'), group: 'chat', tone: 'warning' },
  ADMIN_DELEGATION_CHANGED: { label: t('Admin yaratish vakolati o‘zgardi'), verb: t('adminning yangi admin yaratish vakolatini o‘zgartirdi'), group: 'users', tone: 'warning' },
  ADMIN_AVATAR_PERMISSION_CHANGED: { label: t('Rasm qo‘yish ruxsati o‘zgardi'), verb: t('adminning profil rasmi qo‘yish ruxsatini o‘zgartirdi'), group: 'users', tone: 'neutral' },
  ADMIN_USER_AVATAR_SET: { label: t('Profil rasmi qo‘yildi'), verb: t('foydalanuvchiga profil rasmi qo‘ydi'), group: 'users', tone: 'primary' },
  ADMIN_USER_AVATAR_REMOVED: { label: t('Profil rasmi olib tashlandi'), verb: t('foydalanuvchining profil rasmini olib tashladi'), group: 'users', tone: 'warning' },
  AUTH_GOOGLE_LINKED: { label: t('Google ulandi'), verb: t('akkauntiga Google’ni ulashdi'), group: 'auth', tone: 'primary' },
  AUTH_GOOGLE_UNLINKED: { label: t('Google uzildi'), verb: t('akkauntidan Google’ni uzdi'), group: 'auth', tone: 'warning' },
  USER_EMAIL_CHANGED: { label: t('Email o‘zgartirildi'), verb: t('email manzilini o‘zgartirdi'), group: 'auth', tone: 'neutral' },
  USER_PASSWORD_CHANGED: { label: t('Parol almashtirildi'), verb: t('parolini almashtirdi'), group: 'auth', tone: 'warning' },
  USER_PASSWORD_SET: { label: t('Parol o‘rnatildi'), verb: t('parol o‘rnatdi'), group: 'auth', tone: 'warning' },
  USER_PHONE_VERIFIED: { label: t('Telefon tasdiqlandi'), verb: t('telefon raqamini tasdiqladi'), group: 'auth', tone: 'success' },
  USER_TWO_FACTOR_ENABLED: { label: t('Ikki bosqichli himoya yoqildi'), verb: t('ikki bosqichli himoyani yoqdi'), group: 'auth', tone: 'success' },
  USER_TWO_FACTOR_DISABLED: { label: t('Ikki bosqichli himoya o‘chirildi'), verb: t('ikki bosqichli himoyani o‘chirdi'), group: 'auth', tone: 'warning' },
  USER_SELF_DELETED: { label: t('Akkaunt o‘chirildi'), verb: t('o‘z akkauntini o‘chirdi'), group: 'auth', tone: 'danger' },
  USER_ACTION_LIFTED: { label: t('Chora bekor qilindi'), verb: t('foydalanuvchidan chorani olib tashladi'), group: 'users', tone: 'success' },
  SERVICE_CATEGORY_UPDATED: { label: t('Kategoriya yangilandi'), verb: t('xizmat kategoriyasini yangiladi'), group: 'catalog', tone: 'neutral' },
  SERVICE_CATEGORY_DEACTIVATED: { label: t('Kategoriya o‘chirildi'), verb: t('xizmat kategoriyasini faolsizlantirdi'), group: 'catalog', tone: 'warning' },
  WORK_POST_CREATED: { label: t('Ish lentasiga e’lon qo‘shildi'), verb: t('ish lentasiga e’lon qo‘shdi'), group: 'profile', tone: 'primary' },
  WORK_POST_REMOVED: { label: t('Ish lentasidagi e’lon o‘chirildi'), verb: t('ish lentasidagi e’lonni o‘chirdi'), group: 'profile', tone: 'warning' },
};

const humanize = (code: string) => {
  const text = code.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function actionInfo(action: string): AuditActionInfo {
  return AUDIT_ACTIONS[action] ?? { label: humanize(action), verb: humanize(action).toLowerCase(), group: 'other', tone: 'neutral' };
}

export const TARGET_LABEL: Record<string, string> = {
  User: t('Foydalanuvchi'),
  MasterVerification: t('Tasdiqlash hujjati'),
  MasterProfile: t('Usta profili'),
  MasterPortfolio: t('Portfolio ishi'),
  DeviceSession: t('Qurilma sessiyasi'),
  Service: t('Xizmat'),
  ServiceCategory: t('Xizmat kategoriyasi'),
  Case: t('Nizo / shikoyat'),
  Message: t('Chat xabari'),
  Order: t('Buyurtma'),
  Payment: t('To‘lov'),
  ProblemRequest: t('So‘rov'),
  Offer: t('Taklif'),
  Address: t('Manzil'),
  Review: t('Sharh'),
  Warranty: t('Kafolat'),
  WarrantyClaim: t('Kafolat da’vosi'),
  Appeal: t('Apellyatsiya'),
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: t('Kutilmoqda'),
  UNDER_REVIEW: t('Ko‘rib chiqilmoqda'),
  VERIFIED: t('Tasdiqlangan'),
  APPROVED: t('Tasdiqlangan'),
  REJECTED: t('Rad etilgan'),
  NEEDS_CORRECTION: t('Tuzatish kerak'),
  CORRECTION_REQUESTED: t('Tuzatish kerak'),
  ACTIVE: t('Faol'),
  INACTIVE: t('Faol emas'),
  SUSPENDED: t('To‘xtatilgan'),
  DELETED: t('O‘chirilgan'),
  OPEN: t('Ochiq'),
  IN_REVIEW: t('Ko‘rib chiqilmoqda'),
  RESOLVED: t('Hal qilingan'),
  CLOSED: t('Yopilgan'),
  ESCALATED: t('Yuqoriga uzatilgan'),
};

export const DOCUMENT_LABEL: Record<string, string> = {
  IDENTITY: t('Shaxsni tasdiqlovchi hujjat'),
  LICENSE: t('Litsenziya'),
  CERTIFICATE: t('Sertifikat'),
  PASSPORT: t('Pasport'),
};

export const FIELD_LABEL: Record<string, string> = {
  avatar: t('Profil rasmi'),
  adminAvatarAllowed: t('Rasm qo‘yish ruxsati'),
  status: t('Holat'),
  documentType: t('Hujjat turi'),
  reason: t('Sabab'),
  role: t('Rol'),
  name: t('Nomi'),
  isActive: t('Faolligi'),
};

export function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ha' : t('Yo‘q');
  if (typeof value === 'string') {
    if (key === 'status' || key.toLowerCase().endsWith('status')) return STATUS_LABEL[value] ?? humanize(value);
    if (key === 'documentType') return DOCUMENT_LABEL[value] ?? humanize(value);
    return value;
  }
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}
