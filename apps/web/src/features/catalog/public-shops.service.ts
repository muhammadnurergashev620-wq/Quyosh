import { apiGet } from '@/services/api.client';
import { qs } from './catalog.service';
import type { Currency, I18nText, PricingModel, ServiceType, StockStatus } from '@/features/shop/types';

export interface PublicCert { certType: 'OFFICIAL_DEALER' | 'CERTIFIED_INSTALLER' | 'LICENSE'; brand: string | null; issuer?: string; validUntil?: string | null }

export interface PublicShopCard {
  certifications?: PublicCert[];
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoAssetId: string | null;
  coverAssetId: string | null;
  ratingAvg: string;
  ratingCount: number;
  avgResponseMinutes: number | null;
  verificationStatus: string;
  serviceTypes: ServiceType[];
  branches: Array<{ regionCode: string | null; address: string }>;
  productCount: number;
}

export interface PublicShopProfile extends Omit<PublicShopCard, 'serviceTypes' | 'branches'> {
  phoneMasked: string | null;
  branches: Array<{ id: string; name: string; address: string; regionCode: string | null; phone: string | null; openingHoursJson: Partial<Record<string, Array<[string, string]>>> | null; status: string }>;
  services: Array<{ id: string; serviceType: ServiceType; pricingModel: PricingModel; price: string | null; currency: Currency; descriptionI18n: Partial<I18nText> | null; warrantyMonths: number | null; branchId: string | null }>;
}

export interface PublicShopProduct {
  id: string;
  description: string | null;
  productModel: { id: string; slug: string; brand: string; model: string; nominalPowerW: number | null; efficiencyPct: string | null; inverterAcKw: string | null; batteryCapacityKwh: string | null; batteryChemistry: string | null; batteryCycles: number | null; warrantyMonths: number | null; category: { id: string; slug: string; nameI18n: I18nText } };
  offers: Array<{ id: string; price: string; currency: Currency; stockStatus: StockStatus; vatIncluded: boolean; branch: { id: string; name: string } | null }>;
}

export const publicShopsService = {
  list: (params: { search?: string; service?: ServiceType; region?: string; sort?: string; cursor?: string; cert?: string }) =>
    apiGet<{ items: PublicShopCard[]; nextCursor: string | null }>(`/shops${qs({ ...params, limit: 18 })}`),
  profile: (slug: string) => apiGet<PublicShopProfile>(`/shops/${encodeURIComponent(slug)}`),
  contact: (slug: string) => apiGet<{ phone: string | null; email: string | null }>(`/shops/${encodeURIComponent(slug)}/contact`),
  products: (slug: string, page: number) => apiGet<{ items: PublicShopProduct[]; total: number; page: number; pages: number }>(`/shops/${encodeURIComponent(slug)}/products${qs({ page })}`),
};
