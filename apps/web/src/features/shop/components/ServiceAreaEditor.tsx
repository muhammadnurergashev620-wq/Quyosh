import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { MapView, useMapHandle } from '@/features/map/MapView';
import { useGeoJsonLayer, usePointPicker, usePolygonEditor } from '@/features/map/editors';
import { ringAreaM2, selfIntersects, toPolygon, type LngLat } from '@/features/map/geometry';
import { mapService } from '@/features/map/map.service';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import type { Branch } from '../types';
import { t } from '@/i18n';
import '@/features/map/map.css';
import { Chip } from '@/components/ui/Chip';
import { TabBar } from '@/components/ui/Tabs';

const RADII = [10, 25, 50, 80];

/** U11.8: xizmat hududi — filial atrofida radius (tez tanlov) yoki xaritada poligon chizish. Max 20 000 km² (serverda tekshiriladi). */
export function ServiceAreaEditor({ shopId, branch, onDone }: { shopId: string; branch: Branch; onDone: () => void }) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const { map, styleVersion, onStyleReady } = useMapHandle();
  const [mode, setMode] = useState<'radius' | 'draw'>('radius');
  const [radius, setRadius] = useState(25);
  const [points, setPoints] = useState<LngLat[]>([]);
  const current = useQuery({ queryKey: ['shop', shopId, 'service-area', branch.id], queryFn: () => mapService.serviceArea(shopId, branch.id) });
  const center: LngLat | null = branch.lat != null && branch.lon != null ? [branch.lon, branch.lat] : null;
  const existing = useMemo<GeoJSON.FeatureCollection>(() => ({ type: 'FeatureCollection', features: current.data ? [{ type: 'Feature', properties: {}, geometry: current.data.geometry }] : [] }), [current.data]);
  useGeoJsonLayer(map, styleVersion, 'qs-service-area', existing, '#16a34a', 0.15);
  usePointPicker(map, center, () => undefined, false);
  usePolygonEditor(map, styleVersion, points, setPoints, mode === 'draw', '#f59e0b');
  const save = useMutation({
    mutationFn: () => mapService.putServiceArea(shopId, branch.id, mode === 'radius' ? { radiusKm: radius } : { geometry: toPolygon(points) }),
    onSuccess: (result) => {
      pushToast(t('Xizmat hududi saqlandi: {km} km²', { km: formatNumber(Number(result.areaKm2)) }), 'success');
      void queryClient.invalidateQueries({ queryKey: ['shop', shopId] });
      onDone();
    },
  });
  const crossing = selfIntersects(points);
  const previewKm2 = ringAreaM2(points) / 1e6;

  if (!center) return <Alert tone="warning">{t('Avval filialning xaritadagi nuqtasini belgilang (filialni tahrirlash).')}</Alert>;
  return (
    <div className="qs-form">
      {current.data && <Alert tone="info">{t('Hozirgi hudud: {km} km². Yangisi saqlansa, almashtiriladi.', { km: formatNumber(Number(current.data.areaKm2)) })}</Alert>}
      <TabBar variant="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'radius'} className={cx(mode === 'radius' && 'is-on')} onClick={() => setMode('radius')}>{t('Radius bo‘yicha')}</button>
        <button type="button" role="tab" aria-selected={mode === 'draw'} className={cx(mode === 'draw' && 'is-on')} onClick={() => setMode('draw')}>{t('Xaritada chizish')}</button>
      </TabBar>
      {mode === 'radius' ? (
        <div className="qs-chips">
          {RADII.map((value) => (
            <Chip key={value} onClick={() => setRadius(value)} selected={radius === value}>{t('{n} km', { n: value })}</Chip>
          ))}
        </div>
      ) : (
        <p className="qs-muted" style={{ margin: 0 }}>{t('Hudud chegarasini xaritada ketma-ket bosib chizing; nuqtalarni sudrab tuzatish mumkin.')}</p>
      )}
      <MapView center={center} zoom={mode === 'radius' ? 8 : 9} onStyleReady={onStyleReady} className="qs-map--form" ariaLabel={t('Xizmat hududi xaritasi')}>
        {mode === 'draw' && (
          <div className="qs-map__overlay">
            <span>{points.length < 3 ? t('Kamida 3 nuqta ({n}/3)', { n: points.length }) : t('Taxminan {km} km²', { km: formatNumber(previewKm2) })}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
              <Button size="sm" variant="secondary" disabled={!points.length} onClick={() => setPoints(points.slice(0, -1))}><Undo2 size={14} /></Button>
              <Button size="sm" variant="ghost" disabled={!points.length} onClick={() => setPoints([])}>{t('Tozalash')}</Button>
            </span>
          </div>
        )}
      </MapView>
      {crossing && <Alert tone="warning">{t('Chiziqlar kesishib qoldi — nuqtalarni sudrab to‘g‘rilang.')}</Alert>}
      {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
      <div className="qs-form__actions">
        <Button variant="ghost" onClick={onDone}>{t('Bekor qilish')}</Button>
        <Button loading={save.isPending} disabled={mode === 'draw' && (points.length < 3 || crossing)} onClick={() => save.mutate()}>{t('Hududni saqlash')}</Button>
      </div>
    </div>
  );
}
