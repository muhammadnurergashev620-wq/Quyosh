import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronUp, Crosshair, Plus, Trash2, Undo2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { MapView, useMapHandle } from '@/features/map/MapView';
import { useGeoJsonLayer, usePointPicker, usePolygonEditor } from '@/features/map/editors';
import { closeRing, inUzbekistan, ringAreaM2, selfIntersects, toPolygon, type LngLat } from '@/features/map/geometry';
import { mapService } from '@/features/map/map.service';
import { AZIMUTHS, ROOF_SHAPE, SHADING } from '@/features/map/labels';
import { calcService } from '@/features/calc/calc.service';
import { useEstimate } from '@/features/calc/useEstimate';
import { Kpis } from '@/features/calc/ResultView';
import { kw, kwh, LIMITING, OPTION_LABEL, sum, sumShort, SYSTEM_TYPE, WARNING_TEXT } from '@/features/calc/labels';
import type { ApplianceRow, AreaPreset, EstimateInput, Shading, SystemType } from '@/features/calc/types';
import { i18nText } from '@/features/catalog/format';
import { AddressSearch } from '@/pages/map/SitesPage';
import type { QuickState } from './QuickCalcPage';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatNumber, formatPercent } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import { track } from '@/features/m7/track';
import '@/features/shop/shop.css';
import '@/features/map/map.css';
import '@/features/calc/calc.css';

const DETAILED_DRAFT_KIND = 'detailed';

interface DrawnArea { id: string; name: string; points: LngLat[]; roofShape: 'FLAT' | 'PITCHED'; tiltDeg: number; azimuthDeg: number | null; shadingLevel: Shading }
type ConsumptionTab = 'kwh' | 'bill' | 'twelve' | 'appliances';
type FinancingKind = 'CASH' | 'LOAN';

export interface DetailedState {
  step: number;
  point: LngLat | null;
  address: string;
  siteId: string | null;
  areaMode: 'DRAW' | 'SITE' | 'PRESET' | 'MANUAL';
  areas: DrawnArea[];
  preset: AreaPreset;
  manualM2: string;
  consumptionTab: ConsumptionTab;
  kwhValue: string;
  billValue: string;
  months: string[];
  appliances: ApplianceRow[];
  templateCode: string | null;
  systemType: SystemType;
  option: 'ECONOMY' | 'BALANCED' | 'MAXIMUM' | null;
  costs: { equipmentCost: string; installationCost: string; deliveryCost: string; otherCost: string };
  financing: { kind: FinancingKind; productId: string; annualRate: string; termMonths: number; downPayment: string; paymentType: 'ANNUITY' | 'DIFFERENTIATED' };
}

const initialState = (): DetailedState => ({
  step: 1, point: null, address: '', siteId: null, areaMode: 'DRAW', areas: [], preset: 'MEDIUM', manualM2: '',
  consumptionTab: 'kwh', kwhValue: '', billValue: '', months: new Array(12).fill(''), appliances: [], templateCode: null,
  systemType: 'ON_GRID', option: null, costs: { equipmentCost: '', installationCost: '', deliveryCost: '', otherCost: '' },
  financing: { kind: 'CASH', productId: '', annualRate: '', termMonths: 24, downPayment: '', paymentType: 'ANNUITY' },
});

const STEPS = [t('Joylashuv'), t('Maydon'), t('Elektr sarfi'), t('Tizim'), t('Xarajatlar'), t('Moliyalashtirish')];
const num = (value: string) => Number(value.replace(/\s/g, '').replace(',', '.'));

