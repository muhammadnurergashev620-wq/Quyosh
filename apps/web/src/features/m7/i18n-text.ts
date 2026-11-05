import { CONTENT_LANG, contentText } from '@/i18n';
import type { I18n } from './types';

/** Joriy til bo‘yicha matn (uz-Cyrl → oz). */
export const LOCALE_KEY = CONTENT_LANG;
export const tr = (v: I18n | null | undefined) => (v ? contentText(v) || v.ru || '' : '');
