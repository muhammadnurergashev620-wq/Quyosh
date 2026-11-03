import { describe, expect, it } from 'vitest';
import { sanitizeBlock } from './block-schema';
import { HOME_DEFAULTS } from './home-defaults';
import { BLOCK_TYPES } from './block-schema';

describe('sanitizeBlock', () => {
  it('standart matnlar sxemaga mos', () => {
    for (const type of BLOCK_TYPES) {
      const { errors } = sanitizeBlock(type, HOME_DEFAULTS[type]);
      expect(errors, type).toEqual([]);
    }
  });

  it('uz va ru majburiy maydonlari, uzunlik va noma’lum maydonlar', () => {
    const { content, errors } = sanitizeBlock('STATEMENT', { uz: { text: '  Salom  ', extra: 'x' }, ru: { text: '' } });
    expect(errors).toEqual(['ru.text']);
    expect(content.uz).toEqual({ text: 'Salom' });
    expect(sanitizeBlock('STATEMENT', { uz: { text: 'a'.repeat(301) }, ru: { text: 'b' } }).errors).toEqual(['uz.text']);
    expect(sanitizeBlock('STATEMENT', { uz: { text: 'a' } }).errors).toEqual(['ru']);
  });

  it('oz ixtiyoriy, bo‘sh bo‘lsa saqlanmaydi; ro‘yxat elementlari tekshiriladi', () => {
    const r = sanitizeBlock('FAQ', { uz: { title: 'S', items: [{ title: 'Q', text: 'A' }] }, ru: { title: 'В', items: [] }, oz: { title: '' } });
    expect(r.errors).toEqual([]);
    expect(r.content.oz).toBeUndefined();
    expect(sanitizeBlock('FAQ', { uz: { title: 'S', items: [{ title: '', text: 'A' }] }, ru: { title: 'В' } }).errors).toEqual(['uz.items']);
  });
});