/** Holatdan hisob kirishi (faqat zarur qismlar to‘lgan bo‘lsa). */
function detailedInput(state: DetailedState, options: Array<{ key: string; kwp: number }> = []): EstimateInput | null {
  if (!state.point && !state.siteId) return null;
  const input: EstimateInput = { mode: 'DETAILED', systemType: state.systemType, consumption: {} };
  if (state.siteId) input.siteId = state.siteId;
  else { input.lat = state.point![1]; input.lon = state.point![0]; }
  const closed = state.areas.filter((area) => area.points.length >= 3 && !selfIntersects(area.points));
  if (state.areaMode === 'DRAW' && closed.length) input.areas = closed.map((area) => ({ polygon: toPolygon(area.points), roofShape: area.roofShape, tiltDeg: area.tiltDeg, azimuthDeg: area.azimuthDeg ?? undefined, shadingLevel: area.shadingLevel }));
  if (state.areaMode === 'PRESET') input.areaPreset = state.preset;
  if (state.areaMode === 'MANUAL' && num(state.manualM2) > 0) input.areaM2 = num(state.manualM2);
  switch (state.consumptionTab) {
    case 'kwh': if (num(state.kwhValue) > 0) input.consumption = { monthlyKwh: num(state.kwhValue) }; break;
    case 'bill': if (num(state.billValue) > 0) input.consumption = { billAmount: num(state.billValue) }; break;
    case 'twelve': if (state.months.every((m) => m !== '')) input.consumption = { months: state.months.map(num) }; break;
    case 'appliances': if (state.appliances.length) input.consumption = { appliances: state.appliances }; break;
  }
  if (!Object.keys(input.consumption).length) return null;
  const chosen = options.find((o) => o.key === state.option);
  if (chosen && state.option !== 'BALANCED') input.kwp = chosen.kwp;
  const costs = Object.fromEntries(Object.entries(state.costs).filter(([, v]) => v !== '').map(([k, v]) => [k, num(v)]));
  if (Object.keys(costs).length) input.costs = costs as EstimateInput['costs'];
  if (state.financing.kind === 'LOAN' && (state.financing.productId || state.financing.annualRate)) {
    input.financing = { productId: state.financing.productId || undefined, annualRate: state.financing.productId ? undefined : num(state.financing.annualRate) / 100, termMonths: state.financing.termMonths, paymentType: state.financing.paymentType, downPayment: num(state.financing.downPayment) || 0 };
  }
  return input;
}

function StepNav({ step, maxDone, onGo }: { step: number; maxDone: number; onGo: (step: number) => void }) {
  return (
    <ol className="qs-steps" aria-label={t('Qadamlar')}>
      {STEPS.map((label, index) => (
        <li key={label} className={cx(index + 1 < step && 'is-done', index + 1 === step && 'is-current')}>
          <button type="button" disabled={index + 1 > maxDone + 1} onClick={() => onGo(index + 1)} aria-current={index + 1 === step ? 'step' : undefined}>{index + 1}. {label}</button>
        </li>
      ))}
    </ol>
  );
}

