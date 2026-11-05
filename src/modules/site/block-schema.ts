/** Bosh sahifa bloklari tuzilmasi (v3.1: faqat mijozga qaratilgan — do‘kon maydonlari yo‘q): har tur uchun maydonlar va uzunlik chegaralari (admin tahririda tekshiriladi). */
type Field =
  | { kind: 'text'; max: number; required?: boolean }
  | { kind: 'list'; max: number; itemMax: number }
  | { kind: 'items'; max: number; titleMax: number; textMax: number };

export const BLOCK_TYPES = ['HERO', 'STATS', 'STATEMENT', 'HOW_IT_WORKS', 'TRUST', 'TESTIMONIALS', 'FAQ', 'FINALE'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export const BLOCK_LANGS = ['uz', 'ru', 'oz'] as const;

/** HERO va FINALE joyi qat’iy (kino-scroll boshi va oxiri); qolganlari tartiblanadi. */
export const FIXED_BLOCKS: BlockType[] = ['HERO', 'FINALE'];

export const BLOCK_SCHEMA: Record<BlockType, Record<string, Field>> = {
  HERO: {
    label: { kind: 'text', max: 80 }, titleA: { kind: 'text', max: 80, required: true }, titleB: { kind: 'text', max: 80 },
    text: { kind: 'text', max: 400 }, chips: { kind: 'list', max: 6, itemMax: 40 },
    ctaPrimary: { kind: 'text', max: 40, required: true },
  },
  STATS: { title: { kind: 'text', max: 80 } },
  STATEMENT: { label: { kind: 'text', max: 40 }, text: { kind: 'text', max: 300, required: true } },
  HOW_IT_WORKS: { eyebrow: { kind: 'text', max: 40 }, title: { kind: 'text', max: 120, required: true }, items: { kind: 'items', max: 8, titleMax: 60, textMax: 240 } },
  TRUST: { eyebrow: { kind: 'text', max: 40 }, title: { kind: 'text', max: 120, required: true }, items: { kind: 'items', max: 6, titleMax: 80, textMax: 300 } },
  TESTIMONIALS: { eyebrow: { kind: 'text', max: 40 }, title: { kind: 'text', max: 120, required: true } },
  FAQ: { eyebrow: { kind: 'text', max: 40 }, title: { kind: 'text', max: 120, required: true }, items: { kind: 'items', max: 12, titleMax: 160, textMax: 1200 } },
  FINALE: { title: { kind: 'text', max: 200, required: true }, ctaPrimary: { kind: 'text', max: 40, required: true } },
};

export type BlockContent = Partial<Record<(typeof BLOCK_LANGS)[number], Record<string, unknown>>>;

/**
 * Tarkibni tekshiradi va tozalaydi: noma’lum maydonlar tashlanadi, matnlar trim qilinadi.
 * O‘zbekcha (uz) majburiy; ru majburiy maydonlari ham to‘ldirilishi shart; oz ixtiyoriy (bo‘sh bo‘lsa avtomatik o‘giriladi).
 * Xato bo‘lsa — `lang.field` ko‘rinishidagi yo‘llar ro‘yxati.
 */
export function sanitizeBlock(type: BlockType, input: unknown): { content: BlockContent; errors: string[] } {
  const schema = BLOCK_SCHEMA[type];
  const errors: string[] = [];
  const content: BlockContent = {};
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  for (const lang of BLOCK_LANGS) {
    const raw = source[lang];
    if (raw == null) {
      if (lang !== 'oz') errors.push(`${lang}`);
      continue;
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) { errors.push(lang); continue; }
    const value = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [name, field] of Object.entries(schema)) {
      const path = `${lang}.${name}`;
      const v = value[name];
      if (field.kind === 'text') {
        const s = typeof v === 'string' ? v.trim() : '';
        if (v != null && typeof v !== 'string') errors.push(path);
        else if (s.length > field.max) errors.push(path);
        else if (!s && field.required && lang !== 'oz') errors.push(path);
        if (s) out[name] = s;
      } else if (field.kind === 'list') {
        const list = Array.isArray(v) ? v : v == null ? [] : null;
        if (!list || list.length > field.max || list.some((x) => typeof x !== 'string' || x.trim().length > field.itemMax)) { errors.push(path); continue; }
        const clean = (list as string[]).map((x) => x.trim()).filter(Boolean);
        if (clean.length) out[name] = clean;
      } else {
        const list = Array.isArray(v) ? v : v == null ? [] : null;
        const ok = list && list.length <= field.max && list.every((x) => x && typeof x === 'object'
          && typeof (x as Record<string, unknown>).title === 'string' && typeof (x as Record<string, unknown>).text === 'string'
          && ((x as Record<string, string>).title).trim().length > 0 && ((x as Record<string, string>).title).trim().length <= field.titleMax
          && ((x as Record<string, string>).text).trim().length <= field.textMax);
        if (!ok) { errors.push(path); continue; }
        const clean = (list as Array<{ title: string; text: string }>).map((x) => ({ title: x.title.trim(), text: x.text.trim() }));
        if (clean.length) out[name] = clean;
      }
    }
    if (lang === 'oz' && !Object.keys(out).length) continue;
    content[lang] = out;
  }
  return { content, errors };
}
