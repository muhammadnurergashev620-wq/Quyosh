import { ErrorState } from '@/components/ui/ErrorState';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageLoader } from '@/components/common/PageLoader';
import { MapView } from '@/features/map/MapView';
import { useMapHandle } from '@/features/map/MapView.helpers';
import { useGeoJsonLayer, usePointPicker, usePolygonEditor } from '@/features/map/editors';
import { ringAreaM2, selfIntersects, toPolygon, verticesOf, type LngLat } from '@/features/map/geometry';
import { useMapConfig } from '@/features/map/map-config';
import { mapService, type AreaType, type RoofShape, type ShadingLevel, type SiteArea } from '@/features/map/map.service';
import { AREA_TYPE, AZIMUTHS, ROOF_SHAPE, SHADING, SITE_TYPE } from '@/features/map/labels';
import { getErrorMessage } from '@/lib/error-messages';
import { regionName } from '@/lib/regions';
import { formatNumber } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/map/map.css';

const MAX_VERTICES = 500;
const m2 = (value: number | string) => `${formatNumber(Number(value))} m²`;

interface Draft {
  id: string | null;
  name: string;
  areaType: AreaType;
  roofShape: RoofShape;
  tiltDeg: string;
  azimuthDeg: string;
  shadingLevel: ShadingLevel;
  usableFactor: string;
  points: LngLat[];
}

const emptyDraft = (count: number): Draft => ({ id: null, name: count ? t('Maydon {n}', { n: count + 1 }) : t('Asosiy tom'), areaType: 'ROOF', roofShape: 'FLAT', tiltDeg: '30', azimuthDeg: '180', shadingLevel: 'NONE', usableFactor: '', points: [] });
const draftOf = (area: SiteArea): Draft => ({
  id: area.id, name: area.name, areaType: area.areaType, roofShape: area.roofShape, tiltDeg: area.tiltDeg ? String(Number(area.tiltDeg)) : '30',
  azimuthDeg: area.azimuthDeg === null ? '' : String(area.azimuthDeg), shadingLevel: area.shadingLevel, usableFactor: String(Number(area.usableFactor)), points: verticesOf(area.polygon),
});

