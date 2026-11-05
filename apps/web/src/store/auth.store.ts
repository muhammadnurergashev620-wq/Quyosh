import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { env } from '@/lib/env';
import type { Role } from '@/types/common';
import type { CodeDelivery } from '@/features/auth/types';

interface AuthState {
  hasSession: boolean;
  preferredRole: Role | null;
  pendingPhone: string | null;
  devCode: string | null;
  /** Oxirgi kirish kodi qayerga yuborilgani (faqat xotirada). */
  delivery: CodeDelivery | null;
  smsAvailable: boolean;
  setDelivery: (delivery: CodeDelivery | null, smsAvailable: boolean) => void;
  /** Ro‘yxatdan o‘tgan foydalanuvchiga bir marta ko‘rsatish uchun (faqat xotirada, hech qayerda saqlanmaydi). */
  newCredentials: { phone: string; password: string } | null;
  setNewCredentials: (value: { phone: string; password: string } | null) => void;
  deviceLimit: { max: number; active: number } | null;
  setDeviceLimit: (limit: { max: number; active: number } | null) => void;
  setDevCode: (code: string | null) => void;
  /** Kirishda oldingi kod hali amal qilsa: «Qayta yuborish» taymeri shu soniyadan boshlanadi (faqat xotirada). */
  resendIn: number | null;
  setResendIn: (seconds: number | null) => void;
  setSession: (hasSession: boolean) => void;
  setPreferredRole: (role: Role | null) => void;
  setPendingPhone: (phone: string | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hasSession: false,
      preferredRole: null,
      pendingPhone: null,
      devCode: null,
      delivery: null,
      smsAvailable: false,
      setDelivery: (delivery, smsAvailable) => set({ delivery, smsAvailable }),
      newCredentials: null,
      setNewCredentials: (newCredentials) => set({ newCredentials }),
      deviceLimit: null,
      setDeviceLimit: (deviceLimit) => set({ deviceLimit }),
      setDevCode: (devCode) => set({ devCode }),
      resendIn: null,
      setResendIn: (resendIn) => set({ resendIn }),
      setSession: (hasSession) => set({ hasSession }),
      setPreferredRole: (preferredRole) => set({ preferredRole: env.appRole ?? preferredRole }),
      setPendingPhone: (pendingPhone) => set({ pendingPhone }),
      clear: () => set({ hasSession: false, pendingPhone: null, devCode: null, resendIn: null, delivery: null, smsAvailable: false, deviceLimit: null, newCredentials: null }),
    }),
    {
      name: 'quyosh.auth-ui',
      partialize: (state) => ({ hasSession: state.hasSession, preferredRole: state.preferredRole }),
    },
  ),
);

if (env.appRole) useAuthStore.setState({ preferredRole: env.appRole });
