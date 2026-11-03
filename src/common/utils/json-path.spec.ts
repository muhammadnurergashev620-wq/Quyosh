import { describe, expect, it } from 'vitest';
import { at, numArrayAt, numAt, strAt } from './json-path';

describe('json-path', () => {
  const json = { a: { b: 2, s: 'x', arr: [1, 2], bad: [1, 'x'] }, n: Number.NaN };
  it('reads nested values safely', () => {
    expect(at(json, 'a.b')).toBe(2);
    expect(at(json, 'a.b.c')).toBeUndefined();
    expect(at(null, 'a')).toBeUndefined();
    expect(numAt(json, 'a.b')).toBe(2);
    expect(numAt(json, 'a.s')).toBeNull();
    expect(numAt(json, 'n')).toBeNull();
    expect(strAt(json, 'a.s')).toBe('x');
    expect(numArrayAt(json, 'a.arr')).toEqual([1, 2]);
    expect(numArrayAt(json, 'a.bad')).toBeNull();
  });
});
