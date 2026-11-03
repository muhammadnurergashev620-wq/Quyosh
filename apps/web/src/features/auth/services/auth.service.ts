import { apiGet, apiPost } from '@/services/api.client';
import { fetchRequiredPolicyIds } from '@/config/policies';
import type {
  DeviceSession,
  GoogleSignInResult,
  LoginInput,
  LoginResult,
  RegisterInput,
  RegisterResult,
  VerifyOtpInput,
  VerifyOtpResult,
  VerifyRegistrationResult,
} from '../types';

export const authService = {
  async register(input: RegisterInput) {
    return apiPost<RegisterResult>('/auth/register', { ...input, acceptedPolicyIds: await fetchRequiredPolicyIds() });
  },
  verifyRegistration(phone: string, code: string) {
    return apiPost<VerifyRegistrationResult>('/auth/verify-registration', { phone, code });
  },
  resendRegistration(phone: string) {
    return apiPost<{ verificationRequired: true; developmentCode?: string }>('/auth/resend-registration', { phone });
  },
  googleSignIn(token: { credential: string } | { accessToken: string }) {
    return apiPost<GoogleSignInResult>('/auth/google', token);
  },
  async googleRegister(signupToken: string, phone: string) {
    return apiPost<{ verificationRequired: false }>('/auth/google/register', { signupToken, phone, acceptedPolicyIds: await fetchRequiredPolicyIds() });
  },
  login(input: LoginInput) {
    return apiPost<LoginResult>('/auth/login', input);
  },
  verifyOtp(input: VerifyOtpInput) {
    return apiPost<VerifyOtpResult>('/auth/verify-otp', input);
  },
  refresh() {
    return apiPost<{ userId: string; deviceId: string }>('/auth/refresh');
  },
  logout(allDevices: boolean) {
    return apiPost<{ signedOut: boolean; allDevices: boolean }>('/auth/logout', { allDevices });
  },
  listSessions() {
    return apiGet<DeviceSession[]>('/auth/sessions');
  },
  revokeSession(sessionId: string) {
    return apiPost<{ revoked: boolean }>(`/auth/sessions/${sessionId}/revoke`);
  },
  revokeOtherSessions() {
    return apiPost<{ revoked: number }>('/auth/sessions/revoke-others');
  },
};
