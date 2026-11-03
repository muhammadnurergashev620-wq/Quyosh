import { HttpStatus } from '@nestjs/common';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';

export type Position = [number, number];
export interface PolygonGeometry { type: 'Polygon'; coordinates: Position[][] }
export interface MultiPolygonGeometry { type: 'MultiPolygon'; coordinates: Position[][][] }

/** TZ 10.1: 3..500 vertex (yopuvchi nuqtasiz), yopiq ring, WGS84 chegaralari. */
export const MAX_VERTICES = 500;

export const polygonInvalid = (message: string = ERRORS.POLYGON_INVALID) => new DomainException(HttpStatus.BAD_REQUEST, 'POLYGON_INVALID', message);
export const polygonTooLarge = (message: string = ERRORS.POLYGON_TOO_LARGE) => new DomainException(HttpStatus.BAD_REQUEST, 'POLYGON_TOO_LARGE', message);

const isPosition = (value: unknown): value is Position =>
  Array.isArray(value) && value.length >= 2 && value.every((n) => typeof n === 'number' && Number.isFinite(n)) && Math.abs(value[0] as number) <= 180 && Math.abs(value[1] as number) <= 90;

/** Ringni tekshiradi va yopadi (oxirgi nuqta birinchisiga teng bo‘lmasa qo‘shiladi). Faqat lon/lat olinadi. */
export function normalizeRing(ring: unknown): Position[] {
  if (!Array.isArray(ring) || !ring.every(isPosition)) throw polygonInvalid();
  const points = ring.map(([lon, lat]) => [lon, lat] as Position);
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) points.push([first[0], first[1]]);
  const vertices = points.length - 1;
  if (vertices < 3) throw polygonInvalid();
  if (vertices > MAX_VERTICES) throw polygonInvalid(`Poligon nuqtalari ${MAX_VERTICES} tadan oshmasligi kerak`);
  return points;
}

export function normalizePolygon(input: unknown): PolygonGeometry {
  const geometry = input as { type?: unknown; coordinates?: unknown };
  if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) throw polygonInvalid();
  const rings = (geometry.coordinates as unknown[]).map(normalizeRing);
  const vertices = rings.reduce((sum, ring) => sum + ring.length - 1, 0);
  if (vertices > MAX_VERTICES) throw polygonInvalid(`Poligon nuqtalari ${MAX_VERTICES} tadan oshmasligi kerak`);
  return { type: 'Polygon', coordinates: rings };
}

/** Polygon yoki MultiPolygon → MultiPolygon (xizmat hududi uchun). */
export function normalizeMultiPolygon(input: unknown): MultiPolygonGeometry {
  const geometry = input as { type?: unknown; coordinates?: unknown };
  if (geometry?.type === 'Polygon') return { type: 'MultiPolygon', coordinates: [normalizePolygon(geometry).coordinates] };
  if (geometry?.type !== 'MultiPolygon' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) throw polygonInvalid();
  const polygons = (geometry.coordinates as unknown[]).map((coordinates) => normalizePolygon({ type: 'Polygon', coordinates }).coordinates);
  const vertices = polygons.flat().reduce((sum, ring) => sum + ring.length - 1, 0);
  if (vertices > MAX_VERTICES) throw polygonInvalid(`Poligon nuqtalari ${MAX_VERTICES} tadan oshmasligi kerak`);
  return { type: 'MultiPolygon', coordinates: polygons };
}

/** TZ 11.3: maydon parametrlari. Default foydali koeffitsient: qiya tom 0,70, tekis tom/yer 0,80. */
export function defaultUsableFactor(roofShape: 'FLAT' | 'PITCHED') {
  return roofShape === 'PITCHED' ? 0.7 : 0.8;
}

export function areaFigures(projectedAreaM2: number, roofShape: 'FLAT' | 'PITCHED', tiltDeg: number | null | undefined, usableFactor: number) {
  const tilt = roofShape === 'PITCHED' ? Math.min(Math.max(tiltDeg ?? 30, 0), 89) : 0;
  const surface = roofShape === 'PITCHED' ? projectedAreaM2 / Math.cos((tilt * Math.PI) / 180) : projectedAreaM2;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return { projectedAreaM2: round2(projectedAreaM2), surfaceAreaM2: round2(surface), usableAreaM2: round2(surface * usableFactor) };
}

/** Server klasterlash panjarasi (gradus): zoom oshgan sari kichrayadi. */
export const clusterGridDeg = (zoom: number) => 60 / 2 ** Math.max(0, Math.min(zoom, 20));
