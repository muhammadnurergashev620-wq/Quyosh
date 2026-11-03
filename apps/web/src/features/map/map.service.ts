import { apiGet, apiDelete, apiPatch, apiPost, apiPut } from '@/services/api.client';
import { qs } from '@/features/catalog/catalog.service';
import type { ServiceType } from '@/features/shop/types';
import type { LngLat } from './geometry';

export interface MapCluster { lat: number; lon: number; count: number; branchId: string | null }
export interface MapMarker { branchId: string; branchName: string; lat: number; lon: number; shop: { id: string; slug: string; name: string; ratingAvg: string; ratingCount: number; logoAssetId: string | null } }
export type MapShopsResponse = { mode: 'clusters'; items: MapCluster[] } | { mode: 'markers'; truncated: boolean; items: MapMarker[] };
export interface ShopCard { id: string; slug: string; name: string; ratingAvg: string; ratingCount: number; avgResponseMinutes: number | null; serviceTypes: ServiceType[]; productCount: number; branches: Array<{ id: string; name: string; address: string }> }
export interface ServingShop { id: string; slug: string; name: string; ratingAvg: string; ratingCount: number; distanceKm: number }

export type SiteType = 'HOUSE' | 'BUSINESS' | 'WAREHOUSE' | 'GARAGE' | 'OTHER';
export type AreaType = 'ROOF' | 'GROUND' | 'CARPORT';
export type RoofShape = 'FLAT' | 'PITCHED';
export type ShadingLevel = 'NONE' | 'LIGHT' | 'HEAVY';
export interface PolygonGeo { type: 'Polygon'; coordinates: number[][][] }

export interface SiteSummary { id: string; title: string; siteType: SiteType; address: string | null; regionCode: string | null; lat: number; lon: number; areaCount: number; usableAreaM2: string; createdAt: string }
export interface SiteArea {
  id: string; name: string; areaType: AreaType; roofShape: RoofShape; projectedAreaM2: string; surfaceAreaM2: string; usableFactor: string; usableAreaM2: string;
  azimuthDeg: number | null; tiltDeg: string | null; shadingLevel: ShadingLevel; polygon: PolygonGeo | null;
}
export interface SiteDetail extends Omit<SiteSummary, 'areaCount' | 'usableAreaM2'> { notes: string | null; outsideUzbekistan: boolean; areas: SiteArea[] }
export interface AreaInput { name?: string; areaType?: AreaType; roofShape?: RoofShape; polygon?: PolygonGeo; tiltDeg?: number | null; azimuthDeg?: number | null; shadingLevel?: ShadingLevel; usableFactor?: number }
export interface GeocodeResult { label: string; lat: number; lon: number }

export interface ServiceAreaInfo { id: string; areaKm2: string; serviceTypes: ServiceType[]; active: boolean; geometry: { type: 'MultiPolygon'; coordinates: number[][][][] } }

export const mapService = {
  shops: (bbox: { west: number; south: number; east: number; north: number }, zoom: number, serviceType?: ServiceType) =>
    apiGet<MapShopsResponse>(`/map/shops${qs({ ...bbox, zoom: Math.round(zoom), serviceType })}`),
  card: (shopId: string) => apiGet<ShopCard>(`/map/shops/${shopId}`),
  serving: (point: LngLat, serviceType?: ServiceType) => apiGet<ServingShop[]>(`/map/shops/serving${qs({ lat: point[1], lon: point[0], serviceType })}`),
  geocode: (q: string, lang: 'uz' | 'ru') => apiPost<GeocodeResult[]>('/geocoding/search', { q, lang }),

  sites: () => apiGet<SiteSummary[]>('/sites'),
  site: (id: string) => apiGet<SiteDetail>(`/sites/${id}`),
  createSite: (input: { title: string; siteType: SiteType; address?: string; notes?: string; lat: number; lon: number }) => apiPost<SiteDetail>('/sites', input),
  updateSite: (id: string, input: Partial<{ title: string; siteType: SiteType; address: string; notes: string; lat: number; lon: number }>) => apiPatch<SiteDetail>(`/sites/${id}`, input),
  archiveSite: (id: string) => apiPost(`/sites/${id}/archive`),
  addArea: (siteId: string, input: AreaInput & { name: string; polygon: PolygonGeo }) => apiPost<SiteArea>(`/sites/${siteId}/areas`, input),
  updateArea: (siteId: string, areaId: string, input: AreaInput) => apiPatch<SiteArea>(`/sites/${siteId}/areas/${areaId}`, input),
  deleteArea: (siteId: string, areaId: string) => apiDelete(`/sites/${siteId}/areas/${areaId}`),

  serviceArea: (shopId: string, branchId: string) => apiGet<ServiceAreaInfo | null>(`/manage/shops/${shopId}/branches/${branchId}/service-area`),
  putServiceArea: (shopId: string, branchId: string, input: { geometry?: PolygonGeo; radiusKm?: number; serviceTypes?: ServiceType[] }) =>
    apiPut<ServiceAreaInfo & { geometry: ServiceAreaInfo['geometry'] }>(`/manage/shops/${shopId}/branches/${branchId}/service-area`, input),
  deleteServiceArea: (shopId: string, branchId: string) => apiDelete(`/manage/shops/${shopId}/branches/${branchId}/service-area`),
};
