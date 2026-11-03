import { t } from '@/i18n';
import type { AreaType, RoofShape, ShadingLevel, SiteType } from './map.service';

export const SITE_TYPE: Record<SiteType, string> = { HOUSE: t('Uy'), BUSINESS: t('Biznes'), WAREHOUSE: t('Ombor'), GARAGE: t('Garaj'), OTHER: t('Boshqa') };
export const AREA_TYPE: Record<AreaType, string> = { ROOF: t('Tom'), GROUND: t('Hovli / yer'), CARPORT: t('Avtomobil soyaboni') };
export const ROOF_SHAPE: Record<RoofShape, string> = { FLAT: t('Tekis'), PITCHED: t('Qiya') };
export const SHADING: Record<ShadingLevel, string> = { NONE: t('Soya yo‘q'), LIGHT: t('Kam soya'), HEAVY: t('Ko‘p soya') };
/** 0° = shimol, soat strelkasi bo‘yicha (TZ 10.1). */
export const AZIMUTHS: Array<{ value: number; label: string }> = [
  { value: 180, label: t('Janub') }, { value: 135, label: t('Janubi-sharq') }, { value: 225, label: t('Janubi-g‘arb') },
  { value: 90, label: t('Sharq') }, { value: 270, label: t('G‘arb') }, { value: 45, label: t('Shimoli-sharq') }, { value: 315, label: t('Shimoli-g‘arb') }, { value: 0, label: t('Shimol') },
];