/** U8.4: maydonlarni chizish — desktop bosish, mobil krest + «Nuqta qo‘shish» (TZ 4.10). */
function AreaStep({ state, set, result }: { state: DetailedState; set: (patch: Partial<DetailedState>) => void; result: ReturnType<typeof useEstimate>['result'] }) {
  const { map, styleVersion, onStyleReady } = useMapHandle();
  const hasSession = useAuthStore((s) => s.hasSession);
  const sites = useQuery({ queryKey: ['sites'], queryFn: mapService.sites, enabled: hasSession });
  const [active, setActive] = useState<string | null>(state.areas.find((a) => a.points.length < 3)?.id ?? null);
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
  const current = state.areas.find((area) => area.id === active) ?? null;
  const updateArea = (id: string, patch: Partial<DrawnArea>) => set({ areas: state.areas.map((area) => (area.id === id ? { ...area, ...patch } : area)) });
  const others = useMemo<GeoJSON.FeatureCollection>(() => ({ type: 'FeatureCollection', features: state.areas.filter((a) => a.id !== active && a.points.length >= 3).map((a) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closeRing(a.points)] } })) }), [state.areas, active]);
  useGeoJsonLayer(map, styleVersion, 'qs-wizard-areas', others, '#2563eb', 0.22);
  usePolygonEditor(map, styleVersion, current?.points ?? [], (points) => current && updateArea(current.id, { points: points.slice(0, 500) }), !!current && !mobile);
  usePointPicker(map, state.point, () => undefined, false);
  const addArea = () => {
    const id = crypto.randomUUID();
    set({ areas: [...state.areas, { id, name: state.areas.length ? t('Maydon {n}', { n: state.areas.length + 1 }) : t('Asosiy tom'), points: [], roofShape: 'FLAT', tiltDeg: 30, azimuthDeg: 180, shadingLevel: 'NONE' }] });
    setActive(id);
  };
  const addCenter = () => {
    if (!map || !current) return;
    const c = map.getCenter();
    updateArea(current.id, { points: [...current.points, [c.lng, c.lat]] });
    navigator.vibrate?.(10);
  };

  return (
    <div className="qs-form">
      <div className="qs-segment" role="group" aria-label={t('Maydon usuli')}>
        {([['DRAW', t('Xaritada chizish')], ...(hasSession ? [['SITE', t('Saqlangan obyekt')]] : []), ['PRESET', t('Taxminiy hajm')], ['MANUAL', t('Raqam bilan')]] as Array<[DetailedState['areaMode'], string]>).map(([key, label]) => (
          <button key={key} type="button" className={cx(state.areaMode === key && 'is-on')} onClick={() => set({ areaMode: key, siteId: key === 'SITE' ? state.siteId : null })}>{label}</button>
        ))}
      </div>
      {state.areaMode === 'DRAW' && (
        <>
          <div className="qs-map-draw">
            <MapView center={state.point ?? undefined} zoom={19} satellite onStyleReady={onStyleReady} className="qs-map--draw" ariaLabel={t('Maydon chizish xaritasi')}>
              {mobile && current && <div className="qs-map__crosshair" aria-hidden="true"><Crosshair size={30} /></div>}
              {current && (
                <div className="qs-map__overlay">
                  <span>{current.points.length < 3 ? t('Tom burchaklarini ketma-ket belgilang ({n}/3)', { n: current.points.length }) : <>{t('Taxminiy maydon')}: <strong>{formatNumber(ringAreaM2(current.points))} m²</strong></>}</span>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                    {mobile && <Button size="sm" onClick={addCenter}><Plus size={14} /> {t('Nuqta qo‘shish')}</Button>}
                    <Button size="sm" variant="secondary" disabled={!current.points.length} onClick={() => updateArea(current.id, { points: current.points.slice(0, -1) })} aria-label={t('Orqaga')}><Undo2 size={14} /></Button>
                    <Button size="sm" variant="ghost" disabled={current.points.length < 3} onClick={() => setActive(null)}>{t('Yopish')}</Button>
                  </span>
                </div>
              )}
            </MapView>
          </div>
          {current && selfIntersects(current.points) && <Alert tone="warning">{t('Chiziqlar kesishib qoldi — nuqtalarni sudrab to‘g‘rilang.')}</Alert>}
          <ul className="qs-list">
            {state.areas.map((area) => (
              <li key={area.id} className={cx(area.id === active && 'is-active')}>
                <div>
                  <Input label={t('Nomi')} value={area.name} onChange={(e) => updateArea(area.id, { name: e.target.value })} />
                  <div className="qs-form__row" style={{ marginTop: 8 }}>
                    <Select label={t('Tom shakli')} value={area.roofShape} onChange={(e) => updateArea(area.id, { roofShape: e.target.value as 'FLAT' | 'PITCHED' })} options={(['FLAT', 'PITCHED'] as const).map((v) => ({ value: v, label: ROOF_SHAPE[v] }))} />
                    {area.roofShape === 'PITCHED' && <Select label={t('Qiyalik')} value={String(area.tiltDeg)} onChange={(e) => updateArea(area.id, { tiltDeg: Number(e.target.value) })} options={[15, 30, 45].map((v) => ({ value: String(v), label: `${v}°` }))} />}
                    <Select label={t('Yo‘nalish')} value={area.azimuthDeg === null ? '' : String(area.azimuthDeg)} onChange={(e) => updateArea(area.id, { azimuthDeg: e.target.value === '' ? null : Number(e.target.value) })} options={[{ value: '', label: t('Bilmayman') }, ...AZIMUTHS.map((a) => ({ value: String(a.value), label: a.label }))]} />
                    <Select label={t('Soya')} value={area.shadingLevel} onChange={(e) => updateArea(area.id, { shadingLevel: e.target.value as Shading })} options={(['NONE', 'LIGHT', 'HEAVY'] as const).map((v) => ({ value: v, label: SHADING[v] }))} />
                  </div>
                  <small>{area.points.length >= 3 ? t('Taxminan {m} m² (aniq qiymat serverda)', { m: formatNumber(ringAreaM2(area.points)) }) : t('Chizilmagan')}</small>
                </div>
                <span className="qs-page__actions">
                  {area.id !== active && <Button size="sm" variant="secondary" onClick={() => setActive(area.id)}>{t('Tahrirlash')}</Button>}
                  <Button size="sm" variant="ghost" aria-label={t('O‘chirish')} onClick={() => { set({ areas: state.areas.filter((a) => a.id !== area.id) }); if (active === area.id) setActive(null); }}><Trash2 size={14} /></Button>
                </span>
              </li>
            ))}
          </ul>
          <div className="qs-page__actions">
            <Button variant="secondary" onClick={addArea}><Plus size={16} /> {state.areas.length ? t('Yana maydon (garaj, qo‘shimcha bino)') : t('Maydon chizish')}</Button>
            <button type="button" className="qs-chart__toggle" onClick={() => set({ areaMode: 'PRESET' })}>{t('Taxminiy hajm bilan davom etish')}</button>
          </div>
        </>
      )}
      {state.areaMode === 'SITE' && (
        sites.data?.length ? (
          <div className="qs-choice">
            {sites.data.map((site) => (
              <button key={site.id} type="button" className={cx(state.siteId === site.id && 'is-on')} onClick={() => set({ siteId: site.id, point: [site.lon, site.lat] })}>
                <strong>{site.title}</strong><small>{t('{n} ta maydon · foydali {m} m²', { n: site.areaCount, m: formatNumber(Number(site.usableAreaM2)) })}</small>
              </button>
            ))}
          </div>
        ) : <Alert tone="info">{t('Saqlangan obyekt yo‘q. «Obyektlarim» bo‘limida qo‘shing yoki shu yerda chizing.')}</Alert>
      )}
      {state.areaMode === 'PRESET' && (
        <div className="qs-choice">
          {(['SMALL', 'MEDIUM', 'LARGE'] as const).map((size) => (
            <button key={size} type="button" className={cx(state.preset === size && 'is-on')} onClick={() => set({ preset: size })}><strong>{size === 'SMALL' ? t('Kichik') : size === 'MEDIUM' ? t('O‘rtacha') : t('Katta')}</strong><small>≈ {size === 'SMALL' ? 20 : size === 'MEDIUM' ? 40 : 80} m²</small></button>
          ))}
        </div>
      )}
      {state.areaMode === 'MANUAL' && <Input label={t('Bo‘sh maydon, m²')} inputMode="decimal" value={state.manualM2} onChange={(e) => set({ manualM2: e.target.value.replace(/[^\d.,]/g, '') })} hint={t('Sun’iy yo‘ldosh xaritasi bo‘lmasa yoki tom o‘lchami ma’lum bo‘lsa')} />}
      {result?.projectedAreaM2 != null && (
        <p className="qs-stat-line">
          <span>{t('Proyeksiya')}: <b>{formatNumber(result.projectedAreaM2)} m²</b></span>
          <span>{t('Tom yuzasi')}: <b>{formatNumber(result.surfaceAreaM2 ?? 0)} m²</b></span>
          <span>{t('Foydali')}: <b>{formatNumber(result.usableAreaM2 ?? 0)} m²</b></span>
          <span>{t('Panellar')}: <b>{result.panelCountEstimate}</b></span>
        </p>
      )}
    </div>
  );
}

