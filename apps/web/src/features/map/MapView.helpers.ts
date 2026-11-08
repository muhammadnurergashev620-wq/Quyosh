import { useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';

/** Xarita instansiyasini tashqariga olish uchun: MapView onStyleReady orqali saqlanadi. */
export function useMapHandle() {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [styleVersion, setStyleVersion] = useState(0);
  const onStyleReady = (instance: MapLibreMap | null) => {
    setMap(instance);
    if (instance) setStyleVersion((value) => value + 1);
  };
  return { map, styleVersion, onStyleReady };
}
