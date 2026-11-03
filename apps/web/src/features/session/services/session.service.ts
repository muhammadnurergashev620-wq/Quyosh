import { apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { Me } from '../types';

export const sessionService = {
  updateName(input: { firstName: string; lastName: string }) {
    return apiPatch<Me>('/users/me/name', input);
  },
  setTwoFactor(input: { enabled: boolean; password?: string }) {
    return apiPatch<Me>('/users/me/two-factor', input);
  },
  setEmail(input: { email: string; password?: string }) {
    return apiPatch<Me>('/users/me/email', input);
  },
  deleteAccount(password?: string) {
    return apiPost<{ deleted: true }>('/users/me/delete-account', { password });
  },
  changePassword(input: { currentPassword: string; newPassword: string }) {
    return apiPost<{ changed: true; revokedSessions: number }>('/users/me/password/change', input);
  },
  setPassword(password: string) {
    return apiPost<Me>('/users/me/password', { password });
  },
  linkGoogle(credential: string) {
    return apiPost<{ linked: true; googleEmail: string | null }>('/auth/google/link', { credential });
  },
  unlinkGoogle() {
    return apiPost<{ linked: false }>('/auth/google/unlink');
  },
  requestPhone(phone: string) {
    return apiPost<{ developmentCode?: string }>('/users/me/phone/request', { phone });
  },
  verifyPhone(phone: string, code: string) {
    return apiPost<Me>('/users/me/phone/verify', { phone, code });
  },
  me() {
    return apiGet<Me>('/users/me');
  },
};