/** U8.4: obyekt va o‘rnatish maydonlari — poligon muharriri (desktop va mobil), maydon serverda qayta hisoblanadi (TZ 11.3, 12). */
export function SiteDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const { map, styleVersion, onStyleReady } = useMapHandle();
  const site = useQuery({ queryKey: ['sites', id], queryFn: () => mapService.site(id) });
  const mapConfig = useMapConfig();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<SiteArea | null>(null);
  const [archiving, setArchiving] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['sites'] });
  };
  const save = useMutation({
    mutationFn: (value: Draft) => {
      const input = {
        name: value.name.trim(),
        areaType: value.areaType,
        roofShape: value.roofShape,
        polygon: toPolygon(value.points),
        tiltDeg: value.roofShape === 'PITCHED' ? Number(value.tiltDeg) || 30 : null,
        azimuthDeg: value.azimuthDeg === '' ? null : Number(value.azimuthDeg),
        shadingLevel: value.shadingLevel,
        usableFactor: value.usableFactor ? Number(value.usableFactor) : undefined,
      };
      return value.id ? mapService.updateArea(id, value.id, input) : mapService.addArea(id, input);
    },
    onSuccess: (area) => {
      pushToast(t('Maydon saqlandi: foydali {m}', { m: m2(area.usableAreaM2) }), 'success');
      setDraft(null);
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (areaId: string) => mapService.deleteArea(id, areaId), onSuccess: () => { setRemoving(null); refresh(); } });
  const archive = useMutation({ mutationFn: () => mapService.archiveSite(id), onSuccess: () => { refresh(); navigate('/mijoz/obyektlar'); } });

  const sitePoint: LngLat | null = site.data ? [site.data.lon, site.data.lat] : null;
  usePointPicker(map, sitePoint, () => undefined, false);
  const saved = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: (site.data?.areas ?? []).filter((area) => area.polygon && area.id !== draft?.id).map((area) => ({ type: 'Feature', properties: { id: area.id }, geometry: area.polygon! })),
  }), [site.data, draft?.id]);
  useGeoJsonLayer(map, styleVersion, 'qs-site-areas', saved, '#2563eb', 0.22);
  usePolygonEditor(map, styleVersion, draft?.points ?? [], (points) => setDraft((current) => (current ? { ...current, points: points.slice(0, MAX_VERTICES) } : current)), !!draft);

  if (site.isLoading) return <PageLoader />;
  if (site.isError || !site.data) return <ErrorState error={site.error} onRetry={() => void site.refetch()} />;
  const data = site.data;
  const preview = draft ? ringAreaM2(draft.points) : 0;
  const crossing = draft ? selfIntersects(draft.points) : false;
  const totalUsable = data.areas.reduce((sum, area) => sum + Number(area.usableAreaM2), 0);

  return (
    <div className="qs-page">
      <Link to="/mijoz/obyektlar" className="qs-muted qs-inline-flex qs-gap-2 qs-items-center"><ArrowLeft size={16} /> {t('Obyektlarim')}</Link>
      <div className="qs-page__head">
        <div>
          <h1>{data.title}</h1>
          <p>{[SITE_TYPE[data.siteType], regionName(data.regionCode), data.address].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="qs-page__actions">
          <Badge tone="primary">{t('Foydali maydon: {m}', { m: m2(totalUsable) })}</Badge>
          <Button variant="ghost" size="sm" onClick={() => setArchiving(true)}>{t('Arxivlash')}</Button>
        </div>
      </div>
      {mapConfig.data && !mapConfig.data.satelliteAvailable && <Alert tone="info">{t('Sun’iy yo‘ldosh xaritasi vaqtincha mavjud emas — maydonni raqam bilan kiriting')}. {t('Tez hisobda maydonni «Kichik / O‘rtacha / Katta» deb tanlash ham mumkin.')}</Alert>}
      {data.outsideUzbekistan && <Alert tone="warning">{t('Nuqta O‘zbekiston hududidan tashqarida. Hisob natijalari noaniq bo‘lishi mumkin.')}</Alert>}

      <section className="qs-editor">
        <MapView center={sitePoint ?? undefined} zoom={19} satellite onStyleReady={onStyleReady} ariaLabel={t('Maydon chizish xaritasi')}>
          {draft && (
            <div className="qs-map__overlay" aria-live="polite">
              <span>{draft.points.length < 3 ? t('Tom burchaklarini ketma-ket bosing ({n}/3)', { n: draft.points.length }) : <>{t('Taxminiy maydon')}: <strong>{m2(preview)}</strong></>}</span>
              <span className="qs-ml-auto qs-inline-flex qs-gap-2">
                <Button size="sm" variant="secondary" disabled={!draft.points.length} onClick={() => setDraft({ ...draft, points: draft.points.slice(0, -1) })}><Undo2 size={14} /> {t('Orqaga')}</Button>
                <Button size="sm" variant="ghost" disabled={!draft.points.length} onClick={() => setDraft({ ...draft, points: [] })}>{t('Tozalash')}</Button>
              </span>
            </div>
          )}
        </MapView>

        <div className="qs-card qs-form">
          {draft ? (
            <>
              <h2 className="qs-m-0">{draft.id ? t('Maydonni tahrirlash') : t('Yangi maydon')}</h2>
              <Input label={t('Nomi')} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} />
              <div className="qs-form__row">
                <Select label={t('Joy turi')} value={draft.areaType} onChange={(e) => setDraft({ ...draft, areaType: e.target.value as AreaType, roofShape: e.target.value === 'ROOF' ? draft.roofShape : 'FLAT' })} options={(Object.keys(AREA_TYPE) as AreaType[]).map((value) => ({ value, label: AREA_TYPE[value] }))} />
                {draft.areaType === 'ROOF' && <Select label={t('Tom shakli')} value={draft.roofShape} onChange={(e) => setDraft({ ...draft, roofShape: e.target.value as RoofShape, usableFactor: '' })} options={(Object.keys(ROOF_SHAPE) as RoofShape[]).map((value) => ({ value, label: ROOF_SHAPE[value] }))} />}
              </div>
              <div className="qs-form__row">
                {draft.roofShape === 'PITCHED' && <Input label={t('Qiyalik, °')} inputMode="numeric" value={draft.tiltDeg} onChange={(e) => setDraft({ ...draft, tiltDeg: e.target.value.replace(/[^\d.]/g, '').slice(0, 4) })} hint={t('Odatda 20–35°')} />}
                <Select label={t('Yo‘nalish')} value={draft.azimuthDeg} onChange={(e) => setDraft({ ...draft, azimuthDeg: e.target.value })} options={[{ value: '', label: t('Bilmayman') }, ...AZIMUTHS.map((item) => ({ value: String(item.value), label: `${item.label} (${item.value}°)` }))]} />
                <Select label={t('Soya')} value={draft.shadingLevel} onChange={(e) => setDraft({ ...draft, shadingLevel: e.target.value as ShadingLevel })} options={(Object.keys(SHADING) as ShadingLevel[]).map((value) => ({ value, label: SHADING[value] }))} />
              </div>
              <Input label={t('Foydali qism koeffitsienti (ixtiyoriy)')} inputMode="decimal" value={draft.usableFactor} placeholder={draft.roofShape === 'PITCHED' ? '0.70' : '0.80'} onChange={(e) => setDraft({ ...draft, usableFactor: e.target.value.replace(/[^\d.]/g, '').slice(0, 4) })} hint={t('Mo‘ri, ventilyatsiya va o‘tish yo‘laklari uchun joy qoldiriladi')} />
              {crossing && <Alert tone="warning">{t('Chiziqlar kesishib qoldi — nuqtalarni sudrab to‘g‘rilang.')}</Alert>}
              {draft.points.length >= MAX_VERTICES && <Alert tone="warning">{t('Eng ko‘pi 500 ta nuqta.')}</Alert>}
              {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
              <p className="qs-muted qs-m-0 qs-fs-13">{t('Ko‘rsatilgan maydon taxminiy; aniq qiymat saqlanganda serverda hisoblanadi.')}</p>
              <div className="qs-form__actions">
                <Button variant="ghost" onClick={() => setDraft(null)}>{t('Bekor qilish')}</Button>
                <Button disabled={draft.points.length < 3 || crossing || !draft.name.trim()} loading={save.isPending} onClick={() => save.mutate(draft)}>{t('Saqlash')}</Button>
              </div>
            </>
          ) : (
            <>
              <header className="qs-flex qs-items-center qs-gap-2">
                <h2 className="qs-m-0 qs-flex-1">{t('O‘rnatish maydonlari')}</h2>
                <Button size="sm" onClick={() => { save.reset(); setDraft(emptyDraft(data.areas.length)); }}><Plus size={16} /> {t('Maydon chizish')}</Button>
              </header>
              {!data.areas.length ? (
                <p className="qs-muted">{t('Tom yoki hovlidagi bo‘sh joyni xaritada chizing. Bir nechta maydon (asosiy tom, garaj) qo‘shish mumkin.')}</p>
              ) : (
                <ul className="qs-list">
                  {data.areas.map((area) => (
                    <li key={area.id}>
                      <div>
                        <strong>{area.name}</strong>
                        <small>{[AREA_TYPE[area.areaType], area.areaType === 'ROOF' ? ROOF_SHAPE[area.roofShape] : null, area.tiltDeg && area.roofShape === 'PITCHED' ? `${Number(area.tiltDeg)}°` : null, SHADING[area.shadingLevel]].filter(Boolean).join(' · ')}</small>
                        <small>{t('Proyeksiya {a} · yuza {b} · foydali {c}', { a: m2(area.projectedAreaM2), b: m2(area.surfaceAreaM2), c: m2(area.usableAreaM2) })}</small>
                      </div>
                      <span className="qs-page__actions">
                        <Button size="sm" variant="secondary" aria-label={t('Tahrirlash')} onClick={() => { save.reset(); setDraft(draftOf(area)); }}><Pencil size={14} /></Button>
                        <Button size="sm" variant="ghost" aria-label={t('O‘chirish')} onClick={() => setRemoving(area)}><Trash2 size={14} /></Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={!!removing}
        title={t('Maydonni o‘chirish')}
        description={t('«{name}» maydoni o‘chiriladi.', { name: removing?.name ?? '' })}
        confirmLabel={t('O‘chirish')}
        tone="danger"
        showCancel
        cancelLabel={t('Bekor qilish')}
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
        onCancel={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={archiving}
        title={t('Obyektni arxivlash')}
        description={t('Obyekt ro‘yxatdan olinadi. Saqlangan hisoblar o‘zgarmaydi.')}
        confirmLabel={t('Arxivlash')}
        tone="danger"
        showCancel
        cancelLabel={t('Bekor qilish')}
        loading={archive.isPending}
        onConfirm={() => archive.mutate()}
        onCancel={() => setArchiving(false)}
      />
    </div>
  );
}
