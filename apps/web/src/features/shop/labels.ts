import type { BadgeTone } from '@/components/ui/Badge';
import { t } from '@/i18n';
import type { PricingModel, ServiceType, ShopDocType, ShopMemberRole, ShopProductStatus, ShopStatus, ShopVerificationStatus, StockStatus, Weekday } from './types';

export const SHOP_STATUS: Record<ShopStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: t('Qoralama'), tone: 'neutral' },
  PENDING_REVIEW: { label: t('Tekshiruvda'), tone: 'warning' },
  ACTIVE: { label: t('Faol'), tone: 'success' },
  SUSPENDED: { label: t('To‘xtatilgan'), tone: 'danger' },
};

export const VERIFICATION_STATUS: Record<ShopVerificationStatus, { label: string; tone: BadgeTone }> = {
  NOT_SUBMITTED: { label: t('Yuborilmagan'), tone: 'neutral' },
  PENDING: { label: t('Kutilmoqda'), tone: 'warning' },
  VERIFIED: { label: t('Tasdiqlangan'), tone: 'success' },
  REJECTED: { label: t('Rad etilgan'), tone: 'danger' },
};

export const MEMBER_ROLE: Record<ShopMemberRole, string> = {
  OWNER: t('Ega'),
  MANAGER: t('Menejer'),
  STAFF: t('Xodim'),
};

export const SERVICE_TYPE: Record<ServiceType, string> = {
  INSTALLATION: t('Montaj'),
  SITE_VISIT: t('Obyektga chiqish'),
  AUDIT: t('Energiya auditi'),
  MAINTENANCE: t('Texnik xizmat'),
  DELIVERY: t('Yetkazib berish'),
};

export const PRICING_MODEL: Record<PricingModel, string> = {
  FIXED: t('Qat’iy narx'),
  FROM: t('…dan boshlab'),
  PER_KW: t('Har kW uchun'),
  PER_UNIT: t('Dona uchun'),
  QUOTE_REQUIRED: t('So‘rov orqali'),
};

export const DOC_TYPE: Record<ShopDocType, string> = {
  REGISTRATION: t('Davlat ro‘yxatidan o‘tganlik guvohnomasi'),
  LICENSE: t('Litsenziya / ruxsatnoma'),
  OTHER: t('Boshqa hujjat'),
};

export const STOCK_STATUS: Record<StockStatus, { label: string; tone: BadgeTone }> = {
  IN_STOCK: { label: t('Mavjud'), tone: 'success' },
  ON_ORDER: { label: t('Buyurtma asosida'), tone: 'warning' },
  OUT_OF_STOCK: { label: t('Tugagan'), tone: 'neutral' },
};

export const PRODUCT_STATUS: Record<ShopProductStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: t('Qoralama'), tone: 'neutral' },
  ACTIVE: { label: t('Faol'), tone: 'success' },
  ARCHIVED: { label: t('Arxivda'), tone: 'neutral' },
};

export const WEEKDAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'mon', label: t('Dushanba') },
  { key: 'tue', label: t('Seshanba') },
  { key: 'wed', label: t('Chorshanba') },
  { key: 'thu', label: t('Payshanba') },
  { key: 'fri', label: t('Juma') },
  { key: 'sat', label: t('Shanba') },
  { key: 'sun', label: t('Yakshanba') },
];

/** TZ 2.2 ruxsatlari — U11.15 guruhlari bo‘yicha. */
export const PERMISSION_GROUPS: Array<{ title: string; items: Array<{ key: string; label: string }> }> = [
  { title: t('Katalog'), items: [
    { key: 'catalog.read', label: t('Katalogni ko‘rish') },
    { key: 'catalog.write', label: t('Mahsulot qo‘shish va import') },
    { key: 'offers.write', label: t('Narx va zaxira') },
    { key: 'services.write', label: t('Xizmatlar') },
    { key: 'branches.write', label: t('Filiallar va hudud') },
  ] },
  { title: t('So‘rovlar'), items: [
    { key: 'requests.read', label: t('So‘rovlarni ko‘rish') },
    { key: 'requests.assign', label: t('Mas’ul tayinlash') },
    { key: 'messages.write', label: t('Mijozga yozish') },
  ] },
  { title: t('Takliflar'), items: [
    { key: 'quote.draft', label: t('Taklif tayyorlash') },
    { key: 'quote.send', label: t('Taklif yuborish') },
    { key: 'quote.withdraw', label: t('Taklifni qaytarib olish') },
  ] },
  { title: t('Montaj'), items: [{ key: 'installations.write', label: t('Montajlar') }] },
  { title: t('Marketing'), items: [
    { key: 'shop.profile', label: t('Do‘kon profili') },
    { key: 'portfolio.write', label: t('Portfolio') },
    { key: 'reviews.reply', label: t('Sharhlarga javob') },
    { key: 'widget.manage', label: t('Vidjet') },
  ] },
  { title: t('Analitika'), items: [{ key: 'analytics.read', label: t('Analitika') }] },
];

export const DEFAULT_PERMISSIONS: Record<'MANAGER' | 'STAFF', string[]> = {
  MANAGER: ['shop.profile', 'catalog.read', 'catalog.write', 'offers.write', 'services.write', 'branches.write', 'requests.read', 'requests.assign', 'messages.write', 'quote.draft', 'quote.send', 'quote.withdraw', 'installations.write', 'portfolio.write', 'analytics.read', 'reviews.reply'],
  STAFF: ['catalog.read', 'requests.read', 'messages.write', 'quote.draft'],
};

export const personName = (user: { firstName: string | null; lastName: string | null; phone?: string | null; accountNumber?: number }) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone || (user.accountNumber ? `#${user.accountNumber}` : '—');
