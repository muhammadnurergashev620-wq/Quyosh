import {  contentText } from '@/i18n';
import type { I18n } from './types';

export const tr = (v: I18n | null | undefined) => (v ? contentText(v) || v.ru || '' : '');
