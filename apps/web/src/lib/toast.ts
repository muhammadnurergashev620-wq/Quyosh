import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
  /** ms; `null` — avtomatik yopilmaydi (xato va yuklanish). */
  duration: number | null;
  createdAt: number;
  /** Chiqish animatsiyasi (160 ms) ketayotgan bo‘lsa. */
  leaving?: boolean;
}

export interface ToastOptions {
  description?: string;
  action?: ToastAction;
  duration?: number | null;
  id?: string;
}

/** Bir vaqtda ko‘rinadigan toastlar soni; qolgani navbatda kutadi. */
export const MAX_VISIBLE = 3;
export const DEFAULT_DURATION = 4000;

interface ToastState {
  items: ToastItem[];
  push: (item: ToastItem) => void;
  update: (id: string, patch: Partial<ToastItem>) => void;
  dismiss: (id: string) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (item) => set((s) => {
    // Bir xil xabar ketma-ket takrorlanmaydi (bir amal = bitta toast).
    const dup = s.items.find((x) => !x.leaving && x.title === item.title && x.type === item.type && x.description === item.description);
    if (dup) return { items: s.items.map((x) => (x.id === dup.id ? { ...x, createdAt: item.createdAt } : x)) };
    return { items: [...s.items.filter((x) => x.id !== item.id), item] };
  }),
  update: (id, patch) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, ...patch, createdAt: Date.now() } : x)) })),
  dismiss: (id) => {
    if (!get().items.some((x) => x.id === id)) return;
    set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, leaving: true } : x)) }));
    window.setTimeout(() => get().remove(id), 170);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

let seq = 0;
const make = (type: ToastType, title: string, options: ToastOptions = {}) => {
  const id = options.id ?? `t${Date.now().toString(36)}${(seq += 1)}`;
  const duration = options.duration !== undefined ? options.duration : type === 'error' || type === 'loading' ? null : DEFAULT_DURATION;
  useToastStore.getState().push({ id, type, title, description: options.description, action: options.action, duration, createdAt: Date.now() });
  return id;
};

/**
 * Toast tizimi (U5.4): `toast.success('Taklif yuborildi', { description, action })`.
 * Xato toasti avtomatik yopilmaydi; `promise` — «Yuborilmoqda…» → «Yuborildi» yoki xato.
 */
export const toast = {
  success: (title: string, options?: ToastOptions) => make('success', title, options),
  error: (title: string, options?: ToastOptions) => make('error', title, options),
  warning: (title: string, options?: ToastOptions) => make('warning', title, options),
  info: (title: string, options?: ToastOptions) => make('info', title, options),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
  /** «Qaytarish» (undo) bilan: amal 5 s ichida bekor qilinishi mumkin. */
  undoable: (title: string, onUndo: () => void, options?: Omit<ToastOptions, 'action'>) => {
    const id = make('success', title, { duration: 5000, ...options, action: { label: undoLabel(), onClick: () => { onUndo(); useToastStore.getState().dismiss(id); } } });
    return id;
  },
  async promise<T>(promise: Promise<T>, labels: { loading: string; success: string | ((value: T) => string); error: string | ((error: unknown) => string) }): Promise<T> {
    const id = make('loading', labels.loading);
    try {
      const value = await promise;
      useToastStore.getState().update(id, { type: 'success', title: typeof labels.success === 'function' ? labels.success(value) : labels.success, duration: DEFAULT_DURATION });
      return value;
    } catch (error) {
      useToastStore.getState().update(id, { type: 'error', title: typeof labels.error === 'function' ? labels.error(error) : labels.error, duration: null });
      throw error;
    }
  },
};

let undoText = 'Qaytarish';
/** i18n bog‘lanishi (lib’da `t` ni to‘g‘ridan-to‘g‘ri chaqirmaslik uchun — Toast komponenti o‘rnatadi). */
export const setToastStrings = (strings: { undo: string }) => { undoText = strings.undo; };
const undoLabel = () => undoText;
