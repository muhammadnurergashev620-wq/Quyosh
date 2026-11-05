import { unregisterPushToken } from '@/features/push/push-native';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import type { LoginInput, RegisterInput, VerifyOtpInput } from '../types';
import { useAuthStore } from '@/store/auth.store';
import { loginSecret } from '../login-secret';
import { useAppStore } from '@/store/app.store';
import { SESSION_EXPIRED_EVENT } from '@/services/api.client';
import { t } from '@/i18n';

export function useRegister() {
  const setPendingPhone = useAuthStore((s) => s.setPendingPhone);
  const setDevCode = useAuthStore((s) => s.setDevCode);
  return useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
    // Parol (variables) mutatsiya keshida qolib ketmasin.
    gcTime: 0,
    onSuccess: (result, variables) => {
      setPendingPhone(variables.phone);
      setDevCode(result.developmentCode ?? null);
      // Parol faqat xotirada va faqat bir marta ko‘rsatish uchun; mavjud akkaunt bo‘lsa — umuman saqlanmaydi.
      useAuthStore.getState().setNewCredentials(result.existingAccount ? null : { phone: variables.phone, password: variables.password });
    },
  });
}

export function useVerifyRegistration() {
  const pushToast = useAppStore((s) => s.pushToast);
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) => authService.verifyRegistration(phone, code),
    // pendingPhone bu yerda tozalanmaydi: aks holda OTP sahifasi login/parol kartasini ko‘rsatishga ulgurmay, ro‘yxatdan o‘tish sahifasiga qaytarib yuboradi.
    // U sahifaning o‘zida («Kirishga o‘tish» bosilganda) tozalanadi.
    onSuccess: () => {
      pushToast(t('Ro‘yxatdan o‘tish tasdiqlandi. Endi tizimga kiring.'), 'success');
    },
  });
}

export function useLogin() {
  const setPendingPhone = useAuthStore((s) => s.setPendingPhone);
  const setDevCode = useAuthStore((s) => s.setDevCode);
  const setDeviceLimit = useAuthStore((s) => s.setDeviceLimit);
  return useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    gcTime: 0,
    onSuccess: (result, variables) => {
      if (!result.verificationRequired) {
        // Ikki bosqichli autentifikatsiya o‘chirilgan: sessiya ochildi, OTP bosqichi yo‘q.
        loginSecret.clear();
        useAuthStore.getState().setSession(true);
        setPendingPhone(null);
        setDevCode(null);
        setDeviceLimit(null);
        useAuthStore.getState().setDelivery(null, false);
        return;
      }
      // OTP bosqichi faqat telefon bilan kirishda bo‘ladi (login bilan kirishda sessiya darhol ochiladi).
      const phone = variables.phone ?? '';
      loginSecret.set(phone, variables.password);
      setPendingPhone(phone);
      if (result.codeReused) {
        // Yangi kod yuborilmadi: oldingi kod (va uning ekrandagi dev ko‘rinishi) amal qiladi.
        useAuthStore.getState().setResendIn(result.resendIn ?? null);
      } else {
        useAuthStore.getState().setResendIn(null);
        setDevCode(result.developmentCode ?? null);
        useAuthStore.getState().setDelivery(result.delivery ?? null, result.smsAvailable === true);
      }
      setDeviceLimit(result.deviceLimit ? { max: result.deviceLimit.max, active: result.deviceLimit.active } : null);
    },
  });
}

export function useVerifyOtp() {
  const setSession = useAuthStore((s) => s.setSession);
  const setPendingPhone = useAuthStore((s) => s.setPendingPhone);
  return useMutation({
    mutationFn: (input: VerifyOtpInput) => authService.verifyOtp(input),
    onSuccess: () => {
      loginSecret.clear();
      setSession(true);
      setPendingPhone(null);
      useAuthStore.getState().setDevCode(null);
      useAuthStore.getState().setDeviceLimit(null);
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (allDevices: boolean) => {
      // Avval telefon tokeni o‘chiriladi (hali kirgan holatda), keyin chiqiladi.
      await unregisterPushToken();
      return authService.logout(allDevices);
    },
    onSuccess: () => {
      clear();
      queryClient.clear();
      navigate('/', { replace: true });
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => authService.listSessions(),
    refetchInterval: 60_000,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => authService.revokeSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authService.revokeOtherSessions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}

export function useSessionExpiredListener() {
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const pushToast = useAppStore((s) => s.pushToast);

  useEffect(() => {
    function onExpired() {
      // Guest sahifalarida (sessiya yo‘q) ochiq bo‘lmagan so‘rov 401 qaytarsa — kirishga majburlamaymiz.
      if (!useAuthStore.getState().hasSession) return;
      clear();
      pushToast(t('Sessiya muddati tugadi. Iltimos, qayta kiring.'), 'info');
      navigate('/login', { replace: true });
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [clear, navigate, pushToast]);
}
