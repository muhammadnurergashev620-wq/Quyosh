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

  /** Xodimlar: ro‘yxat; egasi yangi xodim qo‘shadi (login + vaqtincha parol) va parolini tiklaydi. */
  members: (shopId: string) => apiGet<{ members: ShopMember[] }>(`${base(shopId)}/members`),
  updateMember: (shopId: string, memberId: string, input: { memberRole?: 'MANAGER' | 'STAFF'; permissions?: string[] }) => apiPatch<ShopMember>(`${base(shopId)}/members/${memberId}`, input),
  removeMember: (shopId: string, memberId: string) => apiDelete(`${base(shopId)}/members/${memberId}`),
  addMember: (shopId: string, input: { firstName: string; lastName?: string; login: string; phone?: string; memberRole: 'MANAGER' | 'STAFF'; permissions?: string[] }) =>
    apiPost<{ member: { id: string }; user: { id: string; login?: string | null }; temporaryPassword: string }>(`${base(shopId)}/members`, input),
  resetMemberPassword: (shopId: string, userId: string) =>
    apiPost<{ user: { id: string; login?: string | null }; temporaryPassword: string }>(`${base(shopId)}/members/${userId}/reset-password`, {}),

  branches: (shopId: string) => apiGet<Branch[]>(`${base(shopId)}/branches`),
  createBranch: (shopId: string, input: BranchInput) => apiPost<Branch>(`${base(shopId)}/branches`, input),
  updateBranch: (shopId: string, id: string, input: BranchInput & { version: number }) => apiPut<Branch>(`${base(shopId)}/branches/${id}`, input),
  archiveBranch: (shopId: string, id: string) => apiDelete(`${base(shopId)}/branches/${id}`),

  services: (shopId: string) => apiGet<ShopServiceRow[]>(`${base(shopId)}/services`),
  createService: (shopId: string, input: ServiceInput) => apiPost<ShopServiceRow>(`${base(shopId)}/services`, input),
  updateService: (shopId: string, id: string, input: ServiceInput) => apiPut<ShopServiceRow>(`${base(shopId)}/services/${id}`, input),
  deleteService: (shopId: string, id: string) => apiDelete(`${base(shopId)}/services/${id}`),
};
