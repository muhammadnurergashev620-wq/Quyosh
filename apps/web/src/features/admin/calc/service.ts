import { apiGet, apiPatch, apiPost, apiPut } from '@/services/api.client';
import { qs } from '@/features/catalog/catalog.service';
import { t } from '@/i18n';

export type PublishStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type CustomerType = 'HOUSEHOLD' | 'LEGAL';
export type TouPeriodType = 'ALL' | 'DAY' | 'NIGHT';

export interface TariffTier { id?: string; seasonMonths: number[]; touPeriod: TouPeriodType; minKwh: string | number; maxKwh: string | number | null; ratePerKwh: string | number; notes?: string | null }
export interface TariffTou { touPeriod: 'DAY' | 'NIGHT'; startHour: number; endHour: number }
export interface Tariff {
  id: string; regionCode: string; customerType: CustomerType; title: string; fixedChargeMonthly: string | null; touEnabled: boolean; sourceUrl: string | null;
  verifiedAt: string | null; effectiveFrom: string; effectiveUntil: string | null; status: PublishStatus; version: number; tiers: TariffTier[]; touPeriods: TariffTou[];
}
export interface TariffInput {
  regionCode: string; customerType: CustomerType; title: string; fixedChargeMonthly?: number | null; touEnabled?: boolean; sourceUrl?: string;
  effectiveFrom: string; effectiveUntil?: string | null; tiers: Array<{ seasonMonths?: number[]; touPeriod?: TouPeriodType; minKwh: number; maxKwh?: number | null; ratePerKwh: number }>; touPeriods?: TariffTou[];
}
export interface ExportRule { id: string; regionCode: string; customerType: CustomerType; compensationType: 'NONE' | 'NET_METERING' | 'NET_BILLING' | 'FEED_IN'; ratePerKwh: string | null; settlementPeriod: 'MONTH' | 'YEAR'; maxSystemKw: string | null; sourceUrl: string | null; verifiedAt: string | null; effectiveFrom: string; effectiveUntil: string | null; status: PublishStatus }
export interface GridLimit { id: string; regionCode: string; customerType: CustomerType; maxKw: string; sourceUrl: string | null; effectiveFrom: string; status: PublishStatus }
export interface FinancingProduct {
  id: string; providerName: string; financingType: 'BANK_LOAN' | 'INSTALLMENT' | 'LEASING'; annualRate: string; minTermMonths: number; maxTermMonths: number; allowedTerms: number[];
  minDownPaymentPct: string; maxAmount: string | null; oneTimeFeePct: string; monthlyFee: string; paymentType: 'ANNUITY' | 'DIFFERENTIATED'; customerTypes: CustomerType[];
  sourceUrl: string | null; verifiedAt: string | null; effectiveFrom: string; effectiveUntil: string | null; status: PublishStatus; version: number;
}
export interface SettingsVersion { id: string; modelVersion: string; parametersJson: Record<string, unknown>; sourceNotes: string | null; effectiveFrom: string; effectiveUntil: string | null; status: PublishStatus; createdAt: string }
export interface RegionalYield { id: string; regionCode: string; monthlyYieldJson: number[]; sourceNote: string | null; updatedAt: string }
export interface SolarDataset { id: string; provider: 'PVGIS' | 'NASA_POWER' | 'DEFAULT'; cellKey: string; tiltBucket: number; azimuthBucket: number; annualYieldKwhPerKwp: string; fetchedAt: string; expiresAt: string; status: 'FRESH' | 'STALE' | 'FAILED' }

export const adminCalcService = {
  tariffs: (params: { status?: string; regionCode?: string; customerType?: string }) => apiGet<Tariff[]>(`/admin/tariffs${qs(params)}`),
  createTariff: (input: TariffInput) => apiPost<Tariff>('/admin/tariffs', input),
  updateTariff: (id: string, input: TariffInput) => apiPut<Tariff>(`/admin/tariffs/${id}`, input),
  copyTariff: (id: string) => apiPost<Tariff>(`/admin/tariffs/${id}/copy`),
  publishTariff: (id: string) => apiPost<Tariff>(`/admin/tariffs/${id}/publish`),
  archiveTariff: (id: string) => apiPost<Tariff>(`/admin/tariffs/${id}/archive`),
  tariffUntil: (id: string, effectiveUntil: string | null) => apiPatch<Tariff>(`/admin/tariffs/${id}/until`, { effectiveUntil }),
  exportRules: () => apiGet<ExportRule[]>('/admin/export-rules'),
  createExportRule: (input: Record<string, unknown>) => apiPost<ExportRule>('/admin/export-rules', input),
  publishExportRule: (id: string) => apiPost<ExportRule>(`/admin/export-rules/${id}/publish`),
  archiveExportRule: (id: string) => apiPost<ExportRule>(`/admin/export-rules/${id}/archive`),
  gridLimits: () => apiGet<GridLimit[]>('/admin/grid-limits'),
  createGridLimit: (input: Record<string, unknown>) => apiPost<GridLimit>('/admin/grid-limits', input),
  archiveGridLimit: (id: string) => apiPost<GridLimit>(`/admin/grid-limits/${id}/archive`),
  settings: () => apiGet<SettingsVersion[]>('/admin/calc/settings'),
  defaults: () => apiGet<Record<string, unknown>>('/admin/calc/settings/defaults'),
  createSettings: (input: { modelVersion: string; parametersJson: Record<string, unknown>; sourceNotes?: string; effectiveFrom: string }) => apiPost<SettingsVersion>('/admin/calc/settings', input),
  publishSettings: (id: string) => apiPost<SettingsVersion>(`/admin/calc/settings/${id}/publish`),
  financing: () => apiGet<FinancingProduct[]>('/admin/calc/financing'),
  createFinancing: (input: Record<string, unknown>) => apiPost<FinancingProduct>('/admin/calc/financing', input),
  updateFinancing: (id: string, input: Record<string, unknown>) => apiPut<FinancingProduct>(`/admin/calc/financing/${id}`, input),
  publishFinancing: (id: string) => apiPost<FinancingProduct>(`/admin/calc/financing/${id}/publish`),
  archiveFinancing: (id: string) => apiPost<FinancingProduct>(`/admin/calc/financing/${id}/archive`),
  regionalYields: () => apiGet<RegionalYield[]>('/admin/calc/regional-yields'),
  saveRegionalYield: (regionCode: string, monthly: number[], sourceNote?: string) => apiPut<RegionalYield>(`/admin/calc/regional-yields/${regionCode}`, { monthly, sourceNote }),
  solarDatasets: () => apiGet<SolarDataset[]>('/admin/calc/solar-datasets'),
};

export const PUBLISH_STATUS: Record<PublishStatus, { label: string; tone: 'neutral' | 'success' | 'warning' }> = {
  DRAFT: { label: t('Qoralama'), tone: 'warning' },
  PUBLISHED: { label: t('Tasdiqlangan'), tone: 'success' },
  ARCHIVED: { label: t('Arxivda'), tone: 'neutral' },
};
