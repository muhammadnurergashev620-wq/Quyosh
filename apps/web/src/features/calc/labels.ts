import { MONTHS, lang, t } from '@/i18n';
import { formatMoney, formatNumber } from '@/lib/utils';
import type { Insight, LimitingFactor, SystemType } from './types';

const FULL_MONTHS = [t('Yanvar'), t('Fevral'), t('Mart'), t('Aprel'), t('May'), t('Iyun'), t('Iyul'), t('Avgust'), t('Sentabr'), t('Oktabr'), t('Noyabr'), t('Dekabr')];

/** Oy nomi (1..12), joriy tilda. */
export const monthName = (month: number) => FULL_MONTHS[month - 1] ?? String(month);
export const monthShort = (month: number) => {
  const name = MONTHS[lang][month - 1] ?? String(month);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export const SYSTEM_TYPE: Record<SystemType, { title: string; text: string; who: string }> = {
  ON_GRID: { title: t('Tarmoqqa ulangan'), text: t('Kunduzi quyosh, kechasi tarmoq. Eng arzon.'), who: t('Elektr uzilmaydigan joylar uchun') },
  HYBRID: { title: t('Gibrid'), text: t('Akkumulyator bilan: uzilishda ham muhim texnika ishlaydi.'), who: t('Tez-tez o‘chadigan joylar uchun') },
  OFF_GRID: { title: t('Avtonom'), text: t('Tarmoqsiz, to‘liq quyosh va akkumulyator.'), who: t('Tarmoq yo‘q joylar uchun') },
};

export const LIMITING: Record<LimitingFactor, string> = {
  CONSUMPTION: t('Iste’mol bo‘yicha tanlandi'),
  AREA: t('Tom maydoni cheklaydi'),
  GRID_LIMIT: t('Ulanish limiti cheklaydi'),
  BUDGET: t('Byudjet cheklaydi'),
  MIN_ONE_PANEL: t('Kamida bitta panel'),
};

export const METHOD: Record<string, string> = {
  A_PV_YIELD: t('PVGIS (Yevropa Komissiyasi JRC)'),
  B_IRRADIANCE: t('NASA POWER + Quyosh modeli'),
  DEFAULT: t('Provider ma’lumoti yo‘q, viloyat o‘rtachasi'),
};

export const OPTION_LABEL: Record<'ECONOMY' | 'BALANCED' | 'MAXIMUM', string> = { ECONOMY: t('Tejamkor'), BALANCED: t('Muvozanatli'), MAXIMUM: t('Maksimal') };

export const WARNING_TEXT: Record<string, string> = {
  TARIFF_NOT_FOUND: t('Bu hudud uchun tarif ma’lumoti yo‘q — moliyaviy natijalar hisoblanmadi.'),
  SOLAR_PROVIDER_UNAVAILABLE_REGION_AVERAGE: t('Quyosh ma’lumoti provayderdan olinmadi — viloyat o‘rtachasi ishlatildi.'),
  SOLAR_DATA_STALE: t('Quyosh ma’lumoti keshi eskirgan; fonda yangilanadi.'),
  OUTSIDE_UZBEKISTAN: t('Nuqta O‘zbekiston hududidan tashqarida — natijalar noaniq.'),
  AREA_ESTIMATED_PRESET: t('Maydon taxminiy hajm bo‘yicha olindi — aniqroq natija uchun tomni xaritada chizing.'),
  AREA_EXCEEDED: t('Tanlangan quvvat tom maydoniga sig‘masligi mumkin.'),
  EXPORT_RULE_SYSTEM_TOO_LARGE: t('Tizim eksport qoidasidagi maksimal quvvatdan katta — eksport kompensatsiyasi qo‘llanmadi.'),
  ON_GRID_NO_BACKUP: t('Tarmoqqa ulangan tizim elektr o‘chganda xavfsizlik uchun o‘chadi.'),
  INVERTER_TOO_SMALL: t('Invertor kritik yuklama yoki ishga tushish quvvati uchun yetarli emas.'),
  BALANCE_INVARIANT_VIOLATION: t('Hisob tekshiruvida xato — natijani yordamga yuboring.'),
};

export const ASSUMPTION_TEXT: Record<string, string> = {
  DEFAULT_PANEL: t('Panel: standart 550 W (2278×1134 mm, −0,35 %/°C, degradatsiya 0,5 %/yil).'),
  ESTIMATED_COSTS: t('Narxlar taxminiy: katalog medianasi yoki standart qiymat.'),
};

export const sum = (value: number) => formatMoney(value, t('so‘m'));
/** Katta summalar: «12,4 mln so‘m». */
export function sumShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ${t('mlrd so‘m')}`;
  if (abs >= 1e6) return `${(value / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ${t('mln so‘m')}`;
  if (abs >= 1e3) return `${formatNumber(Math.round(value / 1e3))} ${t('ming so‘m')}`;
  return sum(value);
}
export const kwh = (value: number) => `${formatNumber(value)} kWh`;
export const kw = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${t('kVt')}`;
export const years = (value: number) => t('{n} yil', { n: value.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) });

/** U8.11 insight matnlari. */
export function insightText(item: Insight, context: { maxGeneration: number }): string {
  switch (item.type) {
    case 'BEST_SAVING_MONTH':
      return t('{month}da eng ko‘p tejaysiz — taxminan {sum}', { month: monthName(item.month!), sum: sumShort(item.value) });
    case 'LOWEST_GENERATION_MONTH':
      return t('{month}da ishlab chiqarish eng yuqori oydagidan {x} marta kam', { month: monthName(item.month!), x: (context.maxGeneration / Math.max(item.value, 1)).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) });
    case 'PEAK_IMPORT_MONTH':
      return t('{month}da tarmoqdan eng ko‘p olasiz — {kwh}', { month: monthName(item.month!), kwh: kwh(item.value) });
    case 'BATTERY_CRITICAL_MONTH':
      return t('{month} tunlari akkumulyator uchun eng og‘ir', { month: monthName(item.month!) });
    case 'SUMMER_SURPLUS':
      return t('Ortiqcha energiyaning {p} % i iyun–avgustga to‘g‘ri keladi', { p: Math.round(item.value * 100) });
  }
}
