import { apiDelete, apiGet, apiPost, apiPostSignal, apiPut } from '@/services/api.client';
import type { CalcReference, EstimateInput, EstimateResult, LoanResult, OutageResult, SavedCalculationRow } from './types';

export const calcService = {
  reference: () => apiGet<CalcReference>('/calc/reference'),
  estimate: (input: EstimateInput, signal: AbortSignal) => apiPostSignal<EstimateResult>('/calculations/estimate', input, signal),
  save: (input: EstimateInput, title?: string) => apiPost<{ id: string; result: EstimateResult }>('/calculations', { input, title }),
  list: () => apiGet<SavedCalculationRow[]>('/calculations'),
  get: (id: string) => apiGet<{ id: string; title: string | null; mode: string; createdAt: string; siteId: string | null; input: EstimateInput; result: EstimateResult; outdated: boolean; shares: Array<{ id: string; expiresAt: string | null; viewCount: number }> }>(`/calculations/${id}`),
  recalculate: (id: string) => apiPost<{ id: string }>(`/calculations/${id}/recalculate`),
  archive: (id: string) => apiPost(`/calculations/${id}/archive`),
  compare: (ids: string[]) => apiGet<Array<SavedCalculationRow>>(`/calculations/compare?ids=${ids.join(',')}`),
  share: (id: string, expiresDays: 7 | 30 | null) => apiPost<{ token: string; expiresAt: string | null }>(`/calculations/${id}/share`, { expiresDays }),
  revokeShare: (id: string) => apiDelete(`/calculations/${id}/share`),
  report: (id: string, lang: 'uz' | 'oz' | 'ru' | 'en', qrMode: 'SHARE' | 'CABINET' | 'NONE', idempotencyKey: string) => apiPost<{ id: string; status: string }>(`/calculations/${id}/report`, { lang, qrMode }, idempotencyKey),
  reportStatus: (jobId: string) => apiGet<{ id: string; status: 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED'; error: string | null }>(`/reports/${jobId}`),
  reportDownload: (jobId: string) => apiGet<{ url: string }>(`/reports/${jobId}/download`),
  shared: (token: string) => apiGet<{ mode: string; createdAt: string; result: EstimateResult }>(`/shared/${encodeURIComponent(token)}`),
  getDraft: () => apiGet<{ input: Record<string, unknown>; updatedAt: string } | null>('/calculations/draft'),
  saveDraft: (input: Record<string, unknown>) => apiPut('/calculations/draft', { input }),
  deleteDraft: () => apiDelete('/calculations/draft'),
  financing: (input: { initialCost: number; downPayment?: number; productId?: string; annualRate?: number; termMonths: number; paymentType?: 'ANNUITY' | 'DIFFERENTIATED'; monthlySaving?: number[] }) =>
    apiPost<LoanResult & { product: { providerName: string; sourceUrl: string | null; verifiedAt: string | null; minDownPaymentPct: number } | null }>('/financing/estimate', input),
  outage: (input: { systemType: string; criticalItems: Array<{ code?: string; powerW: number; count: number; hoursPerDay: number }>; batteryKwh?: number; inverterKw?: number; backupHours?: number }) => apiPost<OutageResult>('/outage/estimate', input),
};

