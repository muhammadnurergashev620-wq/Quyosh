import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorState } from '@/components/ui/ErrorState';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { adminCalcService, PUBLISH_STATUS, type CustomerType, type PublishStatus, type Tariff, type TariffInput, type TouPeriodType } from '@/features/admin/calc/service';
import { getErrorMessage } from '@/lib/error-messages';
import { REGIONS, regionName } from '@/lib/regions';
import { formatDate, formatNumber } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import { safeExternalUrl } from '@/lib/return-to';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Chip } from '@/components/ui/Chip';
import { Tab, TabBar } from '@/components/ui/Tabs';

const CUSTOMER_TYPE: Record<CustomerType, string> = { HOUSEHOLD: t('Maishiy'), LEGAL: t('Yuridik') };
const COMPENSATION: Record<string, string> = { NONE: t('Kompensatsiya yo‘q'), NET_METERING: t('Net metering'), NET_BILLING: t('Net billing'), FEED_IN: t('Feed-in tarif') };
const TOU: Record<TouPeriodType, string> = { ALL: t('Butun kun'), DAY: t('Kunduz'), NIGHT: t('Tun') };

interface TierRow { seasonMonths: string; touPeriod: TouPeriodType; minKwh: string; maxKwh: string; ratePerKwh: string }

const tierRows = (tariff?: Tariff): TierRow[] =>
  tariff?.tiers.map((tier) => ({ seasonMonths: tier.seasonMonths.join(','), touPeriod: tier.touPeriod, minKwh: String(Number(tier.minKwh)), maxKwh: tier.maxKwh === null ? '' : String(Number(tier.maxKwh)), ratePerKwh: String(Number(tier.ratePerKwh)) })) ?? [
    { seasonMonths: '', touPeriod: 'ALL', minKwh: '0', maxKwh: '200', ratePerKwh: '' },
    { seasonMonths: '', touPeriod: 'ALL', minKwh: '200', maxKwh: '', ratePerKwh: '' },
  ];

