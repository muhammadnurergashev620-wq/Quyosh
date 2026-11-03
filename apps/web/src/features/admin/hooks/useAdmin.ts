import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import type { DateRange } from '../services/admin.service';
import type { AuditFilters, CreateAdminInput, DevOpsWindow, UserFilters } from '../types';

export function useDashboard(range: DateRange) {
  return useQuery({ queryKey: ['admin', 'dashboard', range], queryFn: () => adminService.dashboard(range) });
}

export function useDevOps(window: DevOpsWindow) {
  return useQuery({
    queryKey: ['admin', 'devops', window],
    queryFn: () => adminService.devops(window),
    refetchInterval: 15_000,
  });
}

export function useAdminUsers(filters: UserFilters) {
  return useInfiniteQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: ({ pageParam }: { pageParam?: string }) => adminService.users(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useAdminUsersPage(filters: UserFilters, page: number) {
  return useQuery({ queryKey: ['admin', 'users', 'page', filters, page], queryFn: () => adminService.usersPage(filters, page), placeholderData: keepPreviousData });
}

export function useAdminUserStats() {
  return useQuery({ queryKey: ['admin', 'users', 'stats'], queryFn: () => adminService.userStats(), staleTime: 15_000 });
}

export function useBulkUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status, reason }: { ids: string[]; status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED'; reason?: string }) => adminService.bulkUserStatus(ids, status, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user-number'] });
    },
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED'; reason?: string }) =>
      adminService.setUserStatus(id, status, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user-number'] });
    },
  });
}

/** Faqat administrator: saqlangan parolni ko‘rsatadi (har bir ko‘rish auditga yoziladi). */
export function useSetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password, reason }: { id: string; password: string; reason?: string }) => adminService.setUserPassword(id, password, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSetUserTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => adminService.setUserTwoFactor(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useSetRegistrationBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, blocked, reason }: { id: string; blocked: boolean; reason?: string }) => adminService.setRegistrationBlock(id, blocked, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminService.deleteUser(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user-number'] });
    },
  });
}

export function useAuditLogs(filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: ({ pageParam }: { pageParam?: string }) => adminService.audit(filters, pageParam),
    refetchInterval: 30_000,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminService.user(id ?? ''), enabled: !!id });
}

export function useAuditPage(filters: AuditFilters, page: number, limit: number) {
  return useQuery({ queryKey: ['admin', 'audit', 'page', filters, page, limit], queryFn: () => adminService.auditPage(filters, page, limit), placeholderData: keepPreviousData, refetchInterval: 30_000 });
}

export function useAuditStats(filters: AuditFilters) {
  const { actorRole: _ignored, ...rest } = filters;
  return useQuery({ queryKey: ['admin', 'audit-stats', rest], queryFn: () => adminService.auditStats(rest), refetchInterval: 30_000 });
}

export function useAuditRelated(id: string | null) {
  return useQuery({ queryKey: ['admin', 'audit-related', id], queryFn: () => adminService.auditRelated(id as string), enabled: !!id });
}

export function useAuditSummary(filters: AuditFilters) {
  const { actorRole: _ignored, ...rest } = filters;
  return useQuery({ queryKey: ['admin', 'audit-summary', rest], queryFn: () => adminService.auditSummary(rest), refetchInterval: 30_000 });
}

export function useAdminUserByNumber(accountNumber: number | null) {
  return useQuery({ queryKey: ['admin', 'user-number', accountNumber], queryFn: () => adminService.userByNumber(accountNumber as number), enabled: accountNumber !== null, retry: false });
}

/** Adminlar ro‘yxati (faqat superadmin). Kalit ['admin','users',…] ostida: foydalanuvchi amallari (muzlatish/o‘chirish/parol) ro‘yxatni avtomatik yangilaydi. */
export function useAdminAccounts(enabled = true) {
  return useQuery({ queryKey: ['admin', 'users', 'admins'], queryFn: () => adminService.admins(), enabled });
}

export function useAdminMyProfile() {
  return useQuery({ queryKey: ['admin', 'my-profile'], queryFn: () => adminService.myProfile(), refetchInterval: 60_000 });
}

export function useAdminAccountDetails(id: string | null) {
  return useQuery({ queryKey: ['admin', 'users', 'admin-details', id], queryFn: () => adminService.adminDetails(id as string), enabled: !!id });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdminInput) => adminService.createAdmin(input),
    gcTime: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSetAdminDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, canCreateAdmins, grantablePermissions }: { id: string; canCreateAdmins: boolean; grantablePermissions: string[] }) => adminService.setAdminDelegation(id, canCreateAdmins, grantablePermissions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSetSuperAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => adminService.setSuperAdmin(id, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSetAdminPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) => adminService.setAdminPermissions(id, permissions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
