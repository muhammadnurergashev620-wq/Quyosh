import { useSyncExternalStore } from 'react';

const KEY = 'quyosh.sidebar';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function apply(collapsed: boolean) {
  if (collapsed) document.documentElement.dataset.sidebar = 'collapsed';
  else delete document.documentElement.dataset.sidebar;
}

if (typeof document !== 'undefined') apply(read());

/** Yon panelni yig‘ish (72 px) — tanlov brauzerda eslab qolinadi. */
export function setSidebarCollapsed(collapsed: boolean) {
  try {
    if (collapsed) localStorage.setItem(KEY, 'collapsed');
    else localStorage.removeItem(KEY);
  } catch {
    /* saqlab bo‘lmasa ham joriy oynada ishlayveradi */
  }
  apply(collapsed);
  listeners.forEach((notify) => notify());
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => document.documentElement.dataset.sidebar === 'collapsed',
    () => false,
  );
}
