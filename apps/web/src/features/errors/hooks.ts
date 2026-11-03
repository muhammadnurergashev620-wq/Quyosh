import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '@/lib/error-messages';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import { errorLogService } from './service';
import type { ErrorFilters, ErrorGroupsPageFilters } from './types';

export function useErrorSummary() {
  return useQuery({ queryKey: ['admin', 'errors', 'summary'], queryFn: () => errorLogService.summary(), refetchInterval: 30_000 });
}

export function useErrorGroups(days: number, filter: Pick<ErrorFilters, 'status' | 'statusClass' | 'state'>, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'errors', 'groups', days, filter],
    queryFn: () => errorLogService.groups(days, filter),
    enabled,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useErrorList(filters: ErrorFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['admin', 'errors', 'list', filters],
    queryFn: ({ pageParam }: { pageParam: number }) => errorLogService.list(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useErrorOverview(range: { from?: string; to?: string }) {
  return useQuery({ queryKey: ['admin', 'errors', 'overview', range], queryFn: () => errorLogService.overview(range), refetchInterval: 30_000, placeholderData: keepPreviousData });
}

export function useErrorGroupsPage(filters: ErrorGroupsPageFilters, page: number, limit: number) {
  return useQuery({ queryKey: ['admin', 'errors', 'groups-page', filters, page, limit], queryFn: () => errorLogService.groupsPage(filters, page, limit), refetchInterval: 30_000, placeholderData: keepPreviousData });
}

export function useErrorGroupDetail(fingerprint: string | null) {
  return useQuery({ queryKey: ['admin', 'errors', 'group-detail', fingerprint], queryFn: () => errorLogService.groupDetail(fingerprint as string), enabled: !!fingerprint });
}

/** `value: true` — hal qilindi deb belgilash, `false` — qayta ochish. */
export function useResolveErrors() {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  return useMutation({
    mutationFn: ({ ids, fingerprint, value }: { ids?: string[]; fingerprint?: string; value: boolean }) => errorLogService.resolve({ ids, fingerprint }, value),
    onSuccess: (result, { value }) => {
      pushToast(value ? `${t('Hal qilindi deb belgilandi')}: ${result.updated}` : `${t('Qayta ochildi')}: ${result.updated}`, 'success');
      return queryClient.invalidateQueries({ queryKey: ['admin', 'errors'] });
    },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
}
