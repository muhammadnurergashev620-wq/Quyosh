import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/services/api.client';
import { lang, t } from '@/i18n';
import { toUzbekCyrillic } from '@/i18n/translit';

export type BlockType = 'HERO' | 'STATS' | 'STATEMENT' | 'PATHS' | 'HOW_IT_WORKS' | 'TRUST' | 'TESTIMONIALS' | 'FAQ' | 'FINALE';
export type BlockLang = 'uz' | 'ru' | 'oz';
export type BlockFields = Record<string, unknown>;
export type BlockContent = Partial<Record<BlockLang, BlockFields>>;

export interface Testimonial {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  author: string | null;
  shop: { name: string; slug: string };
  systemPowerKw: string | null;
}

export interface HomeData {
  blocks: Array<{ type: BlockType; version: number; content: BlockContent }>;
  stats: { verifiedShops: number; calculations: number; confirmedInstallations: number };
  testimonials: Testimonial[];
  preview: boolean;
}

export interface Item { title: string; text: string }

/** Bloklar standart tartibi (API javob bermasa ham sahifa shu tartibda chiqadi). */
export const DEFAULT_ORDER: BlockType[] = ['HERO', 'STATS', 'STATEMENT', 'PATHS', 'HOW_IT_WORKS', 'TRUST', 'TESTIMONIALS', 'FAQ', 'FINALE'];

/** Bosh sahifa ma’lumoti: ommaviy (`/site/home`) yoki admin ko‘rinishi (qoralamalar bilan). */
export function useHomeData(preview = false) {
  return useQuery({
    queryKey: ['site-home', preview],
    queryFn: () => apiGet<HomeData>(preview ? '/admin/site-blocks/preview' : '/site/home'),
    retry: preview ? 1 : 0,
    staleTime: preview ? 0 : 60_000,
  });
}

const cyr = (value: unknown): unknown => {
  if (typeof value === 'string') return toUzbekCyrillic(value);
  if (Array.isArray(value)) return value.map(cyr);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cyr(v)]));
  return value;
};

/**
 * Joriy tilga mos maydonlar: ru → ru; kirill → oz (bo‘lmasa o‘zbek lotinidan avtomatik o‘giriladi); uz → uz.
 * Bo‘sh maydon o‘zbekcha matn bilan to‘ldiriladi.
 */
export function localize(content: BlockContent | undefined, current: typeof lang = lang): BlockFields | null {
  if (!content?.uz) return null;
  const base = content.uz;
  if (current === 'ru') return { ...base, ...(content.ru ?? {}) };
  if (current === 'uz-Cyrl') return { ...(cyr(base) as BlockFields), ...(content.oz ?? {}) };
  return base;
}

export const str = (fields: BlockFields | null, key: string, fallback: string): string => {
  const v = fields?.[key];
  return typeof v === 'string' && v ? v : fallback;
};
export const list = (fields: BlockFields | null, key: string, fallback: string[]): string[] => {
  const v = fields?.[key];
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : fallback;
};
export const items = (fields: BlockFields | null, key: string, fallback: Item[]): Item[] => {
  const v = fields?.[key];
  return Array.isArray(v) && v.length && v.every((x) => x && typeof (x as Item).title === 'string') ? (v as Item[]) : fallback;
};

/** "Interpolatsiya": {h} {m} kabi o‘rinbosarlar (FINALE sarlavhasi). */
export const fill = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));

export const BLOCK_LABEL: Record<BlockType, () => string> = {
  HERO: () => t('Bosh ekran'),
  STATS: () => t('Raqamlar'),
  STATEMENT: () => t('Shior'),
  PATHS: () => t('Mijoz va do‘kon yo‘llari'),
  HOW_IT_WORKS: () => t('Qanday ishlaydi'),
  TRUST: () => t('Ishonch'),
  TESTIMONIALS: () => t('Mijozlar sharhlari'),
  FAQ: () => t('Ko‘p beriladigan savollar'),
  FINALE: () => t('Yakuniy chaqiriq'),
};
