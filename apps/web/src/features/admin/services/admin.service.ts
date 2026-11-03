import { apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { AdminBadges, AdminAccount, AdminScope, AdminUserDetail, AdminUser, CreateAdminInput, AuditFilters, AuditPage, AuditRelated, AuditStats, AuditSummary, AuditLog, Dashboard, AdminAccountDetails, AdminMyProfile, AdminAccountsStats, AdminUserStats, AdminUsersPage, DevOpsSnapshot, DevOpsWindow, UserFilters } from '../types';

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export interface ReportPaymentsParams extends DateRange {
  search?: string;
  provider?: string;
  status?: string;
  sort?: string;
  dir?: string;
  page?: number;
  limit?: number;
}

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

export const adminService = {
  dashboard(range: DateRange) {
    return apiGet<Dashboard>(`/admin/dashboard${qs({ ...range })}`);
  },
  devops(window: DevOpsWindow) {
    return apiGet<DevOpsSnapshot>(`/admin/devops${qs({ window })}`);
  },
  users(filters: UserFilters, cursor?: string) {
    return apiGet<CursorPage<AdminUser>>(`/admin/users${qs({ ...filters, cursor, limit: '20' })}`);
  },
  usersPage(filters: UserFilters, page: number, limit = 20) {
    return apiGet<AdminUsersPage>(`/admin/users${qs({ ...filters, page: String(page), limit: String(limit) })}`);
  },
  userStats() {
    return apiGet<AdminUserStats>('/admin/users/stats');
  },
  bulkUserStatus(ids: string[], status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED', reason?: string) {
    return apiPost<{ updated: number; failed: Array<{ id: string; message: string }> }>('/admin/users/bulk-status', { ids, status, reason: reason || undefined });
  },
  setUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED', reason?: string) {
    return apiPatch<AdminUser>(`/admin/users/${id}/status`, { status, reason });
  },
  setUserPassword(id: string, password: string, reason?: string) {
    return apiPost<{ updated: boolean }>(`/admin/users/${id}/password`, { password, reason: reason || undefined });
  },
  setUserTwoFactor(id: string, enabled: boolean) {
    return apiPatch<{ twoFactorEnabled: boolean }>(`/admin/users/${id}/two-factor`, { enabled });
  },
  setRegistrationBlock(id: string, blocked: boolean, reason?: string) {
    return apiPost<{ registrationBlocked: boolean }>(`/admin/users/${id}/${blocked ? 'registration-block' : 'registration-unblock'}`, { reason });
  },

  admins() {
    return apiGet<{ items: AdminAccount[]; scope: AdminScope; stats: AdminAccountsStats }>('/admin/admins');
  },
  myProfile() {
    return apiGet<AdminMyProfile>('/admin/me/profile');
  },
  adminDetails(id: string) {
    return apiGet<AdminAccountDetails>(`/admin/admins/${id}/details`);
  },
  createAdmin(input: CreateAdminInput) {
    return apiPost<AdminAccount>('/admin/admins', input);
  },
  setAdminPermissions(id: string, permissions: string[]) {
    return apiPatch<{ permissions: string[] }>(`/admin/admins/${id}/permissions`, { permissions });
  },
  setAdminDelegation(id: string, canCreateAdmins: boolean, grantablePermissions: string[]) {
    return apiPatch<{ canCreateAdmins: boolean; grantablePermissions: string[] }>(`/admin/admins/${id}/delegation`, { canCreateAdmins, grantablePermissions });
  },
  setSuperAdmin(id: string, value: boolean) {
    return apiPatch<{ isSuperAdmin: boolean }>(`/admin/admins/${id}/super`, { value });
  },

  deleteUser(id: string, reason: string) {
    return apiPost<{ deleted: boolean }>(`/admin/users/${id}/delete`, { reason });
  },
  userByNumber(accountNumber: number) {
    return apiGet<AdminUserDetail>(`/admin/users/by-number/${accountNumber}`);
  },
  user(id: string) {
    return apiGet<AdminUserDetail>(`/admin/users/${id}`);
  },
  badges(since: Record<string, string | undefined>) {
    return apiGet<AdminBadges>(`/admin/badges${qs(since)}`);
  },
  audit(filters: AuditFilters, cursor?: string) {
    return apiGet<CursorPage<AuditLog>>(`/audit-logs${qs({ limit: '30', ...filters, actorNumber: filters.actorNumber ? String(filters.actorNumber) : undefined, cursor })}`);
  },
  auditPage(filters: AuditFilters, page: number, limit = 20) {
    return apiGet<AuditPage>(`/audit-logs${qs({ ...filters, page: String(page), limit: String(limit), actorNumber: filters.actorNumber ? String(filters.actorNumber) : undefined })}`);
  },
  auditStats(filters: AuditFilters) {
    return apiGet<AuditStats>(`/audit-logs/stats${qs({ ...filters, actorRole: undefined, actorNumber: filters.actorNumber ? String(filters.actorNumber) : undefined })}`);
  },
  auditRelated(id: string) {
    return apiGet<AuditRelated>(`/audit-logs/${id}/related`);
  },
  auditSummary(filters: AuditFilters) {
    return apiGet<AuditSummary>(`/audit-logs/summary${qs({ ...filters, actorRole: undefined, actorNumber: filters.actorNumber ? String(filters.actorNumber) : undefined })}`);
  },
};
