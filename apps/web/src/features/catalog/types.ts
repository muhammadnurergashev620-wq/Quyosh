import type { Currency, I18nText, ShopProductStatus, StockStatus } from '@/features/shop/types';

export interface CategoryAttribute {
  key: string;
  type: 'number' | 'string';
  unit?: string;
  label: I18nText;
  filter?: 'range' | 'select';
}

export interface Category {
  id: string;
  parentId: string | null;
  slug: string;
  nameI18n: I18nText;
  descriptionI18n: Partial<I18nText> | null;
  attributeSchemaJson: CategoryAttribute[] | null;
  active: boolean;
  sortOrder: number;
  modelCount: number;
  children: Category[];
}

export type ModelStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MERGED';

export const SPEC_KEYS = [
  'nominalPowerW', 'efficiencyPct', 'widthMm', 'heightMm', 'weightKg', 'tempCoeffPmaxPctPerC', 'vocV', 'vmpV', 'iscA', 'impA', 'degradationPctPerYear',
  'inverterAcKw', 'inverterMaxDcV', 'mpptMinV', 'mpptMaxV', 'mpptMaxCurrentA', 'batteryVoltageV', 'batteryCapacityKwh', 'batteryUsableDod', 'batteryChemistry', 'batteryCycles', 'warrantyMonths',
] as const;
export type SpecKey = (typeof SPEC_KEYS)[number];
export type Specs = Partial<Record<SpecKey, string | number | null>>;

export interface ModelCard extends Specs {
  id: string;
  slug: string;
  brand: string;
  model: string;
  status: ModelStatus;
  categoryId: string;
  category: { id: string; slug: string; nameI18n: I18nText };
  images: Array<{ fileId: string; altText: string | null }>;
}

export interface CatalogItem extends ModelCard {
  minPriceUzs: string | null;
  offerCount: number;
  inStock: boolean;
}

export interface ExchangeRate {
  currency: Currency;
  rateToUzs: string;
  rateDate: string;
  source: string;
  stale: boolean;
}

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  rate: ExchangeRate | null;
}

export interface ModelDetail extends ModelCard {
  datasheetFileId: string | null;
  specsJson: Record<string, unknown> | null;
  category: ModelCard['category'] & { attributeSchemaJson: CategoryAttribute[] | null; parentId: string | null };
  images: Array<{ id: string; fileId: string; altText: string | null; sortOrder: number }>;
  redirectSlug?: string | null;
}

export interface PublicOffer {
  id: string;
  price: string;
  currency: Currency;
  priceUzs: string | null;
  vatIncluded: boolean;
  stockStatus: StockStatus;
  quantity: number | null;
  validUntil: string | null;
  updatedAt: string;
  description: string | null;
  branch: { id: string; name: string; address: string; regionCode: string | null } | null;
  shop: { id: string; slug: string; name: string; logoAssetId: string | null; ratingAvg: string; ratingCount: number };
}

export interface CompareResult {
  models: Array<ModelCard>;
  rows: Array<{ key: SpecKey; values: Array<string | null>; differs: boolean; best: number[] }>;
  compatibility: null;
}

export interface Offer {
  id: string;
  branchId: string | null;
  branch?: { id: string; name: string } | null;
  price: string;
  currency: Currency;
  vatIncluded: boolean;
  stockStatus: StockStatus;
  quantity: number | null;
  validFrom: string;
  validUntil: string | null;
  version: number;
  updatedAt: string;
}

export interface OfferInput {
  branchId?: string | null;
  price: string;
  currency?: Currency;
  vatIncluded?: boolean;
  stockStatus?: StockStatus;
  quantity?: number | null;
  validFrom?: string;
  validUntil?: string | null;
}

export interface ShopProduct {
  id: string;
  productModelId: string;
  description: string | null;
  status: ShopProductStatus;
  version: number;
  updatedAt: string;
  productModel: { id: string; slug: string; brand: string; model: string; status: ModelStatus; nominalPowerW: number | null; inverterAcKw: string | null; batteryCapacityKwh: string | null; category: ModelCard['category'] };
  offers: Offer[];
}

export interface ShopProductsPage {
  items: ShopProduct[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  counts: Partial<Record<ShopProductStatus, number>>;
  rate: ExchangeRate | null;
}

export interface ImportSummary {
  id: string;
  status: 'UPLOADED' | 'VALIDATED' | 'APPLIED' | 'FAILED';
  fileName: string;
  rowCount: number;
  validCount: number;
  errorCount: number;
  errors: Array<{ row: number; column: string; reason: string }>;
  preview: Array<{ row: number; label: string; price: string; currency: Currency; stockStatus: StockStatus; branchId: string | null }>;
  appliedAt: string | null;
  createdAt: string;
}

export interface ImportJobRow {
  id: string;
  fileName: string;
  status: ImportSummary['status'];
  rowCount: number;
  errorCount: number;
  appliedAt: string | null;
  createdAt: string;
}

export interface AdminModel extends ModelCard {
  rejectReason: string | null;
  createdAt: string;
  proposedByShop: { id: string; name: string; slug: string } | null;
  mergedInto: { id: string; slug: string; brand: string; model: string } | null;
  _count: { shopProducts: number };
}
