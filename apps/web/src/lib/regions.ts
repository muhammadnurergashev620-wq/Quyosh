import { t } from '@/i18n';

/** O‘zbekiston hududlari. Kalitlar backend `src/common/constants/regions.ts` bilan bir xil. */
export const REGIONS: Array<{ code: string; name: string }> = [
  { code: 'toshkent-shahri', name: t('Toshkent shahri') },
  { code: 'toshkent-viloyati', name: t('Toshkent viloyati') },
  { code: 'andijon', name: t('Andijon viloyati') },
  { code: 'buxoro', name: t('Buxoro viloyati') },
  { code: 'fargona', name: t('Farg‘ona viloyati') },
  { code: 'jizzax', name: t('Jizzax viloyati') },
  { code: 'xorazm', name: t('Xorazm viloyati') },
  { code: 'namangan', name: t('Namangan viloyati') },
  { code: 'navoiy', name: t('Navoiy viloyati') },
  { code: 'qashqadaryo', name: t('Qashqadaryo viloyati') },
  { code: 'qoraqalpogiston', name: t('Qoraqalpog‘iston Respublikasi') },
  { code: 'samarqand', name: t('Samarqand viloyati') },
  { code: 'sirdaryo', name: t('Sirdaryo viloyati') },
  { code: 'surxondaryo', name: t('Surxondaryo viloyati') },
];

export const regionName = (code: string | null | undefined) => REGIONS.find((region) => region.code === code)?.name ?? code ?? '';
