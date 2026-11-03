import { t } from '@/i18n';

/** Sertifikat turlari (TZ 4.11) — ommaviy sahifalar uchun yengil modul. */
export const CERT_TYPE: Record<'OFFICIAL_DEALER' | 'CERTIFIED_INSTALLER' | 'LICENSE', string> = { OFFICIAL_DEALER: t('Rasmiy diler'), CERTIFIED_INSTALLER: t('Sertifikatli montajchi'), LICENSE: t('Litsenziya') };
