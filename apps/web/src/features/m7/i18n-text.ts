import { lang } from '@/i18n';
import type { I18n } from './types';

/** Joriy til bo‘yicha matn (uz-Cyrl → oz). */
export const LOCALE_KEY: 'uz' | 'oz' | 'ru' = lang === 'ru' ? 'ru' : lang === 'uz-Cyrl' ? 'oz' : 'uz';
export const tr = (v: I18n | null | undefined) => (v ? v[LOCALE_KEY] ?? v.uz ?? v.ru ?? '' : '');
