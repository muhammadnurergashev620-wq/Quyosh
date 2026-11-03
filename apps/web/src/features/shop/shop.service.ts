import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/services/api.client';
import type {
  Branch, BranchInput, InvitationPreview, InvitationResult, ManagedShop, MyShop, Shop, ShopDocType, ShopInvitation, ShopMember, ShopMemberRole, ShopService as ShopServiceRow, ServiceInput, ServiceType, VerificationDocument,
} from './types';

const base = (shopId: string) => `/manage/shops/${shopId}`;

export interface CreateShopInput {
  name: string;
  phone: string;
  stir?: string;
  activities?: ServiceType[];
}

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
  create: (input: CreateShopInput) => apiPost<Shop>('/shops', input),
  get: (shopId: string) => apiGet<ManagedShop>(base(shopId)),
  update: (shopId: string, input: UpdateShopInput) => apiPatch<Shop>(base(shopId), input),

  documents: (shopId: string) => apiGet<VerificationDocument[]>(`${base(shopId)}/verification-documents`),
  addDocument: (shopId: string, fileId: string, docType: ShopDocType) => apiPost<VerificationDocument>(`${base(shopId)}/verification-documents`, { fileId, docType }),
  submit: (shopId: string) => apiPost<Shop>(`${base(shopId)}/submit`),

  members: (shopId: string) => apiGet<{ members: ShopMember[]; invitations: ShopInvitation[] }>(`${base(shopId)}/members`),
  invite: (shopId: string, input: { target: string; memberRole: Exclude<ShopMemberRole, 'OWNER'>; permissions?: string[] }) =>
    apiPost<InvitationResult>(`${base(shopId)}/members/invitations`, input),
  revokeInvitation: (shopId: string, id: string) => apiDelete(`${base(shopId)}/members/invitations/${id}`),
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

  previewInvitation: (token: string) => apiGet<InvitationPreview>(`/shop-invitations/${encodeURIComponent(token)}`),
  acceptInvitation: (token: string) => apiPost<{ shopId: string; memberRole: ShopMemberRole }>(`/shop-invitations/${encodeURIComponent(token)}/accept`),
};
