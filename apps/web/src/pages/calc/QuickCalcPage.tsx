import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Calculator, Save } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MapView, useMapHandle } from '@/features/map/MapView';
import { usePointPicker } from '@/features/map/editors';
import { inUzbekistan, type LngLat } from '@/features/map/geometry';
import { calcService } from '@/features/calc/calc.service';
import { useEstimate } from '@/features/calc/useEstimate';
import { headline, Kpis, ResultChips } from '@/features/calc/ResultView';
import { LIMITING, WARNING_TEXT } from '@/features/calc/labels';
import type { AreaPreset, EstimateInput } from '@/features/calc/types';
import { i18nText } from '@/features/catalog/format';
import { AddressSearch } from '@/pages/map/SitesPage';
import { getErrorMessage } from '@/lib/error-messages';
import { rememberReturnTo } from '@/lib/return-to';
import { cx } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import { track } from '@/features/m7/track';
import '@/features/shop/shop.css';
import '@/features/map/map.css';
import '@/features/calc/calc.css';

type ConsumptionMode = 'kwh' | 'bill';

export interface QuickState {
  point: LngLat | null;
  mode: ConsumptionMode;
  value: string;
  templateCode: string | null;
  place: 'ROOF' | 'GROUND';
  size: AreaPreset | null;
}

export const QUICK_DRAFT_KIND = 'quick';

/** Tez hisob holatidan kirish (faqat to‘liq bo‘lsa). */
export function quickInput(state: QuickState): EstimateInput | null {
  if (!state.point || !state.size) return null;
  const amount = Number(state.value.replace(/\s/g, ''));
  const consumption = state.templateCode ? { templateCode: state.templateCode } : state.mode === 'kwh' ? (amount > 0 ? { monthlyKwh: amount } : null) : amount > 0 ? { billAmount: amount } : null;
  if (!consumption) return null;
  return { mode: 'QUICK', lat: state.point[1], lon: state.point[0], areaPreset: state.size, roofShape: 'FLAT', consumption };
}

