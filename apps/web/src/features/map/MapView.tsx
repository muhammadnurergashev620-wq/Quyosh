import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, LocateFixed } from 'lucide-react';
import { useAppStore } from '@/store/app.store';
import { cx } from '@/lib/utils';
import { styleFor, useMapConfig } from './map-config';
import { UZ_BOUNDS, type LngLat } from './geometry';
import { t } from '@/i18n';
import './map.css';

export interface MapViewProps {
  center?: LngLat;
  zoom?: number;
  /** Sun’iy yo‘ldosh qatlami bilan boshlash (mavjud bo‘lsa). */
  satellite?: boolean;
  /** Xarita va uslub tayyor bo‘lganda (uslub almashsa ham qayta chaqiriladi — qatlamlarni qayta qo‘shish uchun). */
  onStyleReady?: (map: MapLibreMap | null) => void;
  onLocate?: (point: LngLat) => void;
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
}

/**
 * MapLibre GL xaritasi (TZ 12, 12.1): Esri basemap (kalit bo‘lsa) yoki OSM zaxira uslubi; atributsiya doim ko‘rinadi.
 * Sun’iy yo‘ldosh — faqat Esri bilan; bo‘lmasa foydalanuvchiga maydonni raqam bilan kiritish taklif qilinadi.
 */
export function MapView({ center, zoom, satellite = false, onStyleReady, onLocate, className, children, ariaLabel }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(onStyleReady);
  readyRef.current = onStyleReady;
  const config = useMapConfig();
  const pushToast = useAppStore((s) => s.pushToast);
  const [sat, setSat] = useState(satellite);

  useEffect(() => {
    if (!container.current || mapRef.current || config.isLoading) return;
    const esri = config.data?.provider === 'ESRI';
    const map = new maplibregl.Map({
      container: container.current,
      style: styleFor(config.data, sat && !!config.data?.satelliteAvailable),
      center: center ?? [69.2401, 41.2995],
      zoom: zoom ?? (center ? 15 : 10),
      maxBounds: [[UZ_BOUNDS[0][0] - 8, UZ_BOUNDS[0][1] - 6], [UZ_BOUNDS[1][0] + 8, UZ_BOUNDS[1][1] + 6]],
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: esri ? 'Powered by <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a>' : undefined }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.touchZoomRotate.disableRotation();
    map.on('style.load', () => readyRef.current?.(map));
    mapRef.current = map;
    return () => {
      // Avval handle’ni tozalaymiz: o‘chirilgan xaritaga qatlam qo‘shishga urinish bo‘lmasin.
      readyRef.current?.(null);
      map.remove();
      mapRef.current = null;
    };
    // Xarita bir marta yaratiladi; markaz o‘zgarishi alohida effektda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.isLoading]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !config.data) return;
    map.setStyle(styleFor(config.data, sat && config.data.satelliteAvailable));
  }, [sat, config.data]);

  useEffect(() => {
    if (center && mapRef.current) mapRef.current.easeTo({ center, zoom: Math.max(mapRef.current.getZoom(), zoom ?? 15) });
    // Faqat markaz qiymati o‘zgarganda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);

  const satOn = sat && !!config.data?.satelliteAvailable;
  const toggleSatellite = () => {
    if (!config.data?.satelliteAvailable) {
      pushToast(t('Sun’iy yo‘ldosh xaritasi vaqtincha mavjud emas — maydonni raqam bilan kiriting'), 'info');
      return;
    }
    setSat((value) => !value);
  };

  const locate = () => {
    if (!navigator.geolocation) return pushToast(t('Brauzer joylashuvni aniqlay olmaydi'), 'error');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: LngLat = [position.coords.longitude, position.coords.latitude];
        mapRef.current?.easeTo({ center: point, zoom: 16 });
        onLocate?.(point);
      },
      () => pushToast(t('Joylashuvni aniqlashga ruxsat berilmadi'), 'error'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className={cx('qs-map', className)}>
      <div ref={container} className="qs-map__canvas" role="region" aria-label={ariaLabel ?? t('Xarita')} />
      <div className="qs-map__tools">
        <button type="button" className={cx('qs-map__tool', satOn && 'is-on')} onClick={toggleSatellite} aria-pressed={satOn} title={t('Sun’iy yo‘ldosh')}>
          <Layers size={18} aria-hidden="true" /> <span>{satOn ? t('Xarita') : t('Sun’iy yo‘ldosh')}</span>
        </button>
        {onLocate && (
          <button type="button" className="qs-map__tool" onClick={locate} title={t('Mening joylashuvim')}>
            <LocateFixed size={18} aria-hidden="true" /> <span>{t('Mening joylashuvim')}</span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

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
