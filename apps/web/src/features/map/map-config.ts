import { useQuery } from '@tanstack/react-query';
import type { StyleSpecification } from 'maplibre-gl';
import { apiGet } from '@/services/api.client';
import { lang } from '@/i18n';

export interface MapConfig {
  provider: 'ESRI' | 'FALLBACK';
  apiKey: string | null;
  basemapStyle: string;
  satelliteStyle: string;
  fallbackStyleUrl: string | null;
  satelliteAvailable: boolean;
  geocodingAvailable: boolean;
  clusterMaxZoom: number;
}

export function useMapConfig() {
  return useQuery({ queryKey: ['map', 'config'], queryFn: () => apiGet<MapConfig>('/map/config'), staleTime: 30 * 60_000 });
}

/** OpenStreetMap asosidagi zaxira uslub (TZ 12.1 fallback): Esri kaliti yo‘q yoki limit tugaganda. */
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/** Esri basemap uslubi (ArcGIS Basemap Styles v2) yoki zaxira. */
export function styleFor(config: MapConfig | undefined, satellite: boolean): string | StyleSpecification {
  if (config?.provider === 'ESRI' && config.apiKey) {
    const style = satellite ? config.satelliteStyle : config.basemapStyle;
    const language = lang === 'ru' ? 'ru' : 'uz';
    return `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/${style}?token=${encodeURIComponent(config.apiKey)}&language=${language}`;
  }
  return config?.fallbackStyleUrl || OSM_STYLE;
}
