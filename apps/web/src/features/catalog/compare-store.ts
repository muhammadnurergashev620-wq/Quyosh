import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const MAX_COMPARE = 4;

export interface CompareEntry {
  id: string;
  slug: string;
  label: string;
}

interface CompareState {
  items: CompareEntry[];
  toggle: (entry: CompareEntry) => boolean;
  remove: (id: string) => void;
  clear: () => void;
}

/** U7.5: solishtirish ro‘yxati (2–4 mahsulot), sahifalar orasida saqlanadi. */
export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (entry) => {
        const items = get().items;
        if (items.some((item) => item.id === entry.id)) {
          set({ items: items.filter((item) => item.id !== entry.id) });
          return true;
        }
        if (items.length >= MAX_COMPARE) return false;
        set({ items: [...items, entry] });
        return true;
      },
      remove: (id) => set({ items: get().items.filter((item) => item.id !== id) }),
      clear: () => set({ items: [] }),
    }),
    { name: 'quyosh.compare' },
  ),
);
