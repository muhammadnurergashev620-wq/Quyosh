import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface AppState {
  toasts: Toast[];
  pushToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  toasts: [],
  pushToast: (message, variant = 'info') =>
    set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), message, variant }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