/** U8.5: maishiy texnika ro‘yxati — shablonlar, soni, quvvati, soatlari, oylar, «uzilishda ham». */
function AppliancesEditor({ rows, onChange }: { rows: ApplianceRow[]; onChange: (rows: ApplianceRow[]) => void }) {
  const reference = useQuery({ queryKey: ['calc', 'reference'], queryFn: calcService.reference, staleTime: 10 * 60_000 });
  const types = reference.data?.appliances ?? [];
  const nameOf = (code?: string) => { const type = types.find((item) => item.code === code); return type ? i18nText(type.nameI18n as { uz: string }) : t('Texnika'); };
  const update = (index: number, patch: Partial<ApplianceRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const monthly = rows.reduce((sum, row) => sum + (row.powerW * row.count * row.hoursPerDay * 30.4 * ((row.months?.length || 12) / 12)) / 1000, 0) * 1.1;
  const critical = rows.filter((row) => row.isCritical).reduce((sum, row) => sum + row.powerW * row.count, 0) / 1000;
  return (
    <div className="qs-form">
      <div className="qs-chips">
        {reference.data?.templates.map((template) => (
          <button key={template.code} type="button" className="qs-chip" onClick={() => onChange(template.itemsJson.flatMap((item) => { const type = types.find((x) => x.code === item.applianceTypeCode); return type ? [{ code: type.code, powerW: type.defaultPowerW, count: item.count, hoursPerDay: item.hoursPerDay, months: type.defaultMonths, isCritical: !!item.isCritical }] : []; }))}>
            {i18nText(template.nameI18n as { uz: string })}
          </button>
        ))}
      </div>
      <div className="qs-appliances">
        {rows.map((row, index) => (
          <div key={index} className="qs-appliance">
            <strong>{nameOf(row.code)}</strong>
            <label>{t('Soni')}<input className="qs-input-sm" inputMode="numeric" value={row.count} onChange={(e) => update(index, { count: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })} /></label>
            <label>{t('Quvvat, Vt')}<input className="qs-input-sm" inputMode="numeric" value={row.powerW} onChange={(e) => update(index, { powerW: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })} /></label>
            <label>{t('Soat/kun')}<input className="qs-input-sm" inputMode="decimal" value={row.hoursPerDay} onChange={(e) => update(index, { hoursPerDay: Math.min(24, Number(e.target.value.replace(',', '.')) || 0) })} /></label>
            <label className="qs-check" title={t('Uzilishda ham ishlashi kerak')}><input type="checkbox" checked={!!row.isCritical} onChange={(e) => update(index, { isCritical: e.target.checked })} /> {t('Uzilishda')}</label>
            <Button size="sm" variant="ghost" aria-label={t('O‘chirish')} onClick={() => onChange(rows.filter((_, i) => i !== index))}><Trash2 size={14} /></Button>
          </div>
        ))}
      </div>
      <select className="qs-select" aria-label={t('Texnika qo‘shish')} value="" onChange={(e) => { const type = types.find((x) => x.code === e.target.value); if (type) onChange([...rows, { code: type.code, powerW: type.defaultPowerW, count: 1, hoursPerDay: Number(type.defaultHoursPerDay), months: type.defaultMonths, isCritical: false }]); }}>
        <option value="">{t('+ Texnika qo‘shish…')}</option>
        {types.map((type) => <option key={type.code} value={type.code}>{i18nText(type.nameI18n as { uz: string })} · {type.defaultPowerW} W</option>)}
      </select>
      <p className="qs-stat-line">
        <span>{t('Oylik')}: <b>{kwh(Math.round(monthly))}</b></span>
        <span>{t('Yillik')}: <b>{kwh(Math.round(monthly * 12))}</b></span>
        <span>{t('Kritik yuklama')}: <b>{kw(critical)}</b></span>
        <small className="qs-muted">{t('+10 % hisobga olinmagan mayda iste’mol qo‘shilgan')}</small>
      </p>
      {critical > 0 && <Alert tone="info">{t('Uzilishda ishlashi uchun gibrid tizim kerak — 4-qadamda gibrid tanlanadi.')}</Alert>}
    </div>
  );
}

/** U8.2–U8.8: 6 qadamli Batafsil hisob; o‘ngda jonli natija paneli; qadam URL’da; draft avtomatik. */
export function DetailedCalcPage() {
  useEffect(() => track({ eventType: 'calc_started', properties: { mode: 'DETAILED' } }, 'calc-start-detailed'), []);
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const hasSession = useAuthStore((s) => s.hasSession);
  const pushToast = useAppStore((s) => s.pushToast);
  const reference = useQuery({ queryKey: ['calc', 'reference'], queryFn: calcService.reference, staleTime: 10 * 60_000 });
  const [state, setState] = useState<DetailedState>(initialState);
  const [committed, setCommitted] = useState<DetailedState>(state);
  const [panelOpen, setPanelOpen] = useState(false);
  const restored = useRef(false);
  const { map, onStyleReady } = useMapHandle();
  const step = Math.min(6, Math.max(1, Number(params.get('qadam')) || 1));

  const set = (patch: Partial<DetailedState>, commitNow = true) => {
    setState((current) => {
      const next = { ...current, ...patch };
      if (commitNow) setCommitted(next);
      return next;
    });
  };
  const go = (next: number) => {
    setCommitted(state);
    setParams({ qadam: String(next) });
    void calcService.saveDraft({ kind: DETAILED_DRAFT_KIND, state: { ...state, step: next } }).catch(() => undefined);
  };

  // Tez hisobdan kelgan qiymatlar yoki draft (U8.15).
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const fromQuick = (location.state as { fromQuick?: QuickState } | null)?.fromQuick;
    if (fromQuick) {
      const next = { ...initialState(), point: fromQuick.point, areaMode: (step === 2 ? 'DRAW' : 'PRESET') as DetailedState['areaMode'], preset: fromQuick.size ?? 'MEDIUM', consumptionTab: (fromQuick.mode === 'bill' ? 'bill' : 'kwh') as ConsumptionTab, kwhValue: fromQuick.mode === 'kwh' ? fromQuick.value : '', billValue: fromQuick.mode === 'bill' ? fromQuick.value : '' };
      setState(next);
      setCommitted(next);
      return;
    }
    void calcService.getDraft().then((draft) => {
      const saved = draft?.input as { kind?: string; state?: DetailedState } | undefined;
      if (saved?.kind === DETAILED_DRAFT_KIND && saved.state) {
        setState(saved.state);
        setCommitted(saved.state);
        pushToast(t('Oldingi hisobingiz tiklandi ({n}-qadam)', { n: saved.state.step }), 'info');
      }
    }).catch(() => undefined);
    // Bir marta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [options, setOptions] = useState<Array<{ key: string; kwp: number }>>([]);
  const input = useMemo(() => detailedInput(committed, options), [committed, options]);
  const estimate = useEstimate(input);
  const result = estimate.result;
  useEffect(() => {
    if (result && !committed.option) setOptions(result.sizingOptions);
  }, [result, committed.option]);
  usePointPicker(map, state.point, (point) => set({ point, siteId: null }));

  const consumptionTabs: Array<[ConsumptionTab, string]> = [['kwh', t('Oylik kWh')], ['bill', t('Oylik to‘lov')], ['twelve', t('12 oy')], ['appliances', t('Texnika ro‘yxati')]];
  const hasCritical = state.appliances.some((row) => row.isCritical);
  const product = reference.data?.financing.find((item) => item.id === state.financing.productId);
  const save = useMutation({ mutationFn: () => calcService.save(input!), onSuccess: (saved) => { void calcService.deleteDraft(); navigate(`/mijoz/natija/${saved.id}`); }, onError: (error) => pushToast(getErrorMessage(error), 'error') });

  let body: ReactNode = null;
  if (step === 1) {
    body = (
      <div className="qs-form">
        <AddressSearch onPick={(point, label) => set({ point, address: label, siteId: null })} />
        <MapView center={state.point ?? undefined} zoom={state.point ? 16 : 10} onStyleReady={onStyleReady} onLocate={(point) => set({ point, siteId: null })} ariaLabel={t('Joylashuv xaritasi')}>
          {!state.point && <div className="qs-map__overlay">{t('Uyingiz joylashgan nuqtani bosing')}</div>}
        </MapView>
        {state.point && !inUzbekistan(state.point) && <Alert tone="warning">{t('Nuqta O‘zbekiston hududidan tashqarida.')}</Alert>}
        {result?.status === 'TARIFF_NOT_FOUND' && <Alert tone="warning">{t('Bu hudud uchun tarif ma’lumoti yo‘q — moliyaviy natijalar kWh asosida chiqadi.')}</Alert>}
      </div>
    );
  } else if (step === 2) {
    body = <AreaStep state={state} set={(patch) => set(patch)} result={result} />;
  } else if (step === 3) {
    body = (
      <div className="qs-form">
        <div className="qs-segment" role="tablist">{consumptionTabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={state.consumptionTab === key} className={cx(state.consumptionTab === key && 'is-on')} onClick={() => set({ consumptionTab: key })}>{label}</button>)}</div>
        {state.consumptionTab === 'kwh' && <Input label={t('O‘rtacha oylik sarf, kWh')} inputMode="numeric" value={state.kwhValue} onChange={(e) => set({ kwhValue: e.target.value.replace(/[^\d]/g, '') }, false)} onBlur={() => setCommitted(state)} />}
        {state.consumptionTab === 'bill' && <Input label={t('O‘rtacha oylik to‘lov, so‘m')} inputMode="numeric" value={state.billValue} onChange={(e) => set({ billValue: e.target.value.replace(/[^\d]/g, '') }, false)} onBlur={() => setCommitted(state)} />}
        {state.consumptionTab === 'twelve' && (
          <>
            <div className="qs-months">
              {state.months.map((value, m) => <Input key={m} label={t('{m}-oy', { m: m + 1 })} inputMode="numeric" value={value} onChange={(e) => set({ months: state.months.map((v, i) => (i === m ? e.target.value.replace(/\D/g, '') : v)) }, false)} onBlur={() => setCommitted(state)} />)}
            </div>
            <button type="button" className="qs-chart__toggle" style={{ justifySelf: 'start' }} onClick={() => set({ months: new Array(12).fill(state.months.find((v) => v) ?? '') })}>{t('Bitta qiymatni hammasiga')}</button>
          </>
        )}
        {state.consumptionTab === 'appliances' && <AppliancesEditor rows={state.appliances} onChange={(appliances) => set({ appliances, ...(appliances.some((a) => a.isCritical) && state.systemType === 'ON_GRID' ? { systemType: 'HYBRID' as SystemType } : {}) })} />}
      </div>
    );
  } else if (step === 4) {
    body = (
      <div className="qs-form">
        <div className="qs-choice">
          {(Object.keys(SYSTEM_TYPE) as SystemType[]).map((type) => (
            <button key={type} type="button" className={cx(state.systemType === type && 'is-on')} onClick={() => set({ systemType: type, option: null })}>
              <strong>{SYSTEM_TYPE[type].title}</strong><small>{SYSTEM_TYPE[type].text}</small><small><i>{SYSTEM_TYPE[type].who}</i></small>
            </button>
          ))}
        </div>
        {hasCritical && state.systemType === 'ON_GRID' && <Alert tone="warning">{t('Uzilishda ishlashi kerak texnika belgilangan — tarmoqqa ulangan tizim o‘chganda ishlamaydi.')}</Alert>}
        {result && (
          <>
            <Badge tone="primary">{LIMITING[result.limitingFactor]}</Badge>
            <div className="qs-choice">
              {result.sizingOptions.map((option) => (
                <button key={option.key} type="button" className={cx((state.option ?? 'BALANCED') === option.key && 'is-on')} onClick={() => set({ option: option.key })}>
                  <strong>{OPTION_LABEL[option.key]}{option.key === 'BALANCED' ? ` · ${t('tavsiya')}` : ''}</strong>
                  <small>{kw(option.kwp)} · {t('{n} ta panel', { n: option.panelCount })}</small>
                </button>
              ))}
            </div>
            {!result.sizingOptions.some((o) => o.key === 'MAXIMUM') && <p className="qs-muted" style={{ margin: 0, fontSize: 13 }}>{t('Maksimal variant Muvozanatlidan deyarli farq qilmaydi, shuning uchun ko‘rsatilmadi.')}</p>}
          </>
        )}
      </div>
    );
  } else if (step === 5) {
    const auto = result?.money.costBreakdown;
    const fields: Array<[keyof DetailedState['costs'], string, number | undefined]> = [['equipmentCost', t('Uskuna'), auto?.equipment], ['installationCost', t('Montaj'), auto?.installation], ['deliveryCost', t('Yetkazish'), auto?.delivery], ['otherCost', t('Qo‘shimcha'), auto?.other]];
    body = (
      <div className="qs-form">
        {fields.map(([key, label, value]) => (
          <Input key={key} label={label} inputMode="numeric" value={state.costs[key]} placeholder={value !== undefined ? formatNumber(value) : ''} onChange={(e) => set({ costs: { ...state.costs, [key]: e.target.value.replace(/\D/g, '') } }, false)} onBlur={() => setCommitted(state)} hint={state.costs[key] ? t('Siz kiritgan') : t('Taxminiy · katalog medianasi (oxirgi 90 kun)')} />
        ))}
        {result && <p className="qs-stat-line"><span>{t('Jami')}: <b>{sum(result.money.initialCost)}</b></span><span>{t('Yillik servis')}: <b>{sum(result.money.annualOpex)}</b></span></p>}
      </div>
    );
  } else {
    body = (
      <div className="qs-form">
        <div className="qs-segment" role="group">
          <button type="button" className={cx(state.financing.kind === 'CASH' && 'is-on')} onClick={() => set({ financing: { ...state.financing, kind: 'CASH' } })}>{t('Naqd')}</button>
          <button type="button" className={cx(state.financing.kind === 'LOAN' && 'is-on')} onClick={() => set({ financing: { ...state.financing, kind: 'LOAN' } })}>{t('Kredit / bo‘lib to‘lash')}</button>
        </div>
        {state.financing.kind === 'LOAN' && (
          <>
            <Select label={t('Moliyalashtirish mahsuloti')} value={state.financing.productId} onChange={(e) => { const p = reference.data?.financing.find((x) => x.id === e.target.value); set({ financing: { ...state.financing, productId: e.target.value, termMonths: p?.allowedTerms[0] ?? state.financing.termMonths, paymentType: p?.paymentType ?? state.financing.paymentType } }); }} options={[{ value: '', label: t('Qo‘lda kiritish') }, ...(reference.data?.financing ?? []).map((p) => ({ value: p.id, label: `${p.providerName} · ${formatPercent(Number(p.annualRate), 1)}` }))]} />
            {!product && <Input label={t('Yillik stavka, %')} inputMode="decimal" value={state.financing.annualRate} onChange={(e) => set({ financing: { ...state.financing, annualRate: e.target.value.replace(/[^\d.,]/g, '') } }, false)} onBlur={() => setCommitted(state)} />}
            <Input label={t('Boshlang‘ich to‘lov, so‘m')} inputMode="numeric" value={state.financing.downPayment} onChange={(e) => set({ financing: { ...state.financing, downPayment: e.target.value.replace(/\D/g, '') } }, false)} onBlur={() => setCommitted(state)} hint={product ? t('Kamida {p} %', { p: Math.round(Number(product.minDownPaymentPct) * 100) }) : undefined} />
            <div className="qs-chips" role="group" aria-label={t('Muddat')}>
              {(product?.allowedTerms.length ? product.allowedTerms : [6, 12, 18, 24, 36]).map((term) => (
                <button key={term} type="button" className={cx('qs-chip', state.financing.termMonths === term && 'is-on')} onClick={() => set({ financing: { ...state.financing, termMonths: term } })}>{t('{n} oy', { n: term })}</button>
              ))}
            </div>
            {!product && <div className="qs-segment" role="group"><button type="button" className={cx(state.financing.paymentType === 'ANNUITY' && 'is-on')} onClick={() => set({ financing: { ...state.financing, paymentType: 'ANNUITY' } })}>{t('Annuitet')}</button><button type="button" className={cx(state.financing.paymentType === 'DIFFERENTIATED' && 'is-on')} onClick={() => set({ financing: { ...state.financing, paymentType: 'DIFFERENTIATED' } })}>{t('Differensial')}</button></div>}
            {result?.financing && (
              <p className="qs-stat-line">
                <span>{t('Oylik to‘lov')}: <b>{result.financing.firstPayment === result.financing.lastPayment ? sumShort(result.financing.firstPayment) : `${sumShort(result.financing.firstPayment)} → ${sumShort(result.financing.lastPayment)}`}</b></span>
                <span>{t('Ortiqcha to‘lov')}: <b>{sumShort(result.financing.overpayment)}</b></span>
                <span>{t('Cho‘ntakdan (1-oy)')}: <b>{sumShort(result.financing.schedule[0]?.net ?? 0)}</b></span>
                {result.financing.shortestSelfFundingTerm && <span>{t('Tejash qoplaydigan muddat')}: <b>{t('{n} oy', { n: result.financing.shortestSelfFundingTerm })}</b></span>}
              </p>
            )}
            <Alert tone="info">{t('Bu taxminiy hisob. Yakuniy shartlarni bank yoki sotuvchi belgilaydi; platforma kredit bermaydi va tasdiqlamaydi.')}</Alert>
          </>
        )}
      </div>
    );
  }

  const ready = !!input;
  const maxDone = committed.point || committed.siteId ? (input ? 6 : 3) : 1;
  const finish = () => {
    if (!input) return;
    void calcService.saveDraft({ kind: DETAILED_DRAFT_KIND, state: { ...state, step } }).catch(() => undefined);
    navigate('/mijoz/kalkulyator/natija', { state: { input } });
  };

  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Batafsil hisob')}</h1><p>{t('Olti qadam — tom, iste’mol, tizim va moliyalashtirish bo‘yicha aniq natija.')}</p></div></div>
      <StepNav step={step} maxDone={maxDone} onGo={go} />
      <div className="qs-wizard">
        <section className="qs-card">
          <h2 style={{ marginTop: 0 }}>{step}. {STEPS[step - 1]}</h2>
          {body}
          <div className="qs-form__actions" style={{ marginTop: 16 }}>
            {step > 1 && <Button variant="ghost" onClick={() => go(step - 1)}>{t('Orqaga')}</Button>}
            {step === 6 && <Button variant="secondary" onClick={finish} disabled={!ready}>{t('O‘tkazib yuborish')}</Button>}
            {step < 6 ? <Button disabled={step === 1 && !state.point && !state.siteId} onClick={() => go(step + 1)}>{t('Keyingi')}</Button> : <Button disabled={!ready} onClick={finish}>{t('Natijani ko‘rish')}</Button>}
          </div>
        </section>
        <aside className={cx('qs-wizard__aside', panelOpen && 'is-open')} aria-live="polite">
          <div className="qs-wizard__mini">
            <span>{result ? `${kw(result.systemPowerKw)} · ${result.money.savings !== null ? `${sumShort(result.money.savings / 12)}/${t('oy')}` : '—'}` : t('Natija hali yo‘q')}</span>
            <Button size="sm" variant="secondary" onClick={() => setPanelOpen((v) => !v)}><ChevronUp size={14} /> {t('Natija')}</Button>
          </div>
          {result ? (
            <>
              <Kpis result={result} pending={estimate.pending} compact />
              {result.warnings.filter((w) => WARNING_TEXT[w]).slice(0, 2).map((w) => <Alert key={w} tone="info">{WARNING_TEXT[w]}</Alert>)}
              <div className="qs-page__actions">
                <Button size="sm" disabled={!ready} onClick={finish}>{t('Natijani to‘liq ko‘rish')}</Button>
                {hasSession && <Button size="sm" variant="ghost" loading={save.isPending} disabled={!ready} onClick={() => save.mutate()}>{t('Saqlash')}</Button>}
              </div>
            </>
          ) : (
            <p className="qs-muted">{estimate.pending ? t('Hisoblanmoqda…') : t('Joylashuv va iste’molni kiriting — natija shu yerda yangilanadi.')}</p>
          )}
          {estimate.retryAt && <Alert tone="warning">{t('Juda tez o‘zgartiryapsiz — bir oz kutib yangilanadi')}</Alert>}
          {!!estimate.error && <Alert tone="danger">{getErrorMessage(estimate.error)}</Alert>}
        </aside>
      </div>
    </div>
  );
}
