export type ThemeMode = 'light' | 'dark';

const KEY = 'quyosh.theme';

export function getThemeMode(): ThemeMode {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
  }
  applyTheme(mode);
}
