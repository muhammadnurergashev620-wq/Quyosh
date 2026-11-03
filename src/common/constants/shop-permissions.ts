/** TZ 2.2: do‘kon a’zosi ruxsatlari. OWNER hammasiga ega; OWNER_ONLY — faqat egaga. */
export const SHOP_PERMISSIONS = [
  'shop.profile',
  'catalog.read',
  'catalog.write',
  'offers.write',
  'services.write',
  'branches.write',
  'requests.read',
  'requests.assign',
  'messages.write',
  'quote.draft',
  'quote.send',
  'quote.withdraw',
  'installations.write',
  'portfolio.write',
  'analytics.read',
  'widget.manage',
  'reviews.reply',
] as const;

export const OWNER_ONLY_PERMISSIONS = ['members.manage', 'shop.delete', 'shop.verification'] as const;

export type ShopPermission = (typeof SHOP_PERMISSIONS)[number] | (typeof OWNER_ONLY_PERMISSIONS)[number];

/** Yangi a’zo uchun standart ruxsatlar (TZ 2.1 jadvali). */
export const DEFAULT_PERMISSIONS: Record<'MANAGER' | 'STAFF', ShopPermission[]> = {
  MANAGER: ['shop.profile', 'catalog.read', 'catalog.write', 'offers.write', 'services.write', 'branches.write', 'requests.read', 'requests.assign', 'messages.write', 'quote.draft', 'quote.send', 'quote.withdraw', 'installations.write', 'portfolio.write', 'analytics.read', 'reviews.reply'],
  STAFF: ['catalog.read', 'requests.read', 'messages.write', 'quote.draft'],
};

export const isShopPermission = (value: string): value is (typeof SHOP_PERMISSIONS)[number] => (SHOP_PERMISSIONS as readonly string[]).includes(value);
