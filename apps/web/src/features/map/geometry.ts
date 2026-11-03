/** Klient tomonidagi geometriya — faqat preview; yakuniy maydon serverda (PostGIS) hisoblanadi (TZ 12). */
export type LngLat = [number, number];

const R = 6378137; // WGS84 ekvator radiusi, m

/** Sferik ko‘pburchak maydoni, m² (Chamberlain–Duquette). Kichik tom uchun PostGIS geography natijasiga ~0,5 % yaqin. */
export function ringAreaM2(ring: LngLat[]): number {
  const points = ring.length > 1 && ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1] ? ring.slice(0, -1) : ring;
  if (points.length < 3) return 0;
  const rad = Math.PI / 180;
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [lon1, lat1] = points[i]!;
    const [lon2, lat2] = points[(i + 1) % points.length]!;
    total += (lon2 - lon1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((total * R * R) / 2);
}

function segmentsIntersect(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  const cross = (p: LngLat, q: LngLat, r: LngLat) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** O‘zini kesishini tezkor tekshirish (server ST_IsValid bilan yakuniy tekshiradi). */
export function selfIntersects(points: LngLat[]): boolean {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(points[i]!, points[(i + 1) % n]!, points[j]!, points[(j + 1) % n]!)) return true;
    }
  }
  return false;
}

export function closeRing(points: LngLat[]): LngLat[] {
  if (!points.length) return points;
  return [...points, points[0]!];
}

export const toPolygon = (points: LngLat[]) => ({ type: 'Polygon' as const, coordinates: [closeRing(points)] });

/** Saqlangan poligondan vertekslar (yopuvchi nuqtasiz). */
export function verticesOf(polygon: { coordinates: number[][][] } | null | undefined): LngLat[] {
  const ring = polygon?.coordinates[0] ?? [];
  return ring.slice(0, -1).map(([lon, lat]) => [lon!, lat!] as LngLat);
}

export function bboxOf(points: LngLat[]): [LngLat, LngLat] | null {
  if (!points.length) return null;
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

/** O‘zbekiston chegarasining taxminiy to‘rtburchagi (TZ 10.1: chegaradan tashqarida ogohlantirish). */
export const UZ_BOUNDS: [LngLat, LngLat] = [[55.9, 37.1], [73.2, 45.6]];
export const UZ_CENTER: LngLat = [64.6, 41.4];
export const inUzbekistan = ([lon, lat]: LngLat) => lon >= UZ_BOUNDS[0][0] && lon <= UZ_BOUNDS[1][0] && lat >= UZ_BOUNDS[0][1] && lat <= UZ_BOUNDS[1][1];
