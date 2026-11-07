import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/services/api.client';
import type { DashboardOverview } from './types';

export function useDashboardOverview(days: number) {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'overview', days],
    queryFn: () => apiGet<DashboardOverview>(`/admin/dashboard/overview?days=${days}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}
