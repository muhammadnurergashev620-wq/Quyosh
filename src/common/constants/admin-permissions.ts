/** Admin huquqlari (bo‘limlar). Superadmin barchasiga ega; oddiy adminga superadmin tanlab beradi (TZ 2.1). */
export const ADMIN_PERMISSIONS = [
  'USERS', // Foydalanuvchilar
  'SHOPS', // Do‘konlar va verifikatsiya
  'CATALOG', // Kategoriyalar va ProductModel moderatsiyasi
  'REVIEWS', // Sharhlar, shikoyatlar va e‘tirozlar
  'TARIFFS', // Tarif, eksport qoidalari, moliyalashtirish
  'CALCULATOR', // Kalkulyator sozlamalari va ma‘lumotnomalar
  'CONTENT', // Bilimlar markazi va bosh sahifa bloklari
  'SUPPORT', // Yordam navbati
  'POLICIES', // Siyosatlar
  'REPORTS', // Boshqaruv paneli va hisobotlar
  'AUDIT', // Audit jurnali
  'DEVOPS', // DevOps
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
