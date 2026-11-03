import { apiGet, apiPost } from '@/services/api.client';
import { qs } from '@/features/catalog/catalog.service';
import type { Branch, InvitationResult, MemberUser, Shop, ShopDocType, ShopInvitation, ShopMemberRole, ShopStatus, ShopVerificationStatus } from '@/features/shop/types';

export interface AdminShopRow {
  id: string;
  slug: string;
  name: string;
  stir: string | null;
  phone: string | null;
  status: ShopStatus;
  verificationStatus: ShopVerificationStatus;
  createdSource: 'SELF' | 'ADMIN';
  ratingAvg: string;
  ratingCount: number;
  createdAt: string;
  owner: Pick<MemberUser, 'id' | 'accountNumber' | 'firstName' | 'lastName' | 'phone'> | null;
  _count: { branches: number; products: number; verificationDocs: number };
}

export interface AdminShopDetail extends Shop {
  createdBy: { id: string; accountNumber: number; firstName: string | null; lastName: string | null } | null;
  members: Array<{ id: string; memberRole: ShopMemberRole; permissions: string[]; createdAt: string; user: MemberUser }>;
  invitations: ShopInvitation[];
  verificationDocs: Array<{ id: string; fileId: string; docType: ShopDocType; status: 'PENDING' | 'ACCEPTED' | 'REJECTED'; reason: string | null; createdAt: string }>;
  branches: Branch[];
  _count: { products: number; services: number };
  history: Array<{ id: string; action: string; reason: string | null; createdAt: string; actor: { id: string; accountNumber: number; firstName: string | null; lastName: string | null } | null }>;
}

export interface Duplicates {
  shops: Array<{ id: string; name: string; slug: string; status: ShopStatus; stir: string | null; phone: string | null }>;
  users: Array<{ id: string; accountNumber: number; firstName: string | null; lastName: string | null; createdAt: string }>;
  blocking: boolean;
}

export interface AdminShopFilters {
  search?: string;
  status?: ShopStatus;
  verificationStatus?: ShopVerificationStatus;
  source?: 'SELF' | 'ADMIN';
  page?: number;
}

export const adminShopsService = {
  list: (filters: AdminShopFilters) =>
    apiGet<{ items: AdminShopRow[]; total: number; page: number; pages: number; counts: Partial<Record<ShopStatus, number>> }>(`/admin/shops${qs({ ...filters, limit: 20 })}`),
  detail: (id: string) => apiGet<AdminShopDetail>(`/admin/shops/${id}`),
  duplicates: (stir?: string, phone?: string) => apiGet<Duplicates>(`/admin/shops/duplicates${qs({ stir, phone })}`),
  create: (input: { name: string; phone: string; stir?: string; ownerTarget: string; confirmDuplicates?: boolean; activate?: boolean }) =>
    apiPost<{ shop: Shop; invitation: InvitationResult }>('/admin/shops', input),
  approve: (id: string) => apiPost<Shop>(`/admin/shops/${id}/approve`),
  reject: (id: string, reason: string) => apiPost<Shop>(`/admin/shops/${id}/reject`, { reason }),
  suspend: (id: string, reason: string) => apiPost<Shop>(`/admin/shops/${id}/suspend`, { reason }),
  resume: (id: string) => apiPost<Shop>(`/admin/shops/${id}/resume`),
  inviteOwner: (id: string, target: string) => apiPost<InvitationResult>(`/admin/shops/${id}/owner-invitation`, { target }),
};
