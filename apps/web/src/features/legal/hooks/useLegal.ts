import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toItems } from '@/lib/list';
import { legalService } from '../services/legal.service';
import type { CreatePolicyInput } from '../types';

export function usePolicies() {
  return useQuery({ queryKey: ['legal', 'policies'], queryFn: async () => toItems(await legalService.list()) });
}

export function usePolicy(id: string | null) {
  return useQuery({ queryKey: ['legal', 'policy', id], queryFn: () => legalService.get(id as string), enabled: !!id });
}

export function useMyAcceptances() {
  return useQuery({ queryKey: ['legal', 'acceptances'], queryFn: async () => toItems(await legalService.myAcceptances()) });
}

export function useAcceptPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => legalService.accept(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['legal', 'acceptances'] }),
  });
}

export function useAdminPolicies() {
  return useQuery({ queryKey: ['legal', 'admin'], queryFn: async () => toItems(await legalService.adminList()) });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePolicyInput) => legalService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['legal'] }),
  });
}

export function usePublishPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => legalService.publish(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['legal'] }),
  });
}
