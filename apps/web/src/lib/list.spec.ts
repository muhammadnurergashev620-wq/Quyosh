import { describe, expect, it } from 'vitest';
import { toItems } from './list';

describe('toItems', () => {
  it('returns arrays as is', () => {
    expect(toItems([1, 2])).toEqual([1, 2]);
  });
  it('unwraps cursor pages', () => {
    expect(toItems({ items: ['a'], nextCursor: null })).toEqual(['a']);
  });
  it('treats missing data as empty', () => {
    expect(toItems(undefined)).toEqual([]);
    expect(toItems(null)).toEqual([]);
  });
});
