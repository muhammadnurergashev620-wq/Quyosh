import { lang, t } from '@/i18n';
import { formatMoney, formatNumber } from '@/lib/utils';
import type { I18nText } from '@/features/shop/types';
import type { ExchangeRate, SpecKey, Specs } from './types';

/** I18n matn: joriy tilda, bo‘lmasa o‘zbekcha (TZ 7.2: uz / oz / ru). */
export function i18nText(value: Partial<I18nText> | null | undefined): string {
  if (!value) return '';
  const key = lang === 'ru' ? 'ru' : lang === 'uz-Cyrl' ? 'oz' : 'uz';
  return value[key] || value.uz || '';
}

export const SPEC_META: Record<SpecKey, { label: string; unit?: string; digits?: number }> = {
  nominalPowerW: { label: t('Quvvat'), unit: 'W', digits: 0 },
  efficiencyPct: { label: t('Samaradorlik'), unit: '%', digits: 1 },
  widthMm: { label: t('Eni'), unit: 'mm', digits: 0 },
  heightMm: { label: t('Bo‘yi'), unit: 'mm', digits: 0 },
  weightKg: { label: t('Og‘irligi'), unit: 'kg', digits: 1 },
  tempCoeffPmaxPctPerC: { label: t('Harorat koeffitsienti (Pmax)'), unit: '%/°C', digits: 2 },
  vocV: { label: 'Voc', unit: 'V', digits: 2 },
  vmpV: { label: 'Vmp', unit: 'V', digits: 2 },
  iscA: { label: 'Isc', unit: 'A', digits: 2 },
  impA: { label: 'Imp', unit: 'A', digits: 2 },
  degradationPctPerYear: { label: t('Yillik degradatsiya'), unit: '%', digits: 2 },
  inverterAcKw: { label: t('AC quvvat'), unit: 'kW', digits: 1 },
  inverterMaxDcV: { label: t('Maks. DC kuchlanish'), unit: 'V', digits: 0 },
  mpptMinV: { label: t('MPPT min'), unit: 'V', digits: 0 },
  mpptMaxV: { label: t('MPPT maks'), unit: 'V', digits: 0 },
  mpptMaxCurrentA: { label: t('MPPT maks. tok'), unit: 'A', digits: 1 },
  batteryVoltageV: { label: t('Kuchlanish'), unit: 'V', digits: 1 },
  batteryCapacityKwh: { label: t('Sig‘im'), unit: 'kWh', digits: 2 },
  batteryUsableDod: { label: t('Foydali DoD'), unit: '%', digits: 0 },
  batteryChemistry: { label: t('Kimyo') },
  batteryCycles: { label: t('Sikllar soni'), digits: 0 },
  warrantyMonths: { label: t('Kafolat'), unit: t('oy'), digits: 0 },
};

/** Xususiyat qiymati birligi bilan (DoD 0..1 → %). */
export function specValue(key: SpecKey, raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  const meta = SPEC_META[key];
  if (key === 'batteryChemistry') return String(raw);
  let value = Number(raw);
  if (!Number.isFinite(value)) return String(raw);
  if (key === 'batteryUsableDod') value *= 100;
  const digits = meta.digits ?? 2;
  const text = digits === 0 ? formatNumber(value) : value.toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { maximumFractionDigits: digits });
  return meta.unit ? `${text} ${meta.unit}` : text;
}

/** Kartadagi 2–3 asosiy xususiyat (U7.5). */
export function keySpecs(model: Specs): string[] {
  const keys: SpecKey[] = model.nominalPowerW ? ['nominalPowerW', 'efficiencyPct', 'warrantyMonths'] : model.inverterAcKw ? ['inverterAcKw', 'efficiencyPct', 'warrantyMonths'] : model.batteryCapacityKwh ? ['batteryCapacityKwh', 'batteryChemistry', 'batteryCycles'] : ['warrantyMonths'];
  return keys.filter((key) => model[key] !== null && model[key] !== undefined).map((key) => `${SPEC_META[key].label}: ${specValue(key, model[key])}`);
}

export const sum = (value: string | number) => formatMoney(value, t('so‘m'));

/** USD narx: «1 250 $ (≈ 15 082 775 so‘m, MB kursi 30.10.2026)». */
export function priceWithRate(price: string, currency: 'UZS' | 'USD', priceUzs: string | null, rate: ExchangeRate | null): { main: string; note: string | null } {
  if (currency === 'UZS') return { main: sum(price), note: null };
  const main = `${formatNumber(Number(price))} $`;
  if (!priceUzs || !rate) return { main, note: null };
  return { main, note: t('≈ {sum}, MB kursi {date}', { sum: sum(priceUzs), date: rate.rateDate.split('-').reverse().join('.') }) };
}
