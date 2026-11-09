import type maplibreglType from 'maplibre-gl';

/**
 * MapLibre (~1 MB) dinamik yuklanadi: xaritali sahifa kutubxonani kutmasdan chiziladi (Lighthouse FCP/LCP).
 * `getMapLibre()` faqat xarita yaratilgandan keyin (kutubxona allaqachon yuklangan) chaqiriladi.
 */
type MapLibre = typeof maplibreglType;
let lib: MapLibre | null = null;
let pending: Promise<MapLibre> | null = null;

export function loadMapLibre(): Promise<MapLibre> {
  if (lib) return Promise.resolve(lib);
  pending ??= import('maplibre-gl').then((module) => (lib = module.default));
  return pending;
}

export function getMapLibre(): MapLibre {
  if (!lib) throw new Error('MapLibre hali yuklanmagan');
  return lib;
}
