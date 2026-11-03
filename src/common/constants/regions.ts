import { haversineKm } from '../utils/geo';

/** O‘zbekistonning 14 ta hududi: kalit, nomi va markaz koordinatasi (ustaning joylashuvi eng yaqin markazga bog‘lanadi). */
export const REGIONS = [
  { key: 'toshkent-shahri', name: 'Toshkent shahri', lat: 41.311, lon: 69.279 },
  { key: 'toshkent-viloyati', name: 'Toshkent viloyati', lat: 41.04, lon: 69.36 },
  { key: 'andijon', name: 'Andijon viloyati', lat: 40.783, lon: 72.344 },
  { key: 'buxoro', name: 'Buxoro viloyati', lat: 39.768, lon: 64.421 },
  { key: 'fargona', name: 'Farg‘ona viloyati', lat: 40.384, lon: 71.784 },
  { key: 'jizzax', name: 'Jizzax viloyati', lat: 40.115, lon: 67.842 },
  { key: 'xorazm', name: 'Xorazm viloyati', lat: 41.55, lon: 60.633 },
  { key: 'namangan', name: 'Namangan viloyati', lat: 41.0, lon: 71.67 },
  { key: 'navoiy', name: 'Navoiy viloyati', lat: 40.084, lon: 65.379 },
  { key: 'qashqadaryo', name: 'Qashqadaryo viloyati', lat: 38.86, lon: 65.79 },
  { key: 'qoraqalpogiston', name: 'Qoraqalpog‘iston Respublikasi', lat: 42.46, lon: 59.61 },
  { key: 'samarqand', name: 'Samarqand viloyati', lat: 39.654, lon: 66.96 },
  { key: 'sirdaryo', name: 'Sirdaryo viloyati', lat: 40.49, lon: 68.78 },
  { key: 'surxondaryo', name: 'Surxondaryo viloyati', lat: 37.224, lon: 67.278 },
] as const;

export type RegionKey = (typeof REGIONS)[number]['key'];
export const REGION_KEYS = REGIONS.map((region) => region.key) as RegionKey[];

const CITY_RADIUS_KM = 22;
/** Mamlakatdan tashqari nuqtalar hududga bog‘lanmaydi (eng yaqin markazgacha shu masofadan uzoq bo‘lsa). */
const MAX_DISTANCE_KM = 260;

/** Koordinata qaysi hududga tegishli: Toshkent shahri atrofi — shahar, qolgani — eng yaqin viloyat markazi. */
export function regionOf(lat: number | null | undefined, lon: number | null | undefined): RegionKey | null {
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return null;
  const city = REGIONS[0];
  if (haversineKm(lat, lon, city.lat, city.lon) <= CITY_RADIUS_KM) return city.key;
  let best: { key: RegionKey; distance: number } | null = null;
  for (const region of REGIONS) {
    if (region.key === city.key) continue;
    const distance = haversineKm(lat, lon, region.lat, region.lon);
    if (!best || distance < best.distance) best = { key: region.key, distance };
  }
  return best && best.distance <= MAX_DISTANCE_KM ? best.key : null;
}

export const regionName = (key: string | null | undefined): string | null => REGIONS.find((region) => region.key === key)?.name ?? null;
