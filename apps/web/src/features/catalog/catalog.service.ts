import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload } from '@/services/api.client';
import type { I18nText } from '@/features/shop/types';
import type {
  AdminModel, CatalogPage, Category, CategoryAttribute, CompareResult, ExchangeRate, ImportJobRow, ImportSummary, ModelCard, ModelDetail, ModelStatus, Offer, OfferInput, PublicOffer, ShopProduct, ShopProductsPage, Specs,
} from './types';

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  const query = search.toString();
  return query ? `?${query}` : '';
}

export interface CatalogFilters {
  categorySlug?: string;
  brand?: string;
  minPowerW?: number;
  maxPowerW?: number;
  minPrice?: number;
  maxPrice?: number;
  stock?: 'IN_STOCK' | 'ANY';
  q?: string;
  sort?: string;
  page?: number;
}

export interface ProposeInput extends Specs {
  categoryId: string;
  brand: string;
  model: string;
}

export interface CategoryInput {
  parentId?: string | null;
  slug: string;
  nameI18n: I18nText;
  attributeSchemaJson?: CategoryAttribute[];
  active?: boolean;
  sortOrder?: number;
}

const manage = (shopId: string) => `/manage/shops/${shopId}`;

export const catalogService = {
  categories: () => apiGet<Category[]>('/categories'),
  models: (filters: CatalogFilters) => apiGet<CatalogPage>(`/product-models${qs({ ...filters })}`),
  brands: (categoryId?: string) => apiGet<Array<{ brand: string; count: number }>>(`/product-models/brands${qs({ categoryId })}`),
  model: (slug: string) => apiGet<ModelDetail>(`/product-models/${encodeURIComponent(slug)}`),
  offers: (slug: string, params: { region?: string; sort?: 'price' | 'updated'; page?: number }) =>
    apiGet<{ items: PublicOffer[]; total: number; page: number; rate: ExchangeRate | null }>(`/product-models/${encodeURIComponent(slug)}/offers${qs(params)}`),
  compare: (ids: string[]) => apiGet<CompareResult>(`/product-models/compare${qs({ ids: ids.join(',') })}`),
  latestRate: () => apiGet<ExchangeRate>('/exchange-rates/latest'),

  // Do‘kon
  searchModels: (shopId: string, q: string) => apiGet<ModelCard[]>(`${manage(shopId)}/product-models/search${qs({ q })}`),
  propose: (shopId: string, input: ProposeInput) => apiPost<ModelCard>(`${manage(shopId)}/product-models/propose`, input),
  products: (shopId: string, params: { status?: string; categoryId?: string; q?: string; page?: number }) => apiGet<ShopProductsPage>(`${manage(shopId)}/products${qs(params)}`),
  createProduct: (shopId: string, input: { productModelId: string; description?: string; offer?: OfferInput }) => apiPost<ShopProduct>(`${manage(shopId)}/products`, input),
  updateProduct: (shopId: string, id: string, input: { description?: string; status?: string; version: number }) => apiPatch<ShopProduct>(`${manage(shopId)}/products/${id}`, input),
  archiveProduct: (shopId: string, id: string) => apiDelete(`${manage(shopId)}/products/${id}`),
  bulk: (shopId: string, input: { ids: string[]; action: 'PRICE_PERCENT' | 'STOCK' | 'ARCHIVE' | 'ACTIVATE'; percent?: number; stockStatus?: string }) =>
    apiPost<{ action: string; products: number; affected: number }>(`${manage(shopId)}/products/bulk`, input),
  createOffer: (shopId: string, productId: string, input: OfferInput) => apiPost<Offer>(`${manage(shopId)}/products/${productId}/offers`, input),
  updateOffer: (shopId: string, productId: string, offerId: string, input: OfferInput & { version: number }) => apiPut<Offer>(`${manage(shopId)}/products/${productId}/offers/${offerId}`, input),
  deleteOffer: (shopId: string, productId: string, offerId: string) => apiDelete(`${manage(shopId)}/products/${productId}/offers/${offerId}`),
  imports: (shopId: string) => apiGet<ImportJobRow[]>(`${manage(shopId)}/imports`),
  uploadImport: (shopId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<ImportSummary>(`${manage(shopId)}/imports`, form);
  },
  importJob: (shopId: string, id: string) => apiGet<ImportSummary>(`${manage(shopId)}/imports/${id}`),
  applyImport: (shopId: string, id: string) => apiPost<{ applied: number; skipped: number; created: number; updated: number }>(`${manage(shopId)}/imports/${id}/apply`),

  // Admin
  adminCategories: () => apiGet<Category[]>('/admin/categories'),
  createCategory: (input: CategoryInput) => apiPost<Category>('/admin/categories', input),
  updateCategory: (id: string, input: CategoryInput) => apiPut<Category>(`/admin/categories/${id}`, input),
  deleteCategory: (id: string) => apiDelete(`/admin/categories/${id}`),
  adminModels: (params: { status?: ModelStatus; categoryId?: string; q?: string; page?: number }) =>
    apiGet<{ items: AdminModel[]; total: number; page: number; pages: number; counts: Partial<Record<ModelStatus, number>> }>(`/admin/product-models${qs(params)}`),
  updateModel: (id: string, input: Specs & { brand?: string; model?: string; categoryId?: string; status?: 'APPROVED' | 'REJECTED'; rejectReason?: string }) => apiPatch<AdminModel>(`/admin/product-models/${id}`, input),
  mergeModel: (id: string, targetId: string) => apiPost<{ moved: number; combined: number }>(`/admin/product-models/${id}/merge`, { targetId }),
  adminRates: () => apiGet<{ latest: ExchangeRate | null; history: Array<{ id: string; rateToUzs: string; rateDate: string; source: string; fetchedAt: string }> }>('/admin/exchange-rates'),
  refreshRate: () => apiPost('/admin/exchange-rates/refresh'),
};
