import { apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { CreatePolicyInput, Policy, PolicyAcceptance, PolicyStatus } from '../types';

export const legalService = {
  list() {
    return apiGet<Policy[] | CursorPage<Policy>>('/legal/policies');
  },
  get(id: string) {
    return apiGet<Policy>(`/legal/policies/${id}`);
  },
  myAcceptances() {
    return apiGet<PolicyAcceptance[] | CursorPage<PolicyAcceptance>>('/legal/my-acceptances');
  },
  accept(id: string) {
    return apiPost<unknown>(`/legal/policies/${id}/accept`);
  },
  adminList(status?: PolicyStatus) {
    return apiGet<Policy[] | CursorPage<Policy>>(`/legal/admin/policies${status ? `?status=${status}` : ''}`);
  },
  create(input: CreatePolicyInput) {
    return apiPost<Policy>('/legal/policies', input);
  },
  update(id: string, input: { title?: string; content?: string }) {
    return apiPatch<Policy>(`/legal/policies/${id}`, input);
  },
  publish(id: string) {
    return apiPost<Policy>(`/legal/policies/${id}/publish`);
  },
};
