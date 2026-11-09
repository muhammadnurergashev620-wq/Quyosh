import { useEffect, useRef } from 'react';
import { getMapLibre } from './maplibre-loader';
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, MapLayerTouchEvent, MapMouseEvent, MapTouchEvent, Marker } from 'maplibre-gl';
import { closeRing, type LngLat } from './geometry';

const EDIT = 'qs-edit';

/** `map.remove()` dan keyin uslub yo‘q — bunday instansiyaga murojaat qilinmaydi. */
const alive = (map: MapLibreMap | null): map is MapLibreMap => !!map && !!(map as unknown as { style?: unknown }).style;
const VERTEX = 'qs-edit-vertex';

function editData(points: LngLat[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (points.length >= 3) features.push({ type: 'Feature', properties: { kind: 'polygon' }, geometry: { type: 'Polygon', coordinates: [closeRing(points)] } });
  if (points.length >= 2) features.push({ type: 'Feature', properties: { kind: 'line' }, geometry: { type: 'LineString', coordinates: points.length >= 3 ? closeRing(points) : points } });
  points.forEach((point, index) => features.push({ type: 'Feature', properties: { kind: 'vertex', index, first: index === 0 }, geometry: { type: 'Point', coordinates: point } }));
  return { type: 'FeatureCollection', features };
}

/**
 * Poligon muharriri (TZ U7.3, U8.4): xaritaga bosish — nuqta qo‘shish; nuqtani sudrash — ko‘chirish (sichqoncha va barmoq).
 * Holat (nuqtalar) React’da; muharrir faqat ko‘rsatadi va hodisalarni uzatadi.
 */
export function usePolygonEditor(map: MapLibreMap | null, styleVersion: number, points: LngLat[], onChange: (points: LngLat[]) => void, active: boolean, color = '#f59e0b') {
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const activeRef = useRef(active);
  activeRef.current = active;

  // Manba va qatlamlar (uslub almashganda qayta qo‘shiladi).
  useEffect(() => {
    if (!alive(map)) return;
    if (!map.getSource(EDIT)) {
      map.addSource(EDIT, { type: 'geojson', data: editData(pointsRef.current) });
      map.addLayer({ id: `${EDIT}-fill`, type: 'fill', source: EDIT, filter: ['==', ['get', 'kind'], 'polygon'], paint: { 'fill-color': color, 'fill-opacity': 0.25 } });
      map.addLayer({ id: `${EDIT}-line`, type: 'line', source: EDIT, filter: ['==', ['get', 'kind'], 'line'], paint: { 'line-color': color, 'line-width': 2.5 } });
      map.addLayer({
        id: VERTEX,
        type: 'circle',
        source: EDIT,
        filter: ['==', ['get', 'kind'], 'vertex'],
        paint: { 'circle-radius': ['case', ['get', 'first'], 8, 6], 'circle-color': '#ffffff', 'circle-stroke-color': color, 'circle-stroke-width': 3 },
      });
    }
  }, [map, styleVersion, color]);

  useEffect(() => {
    if (alive(map)) (map.getSource(EDIT) as GeoJSONSource | undefined)?.setData(editData(points));
  }, [map, styleVersion, points]);

  useEffect(() => {
    if (!map) return;
    let dragging: number | null = null;
    let moved = false;
    const canvas = map.getCanvasContainer();

    const onClick = (event: MapMouseEvent) => {
      if (!activeRef.current || moved) {
        moved = false;
        return;
      }
      const hit = map.queryRenderedFeatures(event.point, { layers: [VERTEX] });
      if (hit.length) return;
      changeRef.current([...pointsRef.current, [event.lngLat.lng, event.lngLat.lat]]);
    };
    const start = (event: MapLayerMouseEvent | MapLayerTouchEvent) => {
      if (!activeRef.current) return;
      if ('points' in event && event.points.length > 1) return;
      const index = event.features?.[0]?.properties?.index;
      if (typeof index !== 'number') return;
      event.preventDefault();
      dragging = index;
      moved = false;
      canvas.style.cursor = 'grabbing';
      map.dragPan.disable();
    };
    const move = (event: MapMouseEvent | MapTouchEvent) => {
      if (dragging === null) return;
      moved = true;
      const next = [...pointsRef.current];
      next[dragging] = [event.lngLat.lng, event.lngLat.lat];
      changeRef.current(next);
    };
    const end = () => {
      if (dragging === null) return;
      dragging = null;
      canvas.style.cursor = '';
      map.dragPan.enable();
    };
    const enter = () => activeRef.current && (canvas.style.cursor = 'grab');
    const leave = () => dragging === null && (canvas.style.cursor = '');

    map.on('click', onClick);
    map.on('mousedown', VERTEX, start);
    map.on('touchstart', VERTEX, start);
    map.on('mousemove', move);
    map.on('touchmove', move);
    map.on('mouseup', end);
    map.on('touchend', end);
    map.on('mouseenter', VERTEX, enter);
    map.on('mouseleave', VERTEX, leave);
    return () => {
      map.off('click', onClick);
      map.off('mousedown', VERTEX, start);
      map.off('touchstart', VERTEX, start);
      map.off('mousemove', move);
      map.off('touchmove', move);
      map.off('mouseup', end);
      map.off('touchend', end);
      map.off('mouseenter', VERTEX, enter);
      map.off('mouseleave', VERTEX, leave);
    };
  }, [map]);
}

/** Saqlangan poligonlar (obyekt maydonlari, xizmat hududi) — faqat ko‘rsatish. */
export function useGeoJsonLayer(map: MapLibreMap | null, styleVersion: number, id: string, data: GeoJSON.FeatureCollection, color: string, opacity = 0.18) {
  useEffect(() => {
    if (!alive(map)) return;
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'geojson', data });
      map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, paint: { 'fill-color': color, 'fill-opacity': opacity } });
      map.addLayer({ id: `${id}-line`, type: 'line', source: id, paint: { 'line-color': color, 'line-width': 2 } });
    } else (map.getSource(id) as GeoJSONSource).setData(data);
    // data — har renderda yangi obyekt bo‘lishi mumkin; JSON taqqoslash bilan cheklaymiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleVersion, id, color, opacity, JSON.stringify(data)]);
}

/** Nuqta tanlagich: bosish yoki markerni sudrash bilan (foydalanuvchi o‘zi tasdiqlagan pin — TZ 12.1). */
export function usePointPicker(map: MapLibreMap | null, point: LngLat | null, onChange: (point: LngLat) => void, active = true, color = '#2563eb') {
  const markerRef = useRef<Marker | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!map) return;
    const onClick = (event: MapMouseEvent) => activeRef.current && changeRef.current([event.lngLat.lng, event.lngLat.lat]);
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  useEffect(() => {
    if (!alive(map)) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const marker = new (getMapLibre().Marker)({ color, draggable: true }).setLngLat(point).addTo(map);
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat();
        changeRef.current([lng, lat]);
      });
      markerRef.current = marker;
    } else markerRef.current.setLngLat(point);
    markerRef.current.setDraggable(active);
  }, [map, point, active, color]);

  useEffect(() => () => {
    markerRef.current?.remove();
    markerRef.current = null;
  }, []);
}
