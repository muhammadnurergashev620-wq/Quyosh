import { apiGet, apiPost } from '@/services/api.client';
import type { ErrorFilters, ErrorGroup, ErrorGroupDetail, ErrorGroupsPage, ErrorGroupsPageFilters, ErrorOverview, ErrorPage, ErrorSummary } from './types';

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const errorLogService = {
  list(filters: ErrorFilters, page: number) {
    return apiGet<ErrorPage>(`/admin/errors${qs({ ...filters, page: String(page), limit: '25' })}`);
  },
  summary() {
    return apiGet<ErrorSummary>('/admin/errors/summary');
  },
  groups(days: number, filter: Pick<ErrorFilters, 'status' | 'statusClass' | 'state'> = {}) {
    return apiGet<ErrorGroup[]>(`/admin/errors/groups${qs({ days: String(days), status: filter.status, statusClass: filter.statusClass, state: filter.state })}`);
  },
  overview(range: { from?: string; to?: string }) {
    return apiGet<ErrorOverview>(`/admin/errors/overview${qs(range)}`);
  },
  groupsPage(filters: ErrorGroupsPageFilters, page: number, limit: number) {
    return apiGet<ErrorGroupsPage>(`/admin/errors/groups/page${qs({ ...filters, page: String(page), limit: String(limit) })}`);
  },
  groupDetail(fingerprint: string) {
    return apiGet<ErrorGroupDetail>(`/admin/errors/groups/${fingerprint}`);
  },
  resolve(input: { ids?: string[]; fingerprint?: string }, value: boolean) {
    return apiPost<{ updated: number }>('/admin/errors/resolve', { ...input, value });
  },
};
