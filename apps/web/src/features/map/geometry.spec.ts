import { describe, expect, it } from 'vitest';
import { closeRing, ringAreaM2, selfIntersects, verticesOf } from './geometry';

describe('ringAreaM2', () => {
  it('approximates the server area for a ~10 × 10 m roof in Tashkent', () => {
    // Server (PostGIS geography) shu poligon uchun 100,46 m² qaytardi.
    const area = ringAreaM2([[69.24, 41.3], [69.24012, 41.3], [69.24012, 41.30009], [69.24, 41.30009]]);
    expect(area).toBeGreaterThan(99);
    expect(area).toBeLessThan(102);
  });
  it('is zero for degenerate rings', () => {
    expect(ringAreaM2([[0, 0], [1, 1]])).toBe(0);
  });
});

describe('selfIntersects', () => {
  it('detects a bow-tie', () => {
    expect(selfIntersects([[0, 0], [1, 1], [1, 0], [0, 1]])).toBe(true);
    expect(selfIntersects([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(false);
  });
});

describe('ring helpers', () => {
  it('closes and reopens rings', () => {
    const ring = closeRing([[0, 0], [1, 0], [1, 1]]);
    expect(ring).toHaveLength(4);
    expect(verticesOf({ coordinates: [ring] })).toHaveLength(3);
  });
});
