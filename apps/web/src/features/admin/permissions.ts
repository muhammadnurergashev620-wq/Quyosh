import { t } from '@/i18n';
/** Admin huquqlari (bo‘limlar) — backend `ADMIN_PERMISSIONS` bilan bir xil kalitlar. */
export type AdminPermission = 'USERS' | 'SHOPS' | 'CATALOG' | 'REVIEWS' | 'TARIFFS' | 'CALCULATOR' | 'CONTENT' | 'SUPPORT' | 'POLICIES' | 'REPORTS' | 'AUDIT' | 'DEVOPS';

export const ADMIN_PERMISSION_OPTIONS: Array<{ value: AdminPermission; label: string; hint: string; group: 'Boshqaruv' | 'Kontent' | 'Tizim' }> = [
  { value: 'REPORTS', label: t('Boshqaruv paneli va hisobotlar'), hint: t('Statistika, funnel va hisobotlar'), group: 'Tizim' },
  { value: 'USERS', label: t('Foydalanuvchilar'), hint: t('Foydalanuvchilarni ko‘rish, muzlatish, bloklash, o‘chirish'), group: 'Boshqaruv' },
  { value: 'SHOPS', label: t('Do‘konlar va verifikatsiya'), hint: t('Do‘konlarni tasdiqlash, sertifikatlar'), group: 'Boshqaruv' },
  { value: 'REVIEWS', label: t('Sharhlar va shikoyatlar'), hint: t('Moderatsiya, shikoyatlar, montaj e’tirozlari'), group: 'Boshqaruv' },
  { value: 'SUPPORT', label: t('Yordam navbati'), hint: t('Murojaatlarga javob berish'), group: 'Boshqaruv' },
  { value: 'CATALOG', label: t('Katalog moderatsiyasi'), hint: t('Kategoriyalar va modellar'), group: 'Kontent' },
  { value: 'CONTENT', label: t('Bilimlar markazi'), hint: t('Maqolalar va kategoriyalar'), group: 'Kontent' },
  { value: 'TARIFFS', label: t('Tariflar'), hint: t('Tarif, eksport, moliyalashtirish'), group: 'Kontent' },
  { value: 'CALCULATOR', label: t('Kalkulyator sozlamalari'), hint: t('Parametrlar va ma’lumotnomalar'), group: 'Kontent' },
  { value: 'POLICIES', label: t('Siyosatlar'), hint: t('Shartlar va siyosatlarni boshqarish'), group: 'Kontent' },
  { value: 'AUDIT', label: t('Audit jurnali'), hint: t('Barcha harakatlar tarixi'), group: 'Tizim' },
  { value: 'DEVOPS', label: 'DevOps', hint: t('Tizim holati va ko‘rsatkichlari'), group: 'Tizim' },
];

export const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(ADMIN_PERMISSION_OPTIONS.map((option) => [option.value, option.label]));
