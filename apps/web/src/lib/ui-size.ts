import { t } from '@/i18n';
export type UiSize = 'small' | 'medium' | 'large';

const KEY = 'quyosh.ui-size';

export const UI_SIZES: ReadonlyArray<{ value: UiSize; label: string }> = [
  { value: 'small', label: t('Kichik') },
  { value: 'medium', label: t('O‘rtacha') },
  { value: 'large', label: t('Katta') },
];

export function getUiSize(): UiSize {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'small' || value === 'large' ? value : 'medium';
  } catch {
    return 'medium';
  }
}

export function applyUiSize(size: UiSize): void {
  document.documentElement.setAttribute('data-ui-size', size);
}

export function setUiSize(size: UiSize): void {
  try {
    localStorage.setItem(KEY, size);
  } catch {
    // saqlab bo‘lmasa ham joriy sessiyada ishlaydi
  }
  applyUiSize(size);
}