/** Tarif formasi: pog‘onalar [min, max), mavsum (oylar), kun/tun davrlari (TZ 11.8.1). */
function TariffForm({ initial, onDone }: { initial?: Tariff; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [regionCode, setRegionCode] = useState(initial?.regionCode ?? 'toshkent-shahri');
  const [customerType, setCustomerType] = useState<CustomerType>(initial?.customerType ?? 'HOUSEHOLD');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [fixed, setFixed] = useState(initial?.fixedChargeMonthly ? String(Number(initial.fixedChargeMonthly)) : '');
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '');
  const [from, setFrom] = useState(initial?.effectiveFrom.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [until, setUntil] = useState(initial?.effectiveUntil?.slice(0, 10) ?? '');
  const [tou, setTou] = useState(initial?.touEnabled ?? false);
  const [night, setNight] = useState({ start: String(initial?.touPeriods.find((p) => p.touPeriod === 'NIGHT')?.startHour ?? 23), end: String(initial?.touPeriods.find((p) => p.touPeriod === 'NIGHT')?.endHour ?? 6) });
  const [tiers, setTiers] = useState<TierRow[]>(tierRows(initial));
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: (input: TariffInput) => (initial ? adminCalcService.updateTariff(initial.id, input) : adminCalcService.createTariff(input)),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'tariffs'] }); onDone(); },
  });
  const setTier = (index: number, patch: Partial<TierRow>) => setTiers(tiers.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = tiers.map((row) => ({
      seasonMonths: row.seasonMonths.split(/[,\s]+/).filter(Boolean).map(Number),
      touPeriod: tou ? (row.touPeriod === 'ALL' ? 'DAY' : row.touPeriod) : 'ALL',
      minKwh: Number(row.minKwh),
      maxKwh: row.maxKwh === '' ? null : Number(row.maxKwh),
      ratePerKwh: Number(row.ratePerKwh.replace(',', '.')),
    }));
    if (parsed.some((row) => !Number.isFinite(row.minKwh) || !Number.isFinite(row.ratePerKwh) || row.seasonMonths.some((m) => m < 1 || m > 12))) return setError(t('Pog‘onalarni to‘liq va to‘g‘ri kiriting'));
    setError('');
    save.mutate({
      regionCode, customerType, title: title.trim(), fixedChargeMonthly: fixed ? Number(fixed) : null, touEnabled: tou, sourceUrl: sourceUrl.trim() || undefined,
      effectiveFrom: from, effectiveUntil: until || null, tiers: parsed as TariffInput['tiers'],
      touPeriods: tou ? [{ touPeriod: 'NIGHT', startHour: Number(night.start), endHour: Number(night.end) }] : [],
    });
  }

  return (
    <form className="qs-form" onSubmit={submit}>
      <div className="qs-form__row">
        <Select label={t('Hudud')} value={regionCode} onChange={(e) => setRegionCode(e.target.value)} options={REGIONS.map((region) => ({ value: region.code, label: region.name }))} />
        <Select label={t('Iste’molchi turi')} value={customerType} onChange={(e) => setCustomerType(e.target.value as CustomerType)} options={(Object.keys(CUSTOMER_TYPE) as CustomerType[]).map((value) => ({ value, label: CUSTOMER_TYPE[value] }))} />
      </div>
      <Input label={t('Nomi')} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      <div className="qs-form__row">
        <Input label={t('Amal qilish boshlanishi')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
        <Input label={t('Amal qilish tugashi')} type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        <Input label={t('Oylik qat’iy to‘lov, so‘m')} inputMode="numeric" value={fixed} onChange={(e) => setFixed(e.target.value.replace(/\D/g, ''))} />
      </div>
      <Input label={t('Rasmiy manba (havola)')} type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" hint={t('Tasdiqlash uchun majburiy (TZ: tarifni o‘zboshimchalik bilan kiritib bo‘lmaydi)')} />
      <Checkbox inline label={t('Kun/tun tarifi')} checked={tou} onChange={(e) => setTou(e.target.checked)} />
      {tou && (
        <div className="qs-form__row">
          <Input label={t('Tun boshlanishi (soat)')} inputMode="numeric" value={night.start} onChange={(e) => setNight({ ...night, start: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
          <Input label={t('Tun tugashi (soat)')} inputMode="numeric" value={night.end} onChange={(e) => setNight({ ...night, end: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
        </div>
      )}
      <div tabIndex={0} role="region" aria-label={t('Jadval')} className="qs-table-wrap">
        <table className="qs-table">
          <thead><tr><th>{t('Oylar (bo‘sh — butun yil)')}</th>{tou && <th>{t('Davr')}</th>}<th>{t('dan, kWh')}</th><th>{t('gacha, kWh')}</th><th>{t('Stavka, so‘m/kWh')}</th><th /></tr></thead>
          <tbody>
            {tiers.map((row, index) => (
              <tr key={index}>
                <td><input className="qs-input-sm" style={{ width: 120 }} aria-label={t('Oylar')} value={row.seasonMonths} placeholder="6,7,8" onChange={(e) => setTier(index, { seasonMonths: e.target.value })} /></td>
                {tou && <td><SelectMenu className="qs-select" aria-label={t('Davr')} value={row.touPeriod === 'ALL' ? 'DAY' : row.touPeriod} onChange={(e) => setTier(index, { touPeriod: e.target.value as TouPeriodType })}><option value="DAY">{TOU.DAY}</option><option value="NIGHT">{TOU.NIGHT}</option></SelectMenu></td>}
                <td><input className="qs-input-sm" style={{ width: 100 }} aria-label={t('dan')} inputMode="decimal" value={row.minKwh} onChange={(e) => setTier(index, { minKwh: e.target.value })} /></td>
                <td><input className="qs-input-sm" style={{ width: 100 }} aria-label={t('gacha')} inputMode="decimal" value={row.maxKwh} placeholder="∞" onChange={(e) => setTier(index, { maxKwh: e.target.value })} /></td>
                <td><input className="qs-input-sm" style={{ width: 120 }} aria-label={t('Stavka')} inputMode="decimal" value={row.ratePerKwh} onChange={(e) => setTier(index, { ratePerKwh: e.target.value })} /></td>
                <td><Button type="button" size="sm" variant="ghost" aria-label={t('O‘chirish')} disabled={tiers.length < 2} onClick={() => setTiers(tiers.filter((_, i) => i !== index))}><Trash2 size={14} /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div><Button type="button" size="sm" variant="secondary" onClick={() => setTiers([...tiers, { seasonMonths: '', touPeriod: 'ALL', minKwh: tiers[tiers.length - 1]?.maxKwh || '0', maxKwh: '', ratePerKwh: '' }])}><Plus size={14} /> {t('Pog‘ona')}</Button></div>
      {(error || save.isError) && <Alert tone="danger">{error || getErrorMessage(save.error)}</Alert>}
      <div className="qs-form__actions">
        <Button type="button" variant="ghost" onClick={onDone}>{t('Bekor qilish')}</Button>
        <Button type="submit" loading={save.isPending}>{t('Qoralamani saqlash')}</Button>
      </div>
    </form>
  );
}

function TariffsTab() {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState<PublishStatus | ''>('');
  const [editing, setEditing] = useState<Tariff | 'new' | null>(null);
  /** «Tugash sanasi» oynasi (avval brauzerning prompt() edi). */
  const [untilFor, setUntilFor] = useState<{ id: string; value: string } | null>(null);
  const list = useQuery({ queryKey: ['admin', 'tariffs', region, status], queryFn: () => adminCalcService.tariffs({ regionCode: region || undefined, status: status || undefined }) });
  const action = useMutation({
    mutationFn: ({ id, kind, until }: { id: string; kind: 'publish' | 'archive' | 'copy' | 'until'; until?: string | null }) =>
      kind === 'publish' ? adminCalcService.publishTariff(id) : kind === 'archive' ? adminCalcService.archiveTariff(id) : kind === 'copy' ? adminCalcService.copyTariff(id) : adminCalcService.tariffUntil(id, until ?? null),
    onSuccess: (_, vars) => { pushToast(vars.kind === 'copy' ? t('Nusxa (qoralama) yaratildi') : t('Saqlandi'), 'success'); void queryClient.invalidateQueries({ queryKey: ['admin', 'tariffs'] }); },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });

  if (list.isLoading) return <PageLoader />;
  if (list.isError || !list.data) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  return (
    <>
      <Modal
        open={!!untilFor}
        onClose={() => setUntilFor(null)}
        title={t('Tugash sanasi')}
        icon={<CalendarClock size={22} />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUntilFor(null)}>{t('Bekor qilish')}</Button>
            <Button loading={action.isPending} onClick={() => { if (untilFor) action.mutate({ id: untilFor.id, kind: 'until', until: untilFor.value || null }, { onSuccess: () => setUntilFor(null) }); }}>{t('Saqlash')}</Button>
          </>
        }
      >
        <Input type="date" label={t('Tarif amal qilishining oxirgi kuni')} hint={t('Bo‘sh qoldirilsa — muddatsiz')} value={untilFor?.value ?? ''} onChange={(e) => setUntilFor((u) => (u ? { ...u, value: e.target.value } : u))} />
      </Modal>
      <div className="qs-toolbar">
        <SelectMenu className="qs-select" aria-label={t('Hudud')} value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">{t('Barcha hududlar')}</option>
          {REGIONS.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </SelectMenu>
        <div className="qs-chips">
          {(['', 'PUBLISHED', 'DRAFT', 'ARCHIVED'] as const).map((value) => (
            <Chip key={value || 'all'} onClick={() => setStatus(value)} selected={status === value}>{value ? PUBLISH_STATUS[value].label : t('Hammasi')}</Chip>
          ))}
        </div>
        <Button className="qs-ml-auto" onClick={() => setEditing('new')}><Plus size={16} /> {t('Tarif qo‘shish')}</Button>
      </div>
      <Alert tone="info">{t('Tasdiqlangan tarif o‘zgartirilmaydi — eski hisoblar shu versiya bilan o‘qiladi. O‘zgarish uchun nusxa oling, yangi sana qo‘ying va eski tarifga tugash sanasini belgilang.')}</Alert>
      {!list.data.length ? <EmptyState title={t('Tarif yo‘q')} description={t('Tarif bo‘lmasa kalkulyator moliyaviy natijani hisoblamaydi («Tarif ma’lumoti yo‘q»).')} /> : (
        <div tabIndex={0} role="region" aria-label={t('Jadval')} className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Tarif')}</th><th>{t('Pog‘onalar')}</th><th>{t('Amal qiladi')}</th><th>{t('Holat')}</th><th /></tr></thead>
            <tbody>
              {list.data.map((tariff) => (
                <tr key={tariff.id}>
                  <td>
                    <div className="qs-cell-title">
                      <strong>{tariff.title}</strong>
                      <small>{regionName(tariff.regionCode)} · {CUSTOMER_TYPE[tariff.customerType]} · v{tariff.version}{tariff.touEnabled ? ` · ${t('kun/tun')}` : ''}</small>
                      {safeExternalUrl(tariff.sourceUrl) && <small><a href={safeExternalUrl(tariff.sourceUrl)} target="_blank" rel="noreferrer"><ExternalLink size={11} /> {t('manba')}</a></small>}
                    </div>
                  </td>
                  <td className="qs-num">
                    {tariff.tiers.map((tier, i) => (
                      <div key={i}><small>{tier.seasonMonths.length ? `[${tier.seasonMonths.join(',')}] ` : ''}{tariff.touEnabled ? `${TOU[tier.touPeriod]} ` : ''}{formatNumber(Number(tier.minKwh))}–{tier.maxKwh === null ? '∞' : formatNumber(Number(tier.maxKwh))} kWh: <b>{formatNumber(Number(tier.ratePerKwh))}</b></small></div>
                    ))}
                  </td>
                  <td>{formatDate(tariff.effectiveFrom)} — {tariff.effectiveUntil ? formatDate(tariff.effectiveUntil) : '∞'}</td>
                  <td><StatusBadge map={PUBLISH_STATUS} status={tariff.status} /></td>
                  <td className="qs-right">
                    <span className="qs-page__actions qs-justify-end">
                      {tariff.status === 'DRAFT' && <Button size="sm" variant="secondary" onClick={() => setEditing(tariff)}>{t('Tahrirlash')}</Button>}
                      {tariff.status === 'DRAFT' && <Button size="sm" onClick={() => action.mutate({ id: tariff.id, kind: 'publish' })}>{t('Tasdiqlash')}</Button>}
                      {tariff.status === 'PUBLISHED' && (
                        <Button size="sm" variant="ghost" onClick={() => setUntilFor({ id: tariff.id, value: tariff.effectiveUntil?.slice(0, 10) ?? '' })}>{t('Tugash sanasi')}</Button>
                      )}
                      <Button size="sm" variant="ghost" aria-label={t('Nusxa olish')} onClick={() => action.mutate({ id: tariff.id, kind: 'copy' })}><Copy size={14} /></Button>
                      {tariff.status !== 'ARCHIVED' && <Button size="sm" variant="ghost" onClick={() => action.mutate({ id: tariff.id, kind: 'archive' })}>{t('Arxivlash')}</Button>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('Yangi tarif') : t('Tarifni tahrirlash')} large>
        {editing && <TariffForm initial={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function ExportRulesTab() {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const rules = useQuery({ queryKey: ['admin', 'export-rules'], queryFn: adminCalcService.exportRules });
  const limits = useQuery({ queryKey: ['admin', 'grid-limits'], queryFn: adminCalcService.gridLimits });
  const [form, setForm] = useState({ regionCode: 'toshkent-shahri', customerType: 'HOUSEHOLD', compensationType: 'NET_METERING', ratePerKwh: '', settlementPeriod: 'YEAR', maxSystemKw: '', sourceUrl: '', effectiveFrom: new Date().toISOString().slice(0, 10) });
  const [limit, setLimit] = useState({ regionCode: 'toshkent-shahri', customerType: 'HOUSEHOLD', maxKw: '', sourceUrl: '', effectiveFrom: new Date().toISOString().slice(0, 10) });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'export-rules'] }); void queryClient.invalidateQueries({ queryKey: ['admin', 'grid-limits'] }); };
  const run = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: () => { pushToast(t('Saqlandi'), 'success'); refresh(); }, onError: (error) => pushToast(getErrorMessage(error), 'error') });

  return (
    <div className="qs-grid-2">
      <section className="qs-card">
        <h2>{t('Eksport kompensatsiyasi')}</h2>
        <form className="qs-form" onSubmit={(e) => { e.preventDefault(); run.mutate(() => adminCalcService.createExportRule({ ...form, ratePerKwh: form.ratePerKwh ? Number(form.ratePerKwh) : null, maxSystemKw: form.maxSystemKw ? Number(form.maxSystemKw) : null, sourceUrl: form.sourceUrl || undefined })); }}>
          <div className="qs-form__row">
            <Select label={t('Hudud')} value={form.regionCode} onChange={(e) => setForm({ ...form, regionCode: e.target.value })} options={REGIONS.map((r) => ({ value: r.code, label: r.name }))} />
            <Select label={t('Turi')} value={form.compensationType} onChange={(e) => setForm({ ...form, compensationType: e.target.value })} options={Object.entries(COMPENSATION).map(([value, label]) => ({ value, label }))} />
          </div>
          <div className="qs-form__row">
            <Input label={t('Stavka, so‘m/kWh')} inputMode="decimal" value={form.ratePerKwh} onChange={(e) => setForm({ ...form, ratePerKwh: e.target.value })} />
            <Select label={t('Hisob davri')} value={form.settlementPeriod} onChange={(e) => setForm({ ...form, settlementPeriod: e.target.value })} options={[{ value: 'MONTH', label: t('Oy') }, { value: 'YEAR', label: t('Yil') }]} />
            <Input label={t('Maks. tizim, kW')} inputMode="decimal" value={form.maxSystemKw} onChange={(e) => setForm({ ...form, maxSystemKw: e.target.value })} />
          </div>
          <div className="qs-form__row">
            <Input label={t('Boshlanishi')} type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
            <Input label={t('Rasmiy manba')} type="url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
          </div>
          <div className="qs-form__actions"><Button type="submit" loading={run.isPending}>{t('Qoralama qo‘shish')}</Button></div>
        </form>
        <ul className="qs-list qs-mt-3">
          {rules.data?.map((rule) => (
            <li key={rule.id}>
              <div><strong>{COMPENSATION[rule.compensationType]}</strong><small>{regionName(rule.regionCode)} · {CUSTOMER_TYPE[rule.customerType]} · {formatDate(rule.effectiveFrom)}{rule.ratePerKwh ? ` · ${formatNumber(Number(rule.ratePerKwh))} so‘m/kWh` : ''}</small></div>
              <StatusBadge map={PUBLISH_STATUS} status={rule.status} />
              {rule.status === 'DRAFT' && <Button size="sm" onClick={() => run.mutate(() => adminCalcService.publishExportRule(rule.id))}>{t('Tasdiqlash')}</Button>}
              {rule.status === 'PUBLISHED' && <Button size="sm" variant="ghost" onClick={() => run.mutate(() => adminCalcService.archiveExportRule(rule.id))}>{t('Arxivlash')}</Button>}
            </li>
          ))}
        </ul>
        {!rules.data?.length && <p className="qs-muted">{t('Qoida yo‘q — eksport kWh ko‘rsatiladi, puli hisoblanmaydi.')}</p>}
      </section>
      <section className="qs-card">
        <h2>{t('Tarmoqqa ulanish limitlari')}</h2>
        <form className="qs-form" onSubmit={(e) => { e.preventDefault(); run.mutate(() => adminCalcService.createGridLimit({ ...limit, maxKw: Number(limit.maxKw), sourceUrl: limit.sourceUrl || undefined })); }}>
          <div className="qs-form__row">
            <Select label={t('Hudud')} value={limit.regionCode} onChange={(e) => setLimit({ ...limit, regionCode: e.target.value })} options={REGIONS.map((r) => ({ value: r.code, label: r.name }))} />
            <Select label={t('Iste’molchi')} value={limit.customerType} onChange={(e) => setLimit({ ...limit, customerType: e.target.value })} options={(Object.keys(CUSTOMER_TYPE) as CustomerType[]).map((value) => ({ value, label: CUSTOMER_TYPE[value] }))} />
            <Input label={t('Maks., kW')} inputMode="decimal" value={limit.maxKw} onChange={(e) => setLimit({ ...limit, maxKw: e.target.value })} required />
          </div>
          <div className="qs-form__row">
            <Input label={t('Boshlanishi')} type="date" value={limit.effectiveFrom} onChange={(e) => setLimit({ ...limit, effectiveFrom: e.target.value })} />
            <Input label={t('Rasmiy manba')} type="url" value={limit.sourceUrl} onChange={(e) => setLimit({ ...limit, sourceUrl: e.target.value })} hint={t('Manba bilan — darhol tasdiqlanadi')} />
          </div>
          <div className="qs-form__actions"><Button type="submit" loading={run.isPending}>{t('Qo‘shish')}</Button></div>
        </form>
        <ul className="qs-list qs-mt-3">
          {limits.data?.map((row) => (
            <li key={row.id}>
              <div><strong>{formatNumber(Number(row.maxKw))} kW</strong><small>{regionName(row.regionCode)} · {CUSTOMER_TYPE[row.customerType]} · {formatDate(row.effectiveFrom)}</small></div>
              <StatusBadge map={PUBLISH_STATUS} status={row.status} />
              {row.status !== 'ARCHIVED' && <Button size="sm" variant="ghost" onClick={() => run.mutate(() => adminCalcService.archiveGridLimit(row.id))}>{t('Arxivlash')}</Button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** U12: tariflar, eksport qoidalari va ulanish limitlari (TZ 11.8–11.9). */
export function AdminTariffsPage() {
  const [tab, setTab] = useState<'tariffs' | 'export'>('tariffs');
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Tariflar')}</h1><p>{t('Elektr tariflari, eksport kompensatsiyasi va ulanish limitlari — versiyalangan, rasmiy manba bilan.')}</p></div></div>
      <TabBar variant="tabs" role="tablist">
        <Tab role="tab" aria-selected={tab === 'tariffs'} onClick={() => setTab('tariffs')} selected={tab === 'tariffs'}>{t('Tariflar')}</Tab>
        <Tab role="tab" aria-selected={tab === 'export'} onClick={() => setTab('export')} selected={tab === 'export'}>{t('Eksport va limitlar')}</Tab>
      </TabBar>
      {tab === 'tariffs' ? <TariffsTab /> : <ExportRulesTab />}
    </div>
  );
}
