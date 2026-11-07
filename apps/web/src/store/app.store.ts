import { create } from 'zustand';
import { toast } from '@/lib/toast';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface AppState {
  /** Eski API (119 chaqiruv): yangi toast tizimiga yo‘naltiriladi — `toast.success/error/info/warning`. */
  pushToast: (message: string, variant?: ToastVariant) => void;
}

export const useAppStore = create<AppState>(() => ({
  pushToast: (message, variant = 'info') => {
    toast[variant](message);
  },
}));
