import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/services/api.client';
import type { Branch, BranchInput, ManagedShop, MyShop, Shop, ShopMember, ShopService as ShopServiceRow, ServiceInput } from './types';

const base = (shopId: string) => `/manage/shops/${shopId}`;

export interface UpdateShopInput {
  name?: string;
  description?: string;
  phone?: string;
  email?: string;
  stir?: string;
  logoAssetId?: string;
  coverAssetId?: string;
}

export const shopService = {
  myShops: () => apiGet<MyShop[]>('/me/shops'),
  get: (shopId: string) => apiGet<ManagedShop>(base(shopId)),
  update: (shopId: string, input: UpdateShopInput) => apiPatch<Shop>(base(shopId), input),

  /** Xodimlar ro‘yxati; xodimni faqat admin qo‘shadi (v3.1). */
  members: (shopId: string) => apiGet<{ members: ShopMember[] }>(`${base(shopId)}/members`),
  updateMember: (shopId: string, memberId: string, input: { memberRole?: 'MANAGER' | 'STAFF'; permissions?: string[] }) => apiPatch<ShopMember>(`${base(shopId)}/members/${memberId}`, input),
  removeMember: (shopId: string, memberId: string) => apiDelete(`${base(shopId)}/members/${memberId}`),

  branches: (shopId: string) => apiGet<Branch[]>(`${base(shopId)}/branches`),
  createBranch: (shopId: string, input: BranchInput) => apiPost<Branch>(`${base(shopId)}/branches`, input),
  updateBranch: (shopId: string, id: string, input: BranchInput & { version: number }) => apiPut<Branch>(`${base(shopId)}/branches/${id}`, input),
  archiveBranch: (shopId: string, id: string) => apiDelete(`${base(shopId)}/branches/${id}`),

  services: (shopId: string) => apiGet<ShopServiceRow[]>(`${base(shopId)}/services`),
  createService: (shopId: string, input: ServiceInput) => apiPost<ShopServiceRow>(`${base(shopId)}/services`, input),
  updateService: (shopId: string, id: string, input: ServiceInput) => apiPut<ShopServiceRow>(`${base(shopId)}/services/${id}`, input),
  deleteService: (shopId: string, id: string) => apiDelete(`${base(shopId)}/services/${id}`),
};
