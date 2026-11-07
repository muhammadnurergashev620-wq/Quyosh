import type { BadgeTone } from '@/components/ui/Badge';
import { t } from '@/i18n';

export type AuditGroup = 'auth' | 'users' | 'admins' | 'shops' | 'catalog' | 'calc' | 'deals' | 'content' | 'support' | 'system';

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
  users: { label: t('Foydalanuvchilar'), prefix: 'USER_' },
  admins: { label: t('Adminlar'), prefix: 'ADMIN_' },
  shops: { label: t('Do‘konlar'), prefix: 'SHOP_' },
  catalog: { label: t('Katalog') },
  calc: { label: t('Kalkulyator va tariflar') },
  deals: { label: t('So‘rov, taklif va montaj') },
  content: { label: t('Kontent') },
  support: { label: t('Yordam') },
  system: { label: t('Tizim') },
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


  ADMIN_USER_REACTIVATED: { label: t('Foydalanuvchi qayta faollashtirildi'), verb: t('foydalanuvchini qayta faollashtirdi'), group: 'users', tone: 'success' },
  AUTH_REGISTER_DUPLICATE_ATTEMPT: { label: t('Takroriy ro‘yxatdan o‘tish urinishi'), verb: t('mavjud raqam/email bilan ro‘yxatdan o‘tmoqchi bo‘ldi'), group: 'users', tone: 'warning' },
  ADMIN_USER_PASSWORD_RESET: { label: t('Parol o‘zgartirildi'), verb: t('foydalanuvchi parolini o‘zgartirdi'), group: 'users', tone: 'warning' },
  ADMIN_ADMIN_CREATED: { label: t('Admin yaratildi'), verb: t('yangi admin yaratdi'), group: 'admins', tone: 'success' },
  ADMIN_PERMISSIONS_CHANGED: { label: t('Admin huquqlari o‘zgardi'), verb: t('admin huquqlarini o‘zgartirdi'), group: 'admins', tone: 'primary' },
  ADMIN_SUPERADMIN_GRANTED: { label: t('Superadmin qilindi'), verb: t('superadmin huquqini berdi'), group: 'admins', tone: 'warning' },
  ADMIN_SUPERADMIN_REVOKED: { label: t('Superadminlik olib tashlandi'), verb: t('superadmin huquqini oldi'), group: 'admins', tone: 'warning' },
  ADMIN_TWO_FACTOR_ENABLED: { label: t('Kirish kodi yoqildi'), verb: t('kirishdagi tasdiqlash kodini yoqdi'), group: 'admins', tone: 'success' },
  ADMIN_TWO_FACTOR_DISABLED: { label: t('Kirish kodi o‘chirildi'), verb: t('kirishdagi tasdiqlash kodini o‘chirdi'), group: 'admins', tone: 'warning' },
  ADMIN_USER_DELETED: { label: t('Foydalanuvchi o‘chirildi'), verb: t('foydalanuvchini o‘chirdi'), group: 'users', tone: 'danger' },
  ADMIN_REGISTRATION_BLOCKED: { label: t('Qayta ro‘yxatdan o‘tish bloklandi'), verb: t('qayta ro‘yxatdan o‘tishni blokladi'), group: 'admins', tone: 'danger' },
  ADMIN_REGISTRATION_ALLOWED: { label: t('Qayta ro‘yxatdan o‘tishga ruxsat berildi'), verb: t('qayta ro‘yxatdan o‘tishga ruxsat berdi'), group: 'admins', tone: 'success' },



  OFFER_CREATED: { label: t('Taklif berildi'), verb: t('so‘rovga taklif berdi'), group: 'catalog', tone: 'primary' },









  ADMIN_DELEGATION_CHANGED: { label: t('Admin yaratish vakolati o‘zgardi'), verb: t('adminning yangi admin yaratish vakolatini o‘zgartirdi'), group: 'admins', tone: 'warning' },
  ADMIN_AVATAR_PERMISSION_CHANGED: { label: t('Rasm qo‘yish ruxsati o‘zgardi'), verb: t('adminning profil rasmi qo‘yish ruxsatini o‘zgartirdi'), group: 'admins', tone: 'neutral' },
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
  SHOP_CREATED: { label: t('Do‘kon yaratildi'), verb: t('do‘kon yaratdi'), group: 'shops', tone: 'primary' },
  SHOP_ACCOUNT_CREATED: { label: t('Do‘kon hisobi yaratildi'), verb: t('do‘kon hisobini yaratdi'), group: 'shops', tone: 'primary' },
  SHOP_PASSWORD_RESET: { label: t('Do‘kon a’zosi paroli tiklandi'), verb: t('do‘kon a’zosi parolini tikladi'), group: 'shops', tone: 'warning' },
  SHOP_MEMBER_ADDED: { label: t('Xodim qo‘shildi'), verb: t('do‘konga xodim qo‘shdi'), group: 'shops', tone: 'primary' },
  SHOP_MEMBER_UPDATED: { label: t('Xodim ruxsatlari o‘zgardi'), verb: t('xodim ruxsatlarini o‘zgartirdi'), group: 'shops', tone: 'neutral' },
  SHOP_MEMBER_REMOVED: { label: t('Xodim chiqarildi'), verb: t('xodimni do‘kondan chiqardi'), group: 'shops', tone: 'warning' },
  SHOP_OWNER_CHANGED: { label: t('Do‘kon egasi almashdi'), verb: t('do‘kon egasini almashtirdi'), group: 'shops', tone: 'warning' },
  SHOP_SUSPENDED: { label: t('Do‘kon to‘xtatildi'), verb: t('do‘konni to‘xtatdi'), group: 'shops', tone: 'danger' },
  SHOP_RESUMED: { label: t('Do‘kon qayta yoqildi'), verb: t('do‘konni qayta yoqdi'), group: 'shops', tone: 'success' },
  SHOP_BADGE_SET: { label: t('Belgi qo‘yildi'), verb: t('do‘konga belgi qo‘ydi'), group: 'shops', tone: 'success' },
  SHOP_BADGE_REMOVED: { label: t('Belgi olib tashlandi'), verb: t('do‘kon belgisini olib tashladi'), group: 'shops', tone: 'warning' },
  SHOP_PROFILE_UPDATED: { label: t('Do‘kon profili yangilandi'), verb: t('do‘kon profilini yangiladi'), group: 'shops', tone: 'neutral' },
  SHOP_BRANCH_CREATED: { label: t('Filial qo‘shildi'), verb: t('filial qo‘shdi'), group: 'shops', tone: 'primary' },
  SHOP_BRANCH_UPDATED: { label: t('Filial yangilandi'), verb: t('filialni yangiladi'), group: 'shops', tone: 'neutral' },
  SHOP_BRANCH_ARCHIVED: { label: t('Filial arxivlandi'), verb: t('filialni arxivladi'), group: 'shops', tone: 'warning' },
  SHOP_SERVICE_AREA_UPDATED: { label: t('Xizmat hududi yangilandi'), verb: t('xizmat hududini yangiladi'), group: 'shops', tone: 'neutral' },
  SHOP_SERVICE_AREA_DELETED: { label: t('Xizmat hududi o‘chirildi'), verb: t('xizmat hududini o‘chirdi'), group: 'shops', tone: 'warning' },
  SHOP_SERVICE_CREATED: { label: t('Xizmat qo‘shildi'), verb: t('xizmat qo‘shdi'), group: 'shops', tone: 'primary' },
  SHOP_SERVICE_UPDATED: { label: t('Xizmat yangilandi'), verb: t('xizmatni yangiladi'), group: 'shops', tone: 'neutral' },
  SHOP_SERVICE_DELETED: { label: t('Xizmat o‘chirildi'), verb: t('xizmatni o‘chirdi'), group: 'shops', tone: 'warning' },
  WIDGET_UPDATED: { label: t('Vidjet sozlandi'), verb: t('vidjet sozlamalarini o‘zgartirdi'), group: 'shops', tone: 'neutral' },
  SHOP_PRODUCT_CREATED: { label: t('Mahsulot qo‘shildi'), verb: t('mahsulot qo‘shdi'), group: 'catalog', tone: 'primary' },
  SHOP_PRODUCT_UPDATED: { label: t('Mahsulot yangilandi'), verb: t('mahsulotni yangiladi'), group: 'catalog', tone: 'neutral' },
  SHOP_PRODUCT_ARCHIVED: { label: t('Mahsulot arxivlandi'), verb: t('mahsulotni arxivladi'), group: 'catalog', tone: 'warning' },
  OFFER_UPDATED: { label: t('Narx taklifi yangilandi'), verb: t('narx taklifini yangiladi'), group: 'catalog', tone: 'neutral' },
  OFFER_DELETED: { label: t('Narx taklifi o‘chirildi'), verb: t('narx taklifini o‘chirdi'), group: 'catalog', tone: 'warning' },
  IMPORT_VALIDATED: { label: t('Import tekshirildi'), verb: t('import faylini tekshirdi'), group: 'catalog', tone: 'neutral' },
  IMPORT_APPLIED: { label: t('Import qo‘llandi'), verb: t('importni qo‘lladi'), group: 'catalog', tone: 'success' },
  PRODUCT_MODEL_PROPOSED: { label: t('Model taklif qilindi'), verb: t('yangi model taklif qildi'), group: 'catalog', tone: 'primary' },
  PRODUCT_MODEL_MERGED: { label: t('Modellar birlashtirildi'), verb: t('modellarni birlashtirdi'), group: 'catalog', tone: 'warning' },
  CATEGORY_CREATED: { label: t('Kategoriya qo‘shildi'), verb: t('kategoriya qo‘shdi'), group: 'catalog', tone: 'primary' },
  CATEGORY_UPDATED: { label: t('Kategoriya yangilandi'), verb: t('kategoriyani yangiladi'), group: 'catalog', tone: 'neutral' },
  CATEGORY_DELETED: { label: t('Kategoriya o‘chirildi'), verb: t('kategoriyani o‘chirdi'), group: 'catalog', tone: 'warning' },
  CALCULATION_SAVED: { label: t('Hisob saqlandi'), verb: t('hisobni saqlab qo‘ydi'), group: 'calc', tone: 'primary' },
  CALCULATION_SHARED: { label: t('Hisob ulashildi'), verb: t('hisob havolasini yaratdi'), group: 'calc', tone: 'neutral' },
  SITE_CREATED: { label: t('Obyekt qo‘shildi'), verb: t('obyekt qo‘shdi'), group: 'calc', tone: 'primary' },
  SITE_ARCHIVED: { label: t('Obyekt arxivlandi'), verb: t('obyektni arxivladi'), group: 'calc', tone: 'warning' },
  TARIFF_CREATED: { label: t('Tarif qo‘shildi'), verb: t('tarif qo‘shdi'), group: 'calc', tone: 'primary' },
  TARIFF_UPDATED: { label: t('Tarif yangilandi'), verb: t('tarifni yangiladi'), group: 'calc', tone: 'neutral' },
  TARIFF_COPIED: { label: t('Tarif nusxalandi'), verb: t('tarif nusxasini yaratdi'), group: 'calc', tone: 'neutral' },
  TARIFF_UNTIL_SET: { label: t('Tarif muddati belgilandi'), verb: t('tarif tugash sanasini belgiladi'), group: 'calc', tone: 'warning' },
  EXPORT_RULE_CREATED: { label: t('Eksport qoidasi qo‘shildi'), verb: t('eksport qoidasi qo‘shdi'), group: 'calc', tone: 'primary' },
  EXPORT_RULE_UPDATED: { label: t('Eksport qoidasi yangilandi'), verb: t('eksport qoidasini yangiladi'), group: 'calc', tone: 'neutral' },
  GRID_LIMIT_CREATED: { label: t('Ulanish limiti qo‘shildi'), verb: t('ulanish limiti qo‘shdi'), group: 'calc', tone: 'primary' },
  FINANCING_CREATED: { label: t('Kredit mahsuloti qo‘shildi'), verb: t('kredit mahsuloti qo‘shdi'), group: 'calc', tone: 'primary' },
  FINANCING_UPDATED: { label: t('Kredit mahsuloti yangilandi'), verb: t('kredit mahsulotini yangiladi'), group: 'calc', tone: 'neutral' },
  CALC_SETTINGS_CREATED: { label: t('Kalkulyator sozlamasi yaratildi'), verb: t('kalkulyator sozlamalari versiyasini yaratdi'), group: 'calc', tone: 'primary' },
  CALC_SETTINGS_PUBLISHED: { label: t('Kalkulyator sozlamasi e’lon qilindi'), verb: t('kalkulyator sozlamalarini e’lon qildi'), group: 'calc', tone: 'success' },
  REGIONAL_YIELD_UPDATED: { label: t('Viloyat unumdorligi yangilandi'), verb: t('viloyat unumdorligini yangiladi'), group: 'calc', tone: 'neutral' },
  LEAD_UPDATED: { label: t('So‘rov holati yangilandi'), verb: t('so‘rov bosqichini o‘zgartirdi'), group: 'deals', tone: 'neutral' },
  INSTALLATION_DISPUTE_RESOLVED: { label: t('Montaj e’tirozi hal qilindi'), verb: t('montaj e’tirozi bo‘yicha qaror qabul qildi'), group: 'deals', tone: 'warning' },
  REVIEW_MODERATED: { label: t('Sharh moderatsiya qilindi'), verb: t('sharhni moderatsiya qildi'), group: 'deals', tone: 'neutral' },
  COMPLAINT_RESOLVED: { label: t('Shikoyat hal qilindi'), verb: t('shikoyatni hal qildi'), group: 'deals', tone: 'success' },
  MODERATION_SETTINGS_UPDATED: { label: t('Moderatsiya sozlamalari o‘zgardi'), verb: t('moderatsiya sozlamalarini o‘zgartirdi'), group: 'deals', tone: 'warning' },
  ARTICLE_CREATED: { label: t('Maqola qo‘shildi'), verb: t('maqola qo‘shdi'), group: 'content', tone: 'primary' },
  ARTICLE_UPDATED: { label: t('Maqola yangilandi'), verb: t('maqolani yangiladi'), group: 'content', tone: 'neutral' },
  SITE_BLOCK_PUBLISHED: { label: t('Bosh sahifa bloki e’lon qilindi'), verb: t('bosh sahifa blokini e’lon qildi'), group: 'content', tone: 'success' },
  SITE_BLOCKS_REORDERED: { label: t('Bloklar tartibi o‘zgardi'), verb: t('bosh sahifa bloklari tartibini o‘zgartirdi'), group: 'content', tone: 'neutral' },
  POLICY_CREATED: { label: t('Siyosat versiyasi yaratildi'), verb: t('siyosatning yangi versiyasini yaratdi'), group: 'content', tone: 'primary' },
  POLICY_PUBLISHED: { label: t('Siyosat e’lon qilindi'), verb: t('siyosatni e’lon qildi'), group: 'content', tone: 'success' },
  SUPPORT_TICKET_UPDATED: { label: t('Murojaat yangilandi'), verb: t('murojaatni yangiladi'), group: 'support', tone: 'neutral' },
  OPS_ALERT_ACK: { label: t('Ogohlantirish tasdiqlandi'), verb: t('tizim ogohlantirishini ko‘rib chiqdi'), group: 'system', tone: 'neutral' },
  RETENTION_CLEANUP: { label: t('Eski ma’lumotlar tozalandi'), verb: t('eski ma’lumotlarni tozaladi'), group: 'system', tone: 'neutral' },
};

const humanize = (code: string) => {
  const text = code.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function actionInfo(action: string): AuditActionInfo {
  return AUDIT_ACTIONS[action] ?? { label: humanize(action), verb: humanize(action).toLowerCase(), group: 'system', tone: 'neutral' };
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
