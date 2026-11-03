import { describe, expect, it } from 'vitest';
import { areaFigures, clusterGridDeg, normalizeMultiPolygon, normalizePolygon } from './geojson';

const square = [[69.24, 41.3], [69.2401, 41.3], [69.2401, 41.3001], [69.24, 41.3001]];

describe('normalizePolygon', () => {
  it('closes an open ring', () => {
    const polygon = normalizePolygon({ type: 'Polygon', coordinates: [square] });
    expect(polygon.coordinates[0]).toHaveLength(5);
    expect(polygon.coordinates[0]![4]).toEqual([69.24, 41.3]);
  });
  it('rejects fewer than 3 vertices, bad coordinates and wrong types', () => {
    expect(() => normalizePolygon({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] })).toThrow();
    expect(() => normalizePolygon({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [200, 0]]] })).toThrow();
    expect(() => normalizePolygon({ type: 'Point', coordinates: [0, 0] })).toThrow();
  });
  it('rejects more than 500 vertices', () => {
    const ring = Array.from({ length: 501 }, (_, i) => [Math.cos(i) * 0.01, Math.sin(i) * 0.01]);
    expect(() => normalizePolygon({ type: 'Polygon', coordinates: [ring] })).toThrow(/500/);
  });
});

describe('normalizeMultiPolygon', () => {
  it('wraps a Polygon', () => {
    expect(normalizeMultiPolygon({ type: 'Polygon', coordinates: [square] }).coordinates).toHaveLength(1);
  });
});

describe('areaFigures (TZ 11.3)', () => {
  it('pitched roof surface = projected / cos(tilt)', () => {
    const result = areaFigures(100, 'PITCHED', 30, 0.7);
    expect(result.surfaceAreaM2).toBeCloseTo(115.47, 2);
    expect(result.usableAreaM2).toBeCloseTo(80.83, 2);
  });
  it('flat roof keeps projected area', () => {
    expect(areaFigures(50, 'FLAT', 25, 0.8)).toEqual({ projectedAreaM2: 50, surfaceAreaM2: 50, usableAreaM2: 40 });
  });
  it('cluster grid shrinks with zoom', () => {
    expect(clusterGridDeg(13)).toBeLessThan(clusterGridDeg(5));
  });
});