/** U8.1: bir ekran, uch blok — joylashuv, elektr sarfi, o‘rnatish joyi; natija avtomatik. */
export function QuickCalcPage() {
  const navigate = useNavigate();
  const hasSession = useAuthStore((s) => s.hasSession);
  const pushToast = useAppStore((s) => s.pushToast);
  const { map, onStyleReady } = useMapHandle();
  const reference = useQuery({ queryKey: ['calc', 'reference'], queryFn: calcService.reference, staleTime: 10 * 60_000 });
  const [state, setState] = useState<QuickState>({ point: null, mode: 'kwh', value: '', templateCode: null, place: 'ROOF', size: null });
  // Yozish paytida emas — qiymat yakunlanganda (blur/Enter/tanlov) hisob (U8.9).
  const [committed, setCommitted] = useState<QuickState>(state);
  const [center, setCenter] = useState<LngLat | undefined>(undefined);
  const [templates, setTemplates] = useState(false);
  const commit = (next: Partial<QuickState>) => {
    const merged = { ...state, ...next };
    setState(merged);
    setCommitted(merged);
  };
  usePointPicker(map, state.point, (point) => commit({ point }));
  const input = useMemo(() => quickInput(committed), [committed]);
  const estimate = useEstimate(input);
  const result = estimate.result;
  useEffect(() => track({ eventType: 'calc_started', properties: { mode: 'QUICK' } }, 'calc-start-quick'), []);
  useEffect(() => { if (result) track({ eventType: 'calc_result', properties: { mode: 'QUICK' } }, 'calc-result-quick'); }, [result]);
  const tariffMissing = result?.status === 'TARIFF_NOT_FOUND';

  // Draft tiklash (U8.15): login’dan keyin yoki qaytib kelganda.
  useEffect(() => {
    void calcService.getDraft().then((draft) => {
      const saved = draft?.input as { kind?: string; state?: QuickState } | undefined;
      if (saved?.kind === QUICK_DRAFT_KIND && saved.state) {
        setState(saved.state);
        setCommitted(saved.state);
        if (saved.state.point) setCenter(saved.state.point);
        pushToast(t('Oldingi hisobingiz tiklandi'), 'info');
      }
    }).catch(() => undefined);
    // Faqat bir marta, sahifa ochilganda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (committed.point || committed.value) void calcService.saveDraft({ kind: QUICK_DRAFT_KIND, state: committed }).catch(() => undefined);
  }, [committed]);
  useEffect(() => {
    if (tariffMissing && committed.mode === 'bill' && !committed.templateCode) setState((s) => ({ ...s, mode: 'kwh', value: '' }));
  }, [tariffMissing, committed.mode, committed.templateCode]);

  const save = useMutation({
    mutationFn: () => calcService.save(input!),
    onSuccess: (saved) => navigate(`/mijoz/natija/${saved.id}`),
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
  const requireLogin = () => {
    rememberReturnTo('/mijoz/kalkulyator');
    navigate('/login');
  };
  const presets = reference.data?.quickAreaPresets ?? { SMALL: 20, MEDIUM: 40, LARGE: 80 };
  const template = reference.data?.templates.find((item) => item.code === state.templateCode);

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Tez hisob')}</h1><p>{t('Uchta savol — va quyosh tizimi sizga qancha tejashini ko‘rasiz.')}</p></div>
        <Link className="gm-button gm-button--ghost gm-button--md" to="/mijoz/kalkulyator/batafsil">{t('Batafsil hisob')}</Link>
      </div>

      <div className="qs-quick">
        <div className="qs-form">
          <section className="qs-card qs-quick__block">
            <h2><span>1</span>{t('Joylashuv')}</h2>
            <AddressSearch onPick={(point) => { commit({ point }); setCenter(point); }} />
            <MapView center={center} zoom={state.point ? 15 : 10} onStyleReady={onStyleReady} onLocate={(point) => { commit({ point }); setCenter(point); }} ariaLabel={t('Joylashuv xaritasi')}>
              {!state.point && <div className="qs-map__overlay">{t('Uyingiz joylashgan nuqtani bosing')}</div>}
            </MapView>
            {state.point && !inUzbekistan(state.point) && <Alert tone="warning">{t('Nuqta O‘zbekiston hududidan tashqarida.')}</Alert>}
          </section>

          <section className="qs-card qs-quick__block">
            <h2><span>2</span>{t('Elektr sarfi')}</h2>
            {template ? (
              <Alert tone="info">
                {t('Texnika shabloni: {name}', { name: i18nText(template.nameI18n as { uz: string }) })} · <button type="button" className="qs-chart__toggle" onClick={() => commit({ templateCode: null })}>{t('Raqam kiritish')}</button>
              </Alert>
            ) : (
              <>
                <div className="qs-segment" role="group" aria-label={t('Kiritish turi')}>
                  <button type="button" className={cx(state.mode === 'bill' && 'is-on')} disabled={tariffMissing} onClick={() => commit({ mode: 'bill', value: '' })}>{t('Oylik to‘lov, so‘m')}</button>
                  <button type="button" className={cx(state.mode === 'kwh' && 'is-on')} onClick={() => commit({ mode: 'kwh', value: '' })}>{t('Oylik sarf, kWh')}</button>
                </div>
                <Input
                  label={state.mode === 'kwh' ? t('O‘rtacha oylik sarf, kWh') : t('O‘rtacha oylik to‘lov, so‘m')}
                  inputMode="numeric"
                  value={state.value}
                  onChange={(e) => setState({ ...state, value: e.target.value.replace(/[^\d\s]/g, '') })}
                  onBlur={() => setCommitted(state)}
                  onKeyDown={(e) => e.key === 'Enter' && setCommitted(state)}
                  placeholder={state.mode === 'kwh' ? '350' : '250 000'}
                />
                {tariffMissing && <Alert tone="info">{t('Bu hudud uchun tarif ma’lumoti yo‘q — kWh kiriting')}</Alert>}
                <button type="button" className="qs-chart__toggle" style={{ justifySelf: 'start' }} onClick={() => setTemplates(true)}>{t('Bilmayman — texnika bo‘yicha')}</button>
              </>
            )}
          </section>

          <section className="qs-card qs-quick__block">
            <h2><span>3</span>{t('O‘rnatish joyi')}</h2>
            <div className="qs-choice">
              <button type="button" className={cx(state.place === 'ROOF' && 'is-on')} onClick={() => commit({ place: 'ROOF' })}><strong>{t('Tom')}</strong><small>{t('Uy yoki bino tomi')}</small></button>
              <button type="button" className={cx(state.place === 'GROUND' && 'is-on')} onClick={() => commit({ place: 'GROUND' })}><strong>{t('Hovli yoki yer')}</strong><small>{t('Yerga o‘rnatish')}</small></button>
            </div>
            <div className="qs-choice">
              {(['SMALL', 'MEDIUM', 'LARGE'] as const).map((size) => (
                <button key={size} type="button" className={cx(state.size === size && 'is-on')} onClick={() => commit({ size })}>
                  <strong>{size === 'SMALL' ? t('Kichik') : size === 'MEDIUM' ? t('O‘rtacha') : t('Katta')}</strong>
                  <small>≈ {presets[size]} m²</small>
                </button>
              ))}
              <button type="button" onClick={() => navigate('/mijoz/kalkulyator/batafsil?qadam=2', { state: { fromQuick: committed } })}><strong>{t('Xaritada chizaman')}</strong><small>{t('Aniqroq natija')}</small></button>
            </div>
          </section>
        </div>

        <section className={cx('qs-card', 'qs-form')} aria-live="polite">
          {!input ? (
            <div className="qs-sun-wait" style={{ minHeight: 160, justifyContent: 'center' }}>
              <Calculator size={22} aria-hidden="true" /> {t('Uchala blokni to‘ldiring — natija shu yerda chiqadi.')}
            </div>
          ) : !result ? (
            <div className="qs-sun-wait" style={{ minHeight: 160, justifyContent: 'center' }}>
              <svg viewBox="0 0 42 22" aria-hidden="true"><path d="M2,20 A19,17 0 0 1 40,20" fill="none" stroke="var(--qs-color-border)" strokeWidth="1.5" /><circle r="3" /></svg>
              {estimate.error ? <Alert tone="danger">{getErrorMessage(estimate.error)}</Alert> : t('Quyosh ma’lumoti yuklanmoqda…')}
            </div>
          ) : (
            <>
              <h2 style={{ margin: 0, fontFamily: 'var(--qs-font-display)', fontSize: 22, lineHeight: 1.25 }}>{headline(result)}</h2>
              <ResultChips result={result} />
              <Kpis result={result} pending={estimate.pending} compact />
              {estimate.retryAt && <Alert tone="warning">{t('Juda tez o‘zgartiryapsiz — bir oz kutib yangilanadi')}</Alert>}
              {result.warnings.filter((w) => WARNING_TEXT[w] && w !== 'TARIFF_NOT_FOUND').map((w) => <Alert key={w} tone="info">{WARNING_TEXT[w]}</Alert>)}
              <p className="qs-muted" style={{ margin: 0, fontSize: 13 }}>{LIMITING[result.limitingFactor]}</p>
              <div className="qs-page__actions">
                <Link className="gm-button gm-button--md" style={{ background: 'var(--qs-color-accent)', color: '#1a1205' }} to="/mijoz/xarita">{t('Do‘konlardan taklif olish')} <ArrowRight size={16} /></Link>
                <Button variant="secondary" onClick={() => navigate('/mijoz/kalkulyator/batafsil?qadam=1', { state: { fromQuick: committed } })}>{t('Batafsil hisob')}</Button>
                <Button variant="ghost" loading={save.isPending} onClick={() => (hasSession ? save.mutate() : requireLogin())}><Save size={16} /> {t('Saqlash')}</Button>
              </div>
            </>
          )}
        </section>
      </div>

      <Modal open={templates} onClose={() => setTemplates(false)} title={t('Uyingizga o‘xshash variantni tanlang')}>
        <div className="qs-choice">
          {reference.data?.templates.map((item) => (
            <button key={item.code} type="button" onClick={() => { commit({ templateCode: item.code }); setTemplates(false); }}>
              <strong>{i18nText(item.nameI18n as { uz: string })}</strong>
              <small>{t('{n} xil texnika', { n: item.itemsJson.length })}</small>
            </button>
          ))}
        </div>
        <p className="qs-muted" style={{ fontSize: 13 }}>{t('Ro‘yxatni Batafsil hisobda tahrirlash mumkin.')}</p>
      </Modal>
    </div>
  );
}
