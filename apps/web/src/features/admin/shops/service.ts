import { apiDelete, apiGet, apiPost } from '@/services/api.client';
import { qs } from '@/features/catalog/catalog.service';
import type { Branch, MemberUser, Shop, ShopMemberRole, ShopStatus, ShopVerificationStatus } from '@/features/shop/types';

export type BadgeType = 'OFFICIAL_DEALER' | 'CERTIFIED_INSTALLER' | 'LICENSE';

export interface ShopBadge {
  id: string;
  certType: BadgeType;
  brand: string | null;
  issuer: string;
  certNumber: string | null;
  validFrom: string;
  validUntil: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
}

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
  _count: { branches: number; products: number };
}

export interface AdminShopDetail extends Shop {
  createdBy: { id: string; accountNumber: number; firstName: string | null; lastName: string | null } | null;
  members: Array<{ id: string; memberRole: ShopMemberRole; permissions: string[]; createdAt: string; user: MemberUser }>;
  certifications: ShopBadge[];
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
  page?: number;
}

export interface CreateShopInput {
  name: string;
  stir: string;
  phone: string;
  regionCode: string;
  address: string;
  ownerFirstName: string;
  ownerLastName?: string;
  ownerPhone: string;
  confirmDuplicates?: boolean;
}

export interface AddMemberInput {
  firstName: string;
  lastName?: string;
  phone: string;
  memberRole: 'MANAGER' | 'STAFF';
  permissions?: string[];
}

type AccountUser = Pick<MemberUser, 'id' | 'phone' | 'firstName' | 'lastName'>;

/** Vaqtincha parol javobda BIR MARTA keladi — saqlanmaydi, keshlanmaydi (react-query `gcTime: 0` bilan ishlating). */
export interface IssuedPassword {
  temporaryPassword: string;
}

export const adminShopsService = {
  list: (filters: AdminShopFilters) =>
    apiGet<{ items: AdminShopRow[]; total: number; page: number; pages: number; counts: Partial<Record<ShopStatus, number>> }>(`/admin/shops${qs({ ...filters, limit: 20 })}`),
  detail: (id: string) => apiGet<AdminShopDetail>(`/admin/shops/${id}`),
  duplicates: (stir?: string, phone?: string) => apiGet<Duplicates>(`/admin/shops/duplicates${qs({ stir, phone })}`),
  create: (input: CreateShopInput) => apiPost<{ shop: Shop; owner: AccountUser } & IssuedPassword>('/admin/shops', input),
  addMember: (id: string, input: AddMemberInput) => apiPost<{ member: { id: string }; user: AccountUser } & IssuedPassword>(`/admin/shops/${id}/members`, input),
  resetPassword: (id: string, userId: string) => apiPost<{ user: AccountUser; revokedSessions: number } & IssuedPassword>(`/admin/shops/${id}/members/${userId}/reset-password`),
  changeOwner: (id: string, userId: string, reason: string) => apiPost<{ shopId: string; ownerUserId: string }>(`/admin/shops/${id}/owner`, { userId, reason }),
  suspend: (id: string, reason: string) => apiPost<Shop>(`/admin/shops/${id}/suspend`, { reason }),
  resume: (id: string) => apiPost<Shop>(`/admin/shops/${id}/resume`),
  addBadge: (id: string, input: { certType: BadgeType; brand?: string; certNumber?: string; validUntil?: string }) => apiPost<ShopBadge>(`/admin/shops/${id}/badges`, input),
  removeBadge: (id: string, badgeId: string) => apiDelete(`/admin/shops/${id}/badges/${badgeId}`),
};
