import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import maplibregl from 'maplibre-gl';
import type { Marker } from 'maplibre-gl';
import { MapPin, Star, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/common/EmptyState';
import { MapView, useMapHandle } from '@/features/map/MapView';
import { mapService, type MapShopsResponse } from '@/features/map/map.service';
import { usePointPicker } from '@/features/map/editors';
import { inUzbekistan, type LngLat } from '@/features/map/geometry';
import { SERVICE_TYPE } from '@/features/shop/labels';
import type { ServiceType } from '@/features/shop/types';
import { getErrorMessage } from '@/lib/error-messages';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/catalog/catalog.css';
import { formatNumber, formatRating } from '@/lib/format';
import { Chip } from '@/components/ui/Chip';

/** U7.3: do‘konlar xaritasi — viewport bo‘yicha server klasterlari/markerlar, nuqtaga xizmat ko‘rsatadiganlar ro‘yxati. */
export function MapPage() {
  const { map, onStyleReady } = useMapHandle();
  const [serviceType, setServiceType] = useState<ServiceType | ''>('');
  const [data, setData] = useState<MapShopsResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [point, setPoint] = useState<LngLat | null>(null);
  const markers = useRef<Marker[]>([]);
  const request = useRef(0);

  const load = useCallback(async () => {
    if (!map) return;
    const bounds = map.getBounds();
    const id = ++request.current;
    try {
      const result = await mapService.shops({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() }, map.getZoom(), serviceType || undefined);
      if (id === request.current) { setData(result); setError(null); }
    } catch (err) {
      if (id === request.current) setError(err);
    }
  }, [map, serviceType]);

  useEffect(() => {
    if (!map) return;
    const onMove = () => void load();
    onMove();
    map.on('moveend', onMove);
    return () => { map.off('moveend', onMove); };
  }, [map, load]);

  // DOM markerlar: klaster — son, marker — do‘kon bosh harfi.
  useEffect(() => {
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    if (!map || !data) return;
    for (const item of data.items) {
      const el = document.createElement('button');
      el.type = 'button';
      if (data.mode === 'clusters' && 'count' in item && item.count > 1) {
        const size = Math.min(64, 30 + Math.log2(item.count) * 8);
        el.className = 'qs-cluster';
        el.style.width = el.style.height = `${size}px`;
        el.textContent = String(item.count);
        el.setAttribute('aria-label', t('{n} ta do‘kon', { n: item.count }));
        el.onclick = () => map.easeTo({ center: [item.lon, item.lat], zoom: Math.min(map.getZoom() + 3, 14) });
      } else {
        el.className = 'qs-pin';
        const marker = 'shop' in item ? item : null;
        // Do‘kon nomi foydalanuvchi kiritmasi — HTML sifatida emas, matn sifatida qo‘yiladi.
        const letter = document.createElement('span');
        letter.textContent = (marker?.shop.name ?? '•').charAt(0).toUpperCase();
        el.replaceChildren(letter);
        el.setAttribute('aria-label', marker?.shop.name ?? t('Do‘kon'));
        el.onclick = () => {
          if (marker) setSelected(marker.shop.id);
          else map.easeTo({ center: [item.lon, item.lat], zoom: 14 });
        };
      }
      markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([item.lon, item.lat]).addTo(map));
    }
  }, [map, data]);

  usePointPicker(map, point, setPoint, false, '#16a34a');
  const card = useQuery({ queryKey: ['map', 'card', selected], queryFn: () => mapService.card(selected!), enabled: !!selected });
  const serving = useQuery({ queryKey: ['map', 'serving', point, serviceType], queryFn: () => mapService.serving(point!, serviceType || undefined), enabled: !!point });

  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Do‘konlar xaritasi')}</h1><p>{t('Yaqin do‘konlar va ularning xizmat hududlari.')}</p></div></div>
      <div className="qs-chips">
        <Chip onClick={() => setServiceType('')} selected={!serviceType}>{t('Barcha xizmatlar')}</Chip>
        {(Object.keys(SERVICE_TYPE) as ServiceType[]).map((type) => (
          <Chip key={type} onClick={() => setServiceType(type)} selected={serviceType === type}>{SERVICE_TYPE[type]}</Chip>
        ))}
      </div>
      {error ? <Alert tone="danger">{getErrorMessage(error)}</Alert> : null}
      <div className="qs-mappage">
        <MapView zoom={6} center={[64.6, 41.4]} onStyleReady={onStyleReady} onLocate={setPoint} ariaLabel={t('Do‘konlar xaritasi')}>
          {selected && (
            <div className="qs-map__card" role="dialog" aria-label={card.data?.name ?? t('Do‘kon')}>
              <header>
                <strong>{card.data?.name ?? '…'}</strong>
                <button type="button" className="qs-map__close" aria-label={t('Yopish')} onClick={() => setSelected(null)}><X size={16} /></button>
              </header>
              {card.data && (
                <>
                  <span className="qs-rating"><Star size={14} aria-hidden="true" /> {formatRating(card.data.ratingAvg)} <small className="qs-muted">({card.data.ratingCount})</small></span>
                  <small className="qs-muted">{card.data.serviceTypes.map((type) => SERVICE_TYPE[type]).join(' · ')}</small>
                  {card.data.branches[0] && <small><MapPin size={12} aria-hidden="true" /> {card.data.branches[0].address}</small>}
                  <Link className="gm-button gm-button--primary gm-button--sm" to={`/mijoz/dokonlar/${card.data.slug}`}>{t('Do‘kon sahifasi')}</Link>
                </>
              )}
            </div>
          )}
        </MapView>
        <aside className="qs-card">
          <h2>{t('Sizga xizmat ko‘rsatadiganlar')}</h2>
          {!point ? (
            <p className="qs-muted">{t('«Mening joylashuvim» tugmasini bosing — hududingizga xizmat ko‘rsatadigan do‘konlar shu yerda chiqadi.')}</p>
          ) : !inUzbekistan(point) ? (
            <Alert tone="warning">{t('Nuqta O‘zbekiston hududidan tashqarida.')}</Alert>
          ) : serving.isLoading ? <p className="qs-muted">…</p> : !serving.data?.length ? (
            <EmptyState title={t('Bu nuqtaga xizmat ko‘rsatadigan do‘kon topilmadi')} />
          ) : (
            <ul className="qs-list">
              {serving.data.map((shop) => (
                <li key={shop.id}>
                  <div><Link to={`/mijoz/dokonlar/${shop.slug}`}><strong>{shop.name}</strong></Link><small>{t('{km} km', { km: formatNumber(shop.distanceKm) })} · ★ {formatRating(shop.ratingAvg)}</small></div>
                </li>
              ))}
            </ul>
          )}
          <p className="qs-muted" style={{ fontSize: 12.5, marginBottom: 0 }}>{t('Joylashuvingiz saqlanmaydi va do‘konlarga yuborilmaydi.')}</p>
        </aside>
      </div>
    </div>
  );
}
