import { describe, expect, it } from 'vitest';
import { fill, items, list, localize, str } from './home-content';

describe('home-content', () => {
  const content = { uz: { title: 'Salom', points: ['bir', 'ikki'] }, ru: { title: 'Привет' } };

  it('picks the language and falls back to Uzbek for missing fields', () => {
    expect(localize(content, 'ru')).toEqual({ title: 'Привет', points: ['bir', 'ikki'] });
    expect(localize(content, 'uz')).toEqual(content.uz);
    expect(localize({ ru: { title: 'x' } }, 'ru')).toBeNull();
  });

  it('transliterates Uzbek Latin to Cyrillic unless oz is given', () => {
    expect(localize(content, 'uz-Cyrl')?.title).toBe('Салом');
    expect(localize({ ...content, oz: { title: 'Ассалому' } }, 'uz-Cyrl')?.title).toBe('Ассалому');
  });

  it('typed getters fall back on wrong shapes; fill replaces placeholders', () => {
    const f = { a: 'x', b: [1], c: [{ title: 'T', text: 'X' }] };
    expect(str(f, 'a', 'd')).toBe('x');
    expect(str(f, 'z', 'd')).toBe('d');
    expect(list(f, 'b', ['d'])).toEqual(['d']);
    expect(items(f, 'c', [])).toHaveLength(1);
    expect(items(null, 'c', [{ title: 'D', text: '' }])[0]!.title).toBe('D');
    expect(fill('Bugun {h} soat {m} daqiqa {x}', { h: 11, m: 5 })).toBe('Bugun 11 soat 5 daqiqa {x}');
  });
});
