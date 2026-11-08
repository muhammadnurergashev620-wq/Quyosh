import type { ArticleType } from '@/features/m7/types';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/m7/m7.css';
import '@/features/calc/calc.css';

export const TYPE_LABEL: Record<ArticleType, string> = { GUIDE: t('Qo‘llanma'), ARTICLE: t('Maqola'), FAQ: 'FAQ', VIDEO: t('Video'), GLOSSARY: t('Atama') };
