import { env } from '@/lib/env';

export type ThemeMode = 'light' | 'dark';

/** Admin paneli standart holatda to‘q mavzuda ochiladi; foydalanuvchi tanlovi saqlansa — o‘sha. */
const DEFAULT_MODE: ThemeMode = env.appRole === 'ADMIN' ? 'dark' : 'light';

const KEY = 'quyosh.theme';

export function getThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'dark' || stored === 'light' ? stored : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
  }
  applyTheme(mode);
}
