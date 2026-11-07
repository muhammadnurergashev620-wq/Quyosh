import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { PageLoader } from '@/components/common/PageLoader';
import { adminCalcService, PUBLISH_STATUS, type CustomerType, type FinancingProduct } from '@/features/admin/calc/service';
import { getErrorMessage } from '@/lib/error-messages';
import { REGIONS } from '@/lib/regions';
import { formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tab, TabBar } from '@/components/ui/Tabs';

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

function useRun(keys: string[][]) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  return useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { pushToast(t('Saqlandi'), 'success'); keys.forEach((key) => void queryClient.invalidateQueries({ queryKey: key })); },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
}

/** Hisob sozlamalari versiyalari: JSON parametrlar, tasdiqlanganda oldingisi yopiladi (TZ 7.5 CalculationSettings). */
function SettingsTab() {
  const list = useQuery({ queryKey: ['admin', 'calc', 'settings'], queryFn: adminCalcService.settings });
  const run = useRun([['admin', 'calc', 'settings']]);
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState('');
  const [json, setJson] = useState('');
  const [notes, setNotes] = useState('');
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const published = list.data?.find((row) => row.status === 'PUBLISHED' && !row.effectiveUntil);
  useEffect(() => {
    if (creating && published) setJson(JSON.stringify(published.parametersJson, null, 2));
  }, [creating, published]);

  if (list.isLoading) return <PageLoader />;
  return (
    <>
      <div className="qs-page__actions"><Button onClick={() => { setCreating(true); setVersion(''); setError(''); }}><Plus size={16} /> {t('Yangi versiya')}</Button></div>
      <ul className="qs-list">
        {list.data?.map((row) => (
          <li key={row.id}>
            <div>
              <strong className="qs-mono">{row.modelVersion}</strong>
              <small>{formatDate(row.effectiveFrom)} — {row.effectiveUntil ? formatDate(row.effectiveUntil) : '∞'}{row.sourceNotes ? ` · ${row.sourceNotes}` : ''}</small>
            </div>
            <StatusBadge map={PUBLISH_STATUS} status={row.status} />
            {row.status === 'DRAFT' && <Button size="sm" loading={run.isPending} onClick={() => run.mutate(() => adminCalcService.publishSettings(row.id))}>{t('Tasdiqlash')}</Button>}
          </li>
        ))}
      </ul>
      <Modal open={creating} onClose={() => setCreating(false)} title={t('Yangi sozlamalar versiyasi')} large>
        <div className="qs-form">
          <Alert tone="info">{t('Parametrlar: yo‘qotishlar, degradatsiya, DC/AC, diskont stavkasi, tarif o‘sishi, CO₂, invertor almashtirish va h.k. Saqlangan hisoblar o‘z versiyasi bilan qoladi.')}</Alert>
          <div className="qs-form__row">
            <Input label={t('Versiya nomi')} value={version} onChange={(e) => setVersion(e.target.value.toLowerCase())} placeholder="calc-1.1.0" />
            <Input label={t('Amal qilish boshlanishi')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <Textarea label={t('Parametrlar (JSON)')} value={json} onChange={(e) => setJson(e.target.value)} rows={16} className="qs-mono" />
          <Input label={t('Manba va izoh')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="qs-form__actions">
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('Bekor qilish')}</Button>
            <Button
              loading={run.isPending}
              onClick={() => {
                let params: Record<string, unknown>;
                try { params = JSON.parse(json) as Record<string, unknown>; } catch { return setError(t('JSON noto‘g‘ri')); }
                setError('');
                run.mutate(() => adminCalcService.createSettings({ modelVersion: version, parametersJson: params, sourceNotes: notes || undefined, effectiveFrom: from }).then(() => setCreating(false)));
              }}
            >{t('Qoralamani saqlash')}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

const emptyProduct = { providerName: '', financingType: 'BANK_LOAN', annualRate: '', minTermMonths: '6', maxTermMonths: '36', allowedTerms: '6,12,18,24,36', minDownPaymentPct: '20', oneTimeFeePct: '0', monthlyFee: '0', paymentType: 'ANNUITY', household: true, legal: false, sourceUrl: '', effectiveFrom: new Date().toISOString().slice(0, 10) };

function FinancingTab() {
  const list = useQuery({ queryKey: ['admin', 'calc', 'financing'], queryFn: adminCalcService.financing });
  const run = useRun([['admin', 'calc', 'financing']]);
  const [editing, setEditing] = useState<FinancingProduct | 'new' | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const open = (product: FinancingProduct | 'new') => {
    setEditing(product);
    setForm(product === 'new' ? emptyProduct : {
      providerName: product.providerName, financingType: product.financingType, annualRate: String(Number(product.annualRate) * 100), minTermMonths: String(product.minTermMonths), maxTermMonths: String(product.maxTermMonths),
      allowedTerms: product.allowedTerms.join(','), minDownPaymentPct: String(Number(product.minDownPaymentPct) * 100), oneTimeFeePct: String(Number(product.oneTimeFeePct) * 100), monthlyFee: String(Number(product.monthlyFee)),
      paymentType: product.paymentType, household: product.customerTypes.includes('HOUSEHOLD'), legal: product.customerTypes.includes('LEGAL'), sourceUrl: product.sourceUrl ?? '', effectiveFrom: product.effectiveFrom.slice(0, 10),
    });
  };
  const submit = () => {
    const body = {
      providerName: form.providerName, financingType: form.financingType, annualRate: Number(form.annualRate) / 100, minTermMonths: Number(form.minTermMonths), maxTermMonths: Number(form.maxTermMonths),
      allowedTerms: form.allowedTerms.split(/[,\s]+/).filter(Boolean).map(Number), minDownPaymentPct: Number(form.minDownPaymentPct) / 100, oneTimeFeePct: Number(form.oneTimeFeePct) / 100, monthlyFee: Number(form.monthlyFee),
      paymentType: form.paymentType, customerTypes: [form.household && 'HOUSEHOLD', form.legal && 'LEGAL'].filter(Boolean) as CustomerType[], sourceUrl: form.sourceUrl || undefined, effectiveFrom: form.effectiveFrom,
    };
    run.mutate(() => (editing && editing !== 'new' ? adminCalcService.updateFinancing(editing.id, body) : adminCalcService.createFinancing(body)).then(() => setEditing(null)));
  };

  if (list.isLoading) return <PageLoader />;
  return (
    <>
      <div className="qs-page__actions"><Button onClick={() => open('new')}><Plus size={16} /> {t('Mahsulot qo‘shish')}</Button></div>
      <div className="qs-table-wrap">
        <table className="qs-table">
          <thead><tr><th>{t('Provayder')}</th><th>{t('Stavka')}</th><th>{t('Muddat')}</th><th>{t('Boshlang‘ich to‘lov')}</th><th>{t('Holat')}</th><th /></tr></thead>
          <tbody>
            {list.data?.map((product) => (
              <tr key={product.id}>
                <td><div className="qs-cell-title"><strong>{product.providerName}</strong><small>{product.paymentType === 'ANNUITY' ? t('Annuitet') : t('Differensial')} · v{product.version}</small></div></td>
                <td className="qs-num">{formatPercent(Number(product.annualRate), 1)}</td>
                <td className="qs-num">{product.allowedTerms.length ? product.allowedTerms.join(', ') : `${product.minTermMonths}–${product.maxTermMonths}`} {t('oy')}</td>
                <td className="qs-num">{formatPercent(Number(product.minDownPaymentPct), 0)}</td>
                <td><StatusBadge map={PUBLISH_STATUS} status={product.status} /></td>
                <td className="qs-right">
                  <span className="qs-page__actions" style={{ justifyContent: 'flex-end' }}>
                    <Button size="sm" variant="secondary" onClick={() => open(product)}>{t('Tahrirlash')}</Button>
                    {product.status === 'DRAFT' && <Button size="sm" onClick={() => run.mutate(() => adminCalcService.publishFinancing(product.id))}>{t('Tasdiqlash')}</Button>}
                    {product.status === 'PUBLISHED' && <Button size="sm" variant="ghost" onClick={() => run.mutate(() => adminCalcService.archiveFinancing(product.id))}>{t('Arxivlash')}</Button>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('Yangi moliyalashtirish mahsuloti') : t('Mahsulotni tahrirlash')} large>
        <div className="qs-form">
          {editing && editing !== 'new' && editing.status === 'PUBLISHED' && <Alert tone="warning">{t('Saqlansa yangi versiya qoralamaga o‘tadi va qayta tasdiqlash kerak bo‘ladi.')}</Alert>}
          <Input label={t('Provayder va mahsulot nomi')} value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} />
          <div className="qs-form__row">
            <Select label={t('Turi')} value={form.financingType} onChange={(e) => setForm({ ...form, financingType: e.target.value })} options={[{ value: 'BANK_LOAN', label: t('Bank krediti') }, { value: 'INSTALLMENT', label: t('Bo‘lib to‘lash') }, { value: 'LEASING', label: t('Lizing') }]} />
            <Select label={t('To‘lov turi')} value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })} options={[{ value: 'ANNUITY', label: t('Annuitet') }, { value: 'DIFFERENTIATED', label: t('Differensial') }]} />
            <Input label={t('Yillik stavka, %')} inputMode="decimal" value={form.annualRate} onChange={(e) => setForm({ ...form, annualRate: e.target.value })} />
          </div>
          <div className="qs-form__row">
            <Input label={t('Min. muddat, oy')} inputMode="numeric" value={form.minTermMonths} onChange={(e) => setForm({ ...form, minTermMonths: e.target.value })} />
            <Input label={t('Maks. muddat, oy')} inputMode="numeric" value={form.maxTermMonths} onChange={(e) => setForm({ ...form, maxTermMonths: e.target.value })} />
            <Input label={t('Ruxsat etilgan muddatlar')} value={form.allowedTerms} onChange={(e) => setForm({ ...form, allowedTerms: e.target.value })} placeholder="12,24,36" />
          </div>
          <div className="qs-form__row">
            <Input label={t('Min. boshlang‘ich to‘lov, %')} inputMode="decimal" value={form.minDownPaymentPct} onChange={(e) => setForm({ ...form, minDownPaymentPct: e.target.value })} />
            <Input label={t('Bir martalik komissiya, %')} inputMode="decimal" value={form.oneTimeFeePct} onChange={(e) => setForm({ ...form, oneTimeFeePct: e.target.value })} />
            <Input label={t('Oylik to‘lov (xizmat), so‘m')} inputMode="numeric" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} />
          </div>
          <div className="qs-form__row">
            <label className="qs-check"><input type="checkbox" checked={form.household} onChange={(e) => setForm({ ...form, household: e.target.checked })} /> {t('Maishiy')}</label>
            <label className="qs-check"><input type="checkbox" checked={form.legal} onChange={(e) => setForm({ ...form, legal: e.target.checked })} /> {t('Yuridik')}</label>
            <Input label={t('Boshlanishi')} type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          </div>
          <Input label={t('Rasmiy manba')} type="url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} hint={t('Tasdiqlash uchun majburiy')} />
          <div className="qs-form__actions">
            <Button variant="ghost" onClick={() => setEditing(null)}>{t('Bekor qilish')}</Button>
            <Button loading={run.isPending} disabled={!form.providerName || !form.annualRate} onClick={submit}>{t('Saqlash')}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function RegionalYieldTab() {
  const list = useQuery({ queryKey: ['admin', 'calc', 'yields'], queryFn: adminCalcService.regionalYields });
  const run = useRun([['admin', 'calc', 'yields']]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  if (list.isLoading) return <PageLoader />;
  const rows = REGIONS.map((region) => ({ region, row: list.data?.find((item) => item.regionCode === region.code) }));
  return (
    <>
      <Alert tone="info">{t('DEFAULT usuli: PVGIS va NASA POWER ikkalasi ham mavjud bo‘lmaganda ishlatiladi (kWh/kWp/oy, yo‘qotishlarsiz). Natijada «viloyat o‘rtachasi» belgisi chiqadi.')}</Alert>
      <div className="qs-table-wrap">
        <table className="qs-table">
          <thead><tr><th>{t('Hudud')}</th>{MONTHS.map((m) => <th key={m} className="qs-right">{t(m)}</th>)}<th className="qs-right">{t('Yil')}</th><th /></tr></thead>
          <tbody>
            {rows.map(({ region, row }) => {
              const values = draft[region.code] ?? (row?.monthlyYieldJson ?? new Array(12).fill(0)).map(String);
              const changed = !!draft[region.code];
              return (
                <tr key={region.code}>
                  <td><strong>{region.name}</strong></td>
                  {values.map((value, m) => (
                    <td key={m}><input className="qs-input-sm" style={{ width: 60, textAlign: 'right' }} aria-label={`${region.name} ${MONTHS[m]}`} value={value} onChange={(e) => setDraft({ ...draft, [region.code]: values.map((v, i) => (i === m ? e.target.value.replace(/[^\d.]/g, '') : v)) })} /></td>
                  ))}
                  <td className="qs-right qs-num">{formatNumber(values.reduce((sum, v) => sum + Number(v || 0), 0))}</td>
                  <td>{changed && <Button size="sm" loading={run.isPending} onClick={() => run.mutate(() => adminCalcService.saveRegionalYield(region.code, values.map(Number)).then(() => setDraft(({ [region.code]: _, ...rest }) => rest)))}>{t('Saqlash')}</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SolarTab() {
  const list = useQuery({ queryKey: ['admin', 'calc', 'solar'], queryFn: adminCalcService.solarDatasets });
  if (list.isLoading) return <PageLoader />;
  return (
    <>
      <Alert tone="info">{t('Kesh: koordinata 0,05° to‘rga, qiyalik va yo‘nalish 5° qadamga yaxlitlanadi; 180 kun amal qiladi.')}</Alert>
      <div className="qs-table-wrap">
        <table className="qs-table">
          <thead><tr><th>{t('Manba')}</th><th>{t('Katak')}</th><th>{t('Qiyalik / yo‘nalish')}</th><th className="qs-right">{t('kWh/kWp/yil')}</th><th>{t('Olingan')}</th><th>{t('Holat')}</th></tr></thead>
          <tbody>
            {list.data?.map((row) => (
              <tr key={row.id}>
                <td>{row.provider === 'PVGIS' ? 'PVGIS (A)' : row.provider === 'NASA_POWER' ? 'NASA POWER (B)' : 'DEFAULT'}</td>
                <td className="qs-mono">{row.cellKey}</td>
                <td>{row.tiltBucket}° / {row.azimuthBucket}°</td>
                <td className="qs-right qs-num">{formatNumber(Number(row.annualYieldKwhPerKwp))}</td>
                <td className="qs-muted">{formatDateTime(row.fetchedAt)}</td>
                <td><Badge tone={row.status === 'FRESH' ? 'success' : row.status === 'STALE' ? 'warning' : 'danger'}>{row.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.data?.length && <p className="qs-muted">{t('Kesh bo‘sh — birinchi hisobda to‘ldiriladi.')}</p>}
    </>
  );
}

/** U12: kalkulyator sozlamalari — parametrlar versiyalari, moliyalashtirish, viloyat unumdorligi, solar kesh. */
export function AdminCalcSettingsPage() {
  const [tab, setTab] = useState<'settings' | 'financing' | 'yield' | 'solar'>('settings');
  const tabs = [['settings', t('Parametrlar')], ['financing', t('Moliyalashtirish')], ['yield', t('Viloyat unumdorligi')], ['solar', t('Solar kesh')]] as const;
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Kalkulyator sozlamalari')}</h1><p>{t('Hisob parametrlari va ma’lumot manbalari. Har o‘zgarish auditga yoziladi.')}</p></div></div>
      <TabBar variant="tabs" role="tablist">
        {tabs.map(([key, label]) => <Tab key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} selected={tab === key}>{label}</Tab>)}
      </TabBar>
      {tab === 'settings' && <SettingsTab />}
      {tab === 'financing' && <FinancingTab />}
      {tab === 'yield' && <RegionalYieldTab />}
      {tab === 'solar' && <SolarTab />}
    </div>
  );
}
