import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, LayoutTemplate, Plus, Search, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageLoader } from '@/components/common/PageLoader';
import { kw, sum, sumShort } from '@/features/calc/labels';
import { dealsService } from '@/features/deals/deals.service';
import { ITEM_TYPE, num, QUOTE_STATUS } from '@/features/deals/labels';
import type { QuoteInput, QuoteItemType, QuoteTemplate, QuoteView, ShopLeadView } from '@/features/deals/types';
import { useCurrentShop } from '@/features/shop/current-shop';
import { apiPost } from '@/services/api.client';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate, formatDecimal } from '@/lib/format';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { t } from '@/i18n';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Chip } from '@/components/ui/Chip';

interface Line {
  key: string;
  itemType: QuoteItemType;
  productModelId?: string;
  serviceId?: string;
  title: string;
  quantity: string;
  unitPrice: string;
  category?: string;
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
const plusDays = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date(Date.now() + n * 86_400_000));
const key = () => Math.random().toString(36).slice(2);
const parse = (v: string) => Number(String(v).replace(/\s/g, '').replace(',', '.')) || 0;

function fromQuote(q: QuoteView | null, lead: ShopLeadView) {
  return {
    lines: q ? q.items.map((i) => ({ key: key(), itemType: i.itemType, productModelId: i.productModelId ?? undefined, serviceId: i.serviceId ?? undefined, title: i.titleSnapshot, quantity: String(num(i.quantity)), unitPrice: String(Math.round(num(i.unitPrice))) })) : [],
    systemPowerKw: q?.systemPowerKw ? String(num(q.systemPowerKw)) : lead.request.requiredCapacityKw ? String(num(lead.request.requiredCapacityKw)) : '',
    deliveryCost: '0', // yetkazish/qo‘shimcha — qatorlar orqali
    discountAmount: q ? String(Math.round(num(q.discountAmount))) : '0',
    vatIncluded: q?.vatIncluded ?? true,
    vatRate: q ? String(num(q.vatRate)) : '12',
    warrantyEquipmentMonths: q?.warrantyEquipmentMonths != null ? String(q.warrantyEquipmentMonths) : '',
    warrantyInstallationMonths: q?.warrantyInstallationMonths != null ? String(q.warrantyInstallationMonths) : '',
    warrantyText: q?.warrantyText ?? '',
    durationDays: q?.durationDays != null ? String(q.durationDays) : '',
    includedScope: q?.includedScope ?? '',
    excludedScope: q?.excludedScope ?? '',
    validUntil: q?.validUntil?.slice(0, 10) ?? plusDays(14),
    financing: q?.financingOptions[0] ? { providerName: q.financingOptions[0].providerName, annualRate: String(num(q.financingOptions[0].annualRate) * 100), termMonths: String(q.financingOptions[0].termMonths), financingType: q.financingOptions[0].financingType } : null,
  };
}

/** U11.4: taklif tayyorlash — chapda forma, o‘ngda sticky xulosa; summalar serverda (UI — preview). */
export function QuoteBuilder({ lead, onClose }: { lead: ShopLeadView; onClose: () => void }) {
  const { shopId, can } = useCurrentShop();
  const queryClient = useQueryClient();
  const existing = useQuery({ queryKey: ['shop-quote', shopId, lead.id], queryFn: () => dealsService.shopQuoteFor(shopId!, lead.id), enabled: !!shopId });
  if (existing.isLoading || !shopId) return <PageLoader />;
  return <BuilderForm lead={lead} quote={existing.data ?? null} shopId={shopId} canSend={can('quote.send')} canWithdraw={can('quote.withdraw')} onClose={onClose} onSaved={() => void queryClient.invalidateQueries({ queryKey: ['shop-quote', shopId, lead.id] })} />;
}

function BuilderForm({ lead, quote, shopId, canSend, canWithdraw, onClose, onSaved }: { lead: ShopLeadView; quote: QuoteView | null; shopId: string; canSend: boolean; canWithdraw: boolean; onClose: () => void; onSaved: () => void }) {
  const init = useMemo(() => fromQuote(quote, lead), [quote, lead]);
  const [lines, setLines] = useState<Line[]>(init.lines);
  const [f, setF] = useState(init);
  const [search, setSearch] = useState('');
  const [current, setCurrent] = useState<QuoteView | null>(quote);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [saved, setSaved] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const catalog = useQuery({ queryKey: ['builder-catalog', shopId, search], queryFn: () => dealsService.builderCatalog(shopId, search || undefined) });
  const set = (patch: Partial<typeof f>) => setF((cur) => ({ ...cur, ...patch }));
  const status = current?.status ?? 'DRAFT';
  const editable = !current || ['DRAFT', 'SENT', 'VIEWED'].includes(status);
  const sent = current && ['SENT', 'VIEWED'].includes(status);

  // Jonli preview (server bilan bir xil formula; yakuniy qiymat serverda).
  const preview = useMemo(() => {
    const by = (type: QuoteItemType) => lines.filter((l) => l.itemType === type).reduce((s, l) => s + Math.round(parse(l.quantity) * parse(l.unitPrice) * 100) / 100, 0);
    const base = by('EQUIPMENT') + by('INSTALLATION') + by('DELIVERY') + by('OTHER') - parse(f.discountAmount);
    const rate = parse(f.vatRate);
    const vat = base <= 0 ? 0 : f.vatIncluded ? (base * rate) / (100 + rate) : (base * rate) / 100;
    const total = f.vatIncluded ? base : base + vat;
    const power = parse(f.systemPowerKw);
    return { equipment: by('EQUIPMENT'), installation: by('INSTALLATION'), delivery: by('DELIVERY'), other: by('OTHER'), vat, total, perKw: power ? total / power : null };
  }, [lines, f]);

  const missing = [
    !lines.length && t('kamida bitta qator'),
    !f.validUntil && t('amal qilish muddati'),
    f.validUntil && f.validUntil <= today() && t('amal qilish muddati bugundan keyin bo‘lsin'),
    f.warrantyEquipmentMonths === '' && t('uskuna kafolati'),
    f.warrantyInstallationMonths === '' && t('montaj kafolati'),
    !f.durationDays && t('montaj muddati'),
    !f.includedScope.trim() && t('nimalar kiradi'),
    !f.excludedScope.trim() && t('nimalar kirmaydi'),
    preview.total < 0 && t('jami manfiy bo‘lmasin'),
  ].filter(Boolean) as string[];

  // Moslik tekshiruvi (TZ 11.13): panel + invertor (+ akkumulyator) qatorlari bo‘lsa.
  const panel = lines.find((l) => l.category === 'quyosh-panellari' && l.productModelId);
  const inverter = lines.find((l) => l.category === 'invertorlar' && l.productModelId);
  const battery = lines.find((l) => l.category === 'akkumulyatorlar' && l.productModelId);
  const panelsCount = panel ? Math.max(1, Math.round(parse(panel.quantity))) : 0;
  const strings = panelsCount > 14 ? Math.ceil(panelsCount / 14) : 1;
  const compat = useQuery({
    queryKey: ['compat', panel?.productModelId, inverter?.productModelId, battery?.productModelId, panelsCount],
    queryFn: () => apiPost<{ status: 'OK' | 'WARNING' | 'ERROR' | 'UNKNOWN'; checks: Array<{ code: string; status: string }> }>('/compatibility/check', { panelModelId: panel!.productModelId, inverterModelId: inverter!.productModelId, batteryModelId: battery?.productModelId, seriesCount: Math.max(1, Math.ceil(panelsCount / strings)), parallelStrings: strings }),
    enabled: !!panel && !!inverter,
    retry: false,
  });

  function input(): QuoteInput {
    return {
      items: lines.map((l) => ({ itemType: l.itemType, productModelId: l.productModelId, serviceId: l.serviceId, title: l.title.trim() || undefined, quantity: parse(l.quantity), unitPrice: parse(l.unitPrice) })),
      discountAmount: parse(f.discountAmount),
      deliveryCost: 0,
      otherCosts: 0,
      vatIncluded: f.vatIncluded,
      vatRate: parse(f.vatRate),
      systemPowerKw: parse(f.systemPowerKw) || undefined,
      warrantyEquipmentMonths: f.warrantyEquipmentMonths === '' ? undefined : Number(f.warrantyEquipmentMonths),
      warrantyInstallationMonths: f.warrantyInstallationMonths === '' ? undefined : Number(f.warrantyInstallationMonths),
      warrantyText: f.warrantyText,
      durationDays: f.durationDays ? Number(f.durationDays) : undefined,
      includedScope: f.includedScope,
      excludedScope: f.excludedScope,
      validUntil: f.validUntil || undefined,
      financingOptions: f.financing && f.financing.providerName.trim() ? [{ financingType: f.financing.financingType, providerName: f.financing.providerName.trim(), annualRate: parse(f.financing.annualRate) / 100, termMonths: Number(f.financing.termMonths) || 12 }] : [],
    };
  }

  const createKey = useIdempotencyKey(current ? null : input());
  const sendKey = useIdempotencyKey(current?.id ?? null);
  const saveDraft = useMutation({
    mutationFn: async () => (current ? dealsService.updateQuote(current.id, current.version, input()) : dealsService.createQuote(lead.request.id, shopId, input(), createKey.key)),
    onSuccess: (q) => { setCurrent(q); setSaved(t('Qoralama saqlandi')); onSaved(); },
  });
  const send = useMutation({
    mutationFn: async () => {
      const draft = current ? await dealsService.updateQuote(current.id, current.version, input()) : await dealsService.createQuote(lead.request.id, shopId, input(), createKey.key);
      return dealsService.sendQuote(draft.id, current?.id === draft.id ? sendKey.key : `${createKey.key}-send`);
    },
    onSuccess: (q) => { setCurrent(q); setSaved(t('Taklif mijozga yuborildi')); onSaved(); },
  });
  const revise = useMutation({ mutationFn: () => dealsService.reviseQuote(current!.id, current!.version, input()), onSuccess: (q) => { setCurrent(q); setReviseOpen(false); setSaved(t('Yangi tahrir yuborildi')); onSaved(); } });
  const withdraw = useMutation({ mutationFn: () => dealsService.withdrawQuote(current!.id), onSuccess: () => { setWithdrawOpen(false); onSaved(); onClose(); } });
  const error = saveDraft.error ?? send.error ?? revise.error ?? withdraw.error;
  useEffect(() => { if (saved) { const id = window.setTimeout(() => setSaved(''), 4000); return () => window.clearTimeout(id); } }, [saved]);

  /** Shablonni qo‘llash: qatorlar almashtiriladi, shartlar to‘ldiriladi; muddat va quvvat joyida qoladi. */
  function applyTemplate(tpl: QuoteTemplate) {
    const d = tpl.defaults;
    setLines(tpl.items.map((i) => ({ key: key(), itemType: i.itemType, productModelId: i.productModelId, serviceId: i.serviceId, title: i.title ?? '', quantity: String(i.quantity), unitPrice: String(Math.round(i.unitPrice)) })));
    set({
      ...(d.discountAmount != null && { discountAmount: String(Math.round(d.discountAmount)) }),
      ...(d.vatIncluded != null && { vatIncluded: d.vatIncluded }),
      ...(d.vatRate != null && { vatRate: String(d.vatRate) }),
      ...(d.warrantyEquipmentMonths != null && { warrantyEquipmentMonths: String(d.warrantyEquipmentMonths) }),
      ...(d.warrantyInstallationMonths != null && { warrantyInstallationMonths: String(d.warrantyInstallationMonths) }),
      ...(d.warrantyText != null && { warrantyText: d.warrantyText }),
      ...(d.durationDays != null && { durationDays: String(d.durationDays) }),
      ...(d.includedScope != null && { includedScope: d.includedScope }),
      ...(d.excludedScope != null && { excludedScope: d.excludedScope }),
      ...(d.financingOptions?.[0] && { financing: { providerName: d.financingOptions[0].providerName, annualRate: String(d.financingOptions[0].annualRate * 100), termMonths: String(d.financingOptions[0].termMonths), financingType: d.financingOptions[0].financingType } }),
    });
    setTemplatesOpen(false);
    setSaved(t('«{name}» shabloni qo‘llandi', { name: tpl.name }));
  }
  function templateBody(): Pick<QuoteTemplate, 'items' | 'defaults'> {
    const { items = [], validUntil: _v, systemPowerKw: _p, deliveryCost: _d, otherCosts: _o, ...defaults } = input();
    return { items, defaults };
  }

  const setLine = (k: string, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  const calcCost = lead.calculation?.initialCost ?? null;

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div>
          <h1>{current ? t('Taklif · tahrir {n}', { n: Math.max(1, current.currentRevision) }) : t('Taklif tayyorlash')}</h1>
          <p>{lead.customer.firstName ?? t('Mijoz')} · №{lead.request.number}</p>
        </div>
        <div className="qs-page__actions">
          {current && <StatusBadge map={QUOTE_STATUS} status={status} />}
          {editable && <Button variant="secondary" onClick={() => setTemplatesOpen(true)}><LayoutTemplate size={15} /> {t('Shablonlar')}</Button>}
          {current && status !== 'DRAFT' && <Button variant="secondary" onClick={() => void dealsService.quotePdf(current.id, 'uz', lead.request.number)}><Download size={15} /> PDF</Button>}
          <Button variant="ghost" onClick={onClose}><ArrowLeft size={15} /> {t('So‘rovga qaytish')}</Button>
        </div>
      </div>
      {templatesOpen && <TemplatesModal shopId={shopId} hasLines={lines.length > 0} current={templateBody} onApply={applyTemplate} onClose={() => setTemplatesOpen(false)} />}
      {!editable && <Alert tone="info">{t('Bu taklifni endi o‘zgartirib bo‘lmaydi ({s}).', { s: QUOTE_STATUS[status].label })}</Alert>}
      <div className="qs-builder">
        <div className="qs-page qs-gap-4">
          <div className="qs-card">
            <header><h2>{t('Qatorlar')}</h2></header>
            <div className="qs-page__actions qs-mb-3">
              <Search size={16} />
              <input className="qs-input-sm" style={{ flex: 1, minWidth: 200 }} placeholder={t('Katalogdan qidirish (brend, model)')} aria-label={t('Katalogdan qidirish')} value={search} onChange={(e) => setSearch(e.target.value)} />
              {catalog.data?.exchangeRate && <small className="qs-muted">{t('MB kursi: 1 USD = {r} so‘m ({d})', { r: formatDecimal(num(catalog.data.exchangeRate.rateToUzs), 2), d: formatDate(catalog.data.exchangeRate.rateDate) })}</small>}
            </div>
            {editable && (
              <div className="qs-chips qs-mb-3">
                {catalog.data?.products.slice(0, 8).map((p) => (
                  <Chip key={p.shopProductId} onClick={() => setLines((all) => [...all, { key: key(), itemType: 'EQUIPMENT', productModelId: p.model.id, title: `${p.model.brand} ${p.model.model}`, quantity: '1', unitPrice: p.priceUzs ? String(p.priceUzs) : '', category: p.model.category.slug }])}>
                    <Plus size={13} /> {p.model.brand} {p.model.model}{p.priceUzs ? ` · ${sumShort(p.priceUzs)}` : ''}{p.offer?.currency === 'USD' ? ' (USD→UZS)' : ''}
                  </Chip>
                ))}
                {catalog.data?.services.map((s) => (
                  <Chip key={s.id} onClick={() => setLines((all) => [...all, { key: key(), itemType: s.serviceType === 'DELIVERY' ? 'DELIVERY' : 'INSTALLATION', serviceId: s.id, title: t('Xizmat: {s}', { s: s.serviceType }), quantity: s.pricingModel === 'PER_KW' ? f.systemPowerKw || '1' : '1', unitPrice: s.priceUzs ? String(s.priceUzs) : '' }])}>
                    <Plus size={13} /> {t('Xizmat')}: {s.serviceType}{s.priceUzs ? ` · ${sumShort(s.priceUzs)}` : ''}
                  </Chip>
                ))}
              </div>
            )}
            <div className="qs-builder-lines">
              {lines.map((l) => (
                <div key={l.key} className="qs-builder-line">
                  <SelectMenu className="qs-select" aria-label={t('Turi')} disabled={!editable} value={l.itemType} onChange={(e) => setLine(l.key, { itemType: e.target.value as QuoteItemType })}>
                    {(['EQUIPMENT', 'INSTALLATION', 'DELIVERY', 'OTHER'] as QuoteItemType[]).map((tp) => <option key={tp} value={tp}>{ITEM_TYPE[tp]}</option>)}
                  </SelectMenu>
                  <input className="qs-input-sm" aria-label={t('Nomi')} disabled={!editable} value={l.title} maxLength={300} onChange={(e) => setLine(l.key, { title: e.target.value })} />
                  <input className="qs-input-sm" aria-label={t('Miqdor')} inputMode="decimal" disabled={!editable} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value.replace(/[^\d.,]/g, '') })} />
                  <input className="qs-input-sm" aria-label={t('Birlik narxi')} inputMode="numeric" disabled={!editable} value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: e.target.value.replace(/[^\d.,]/g, '') })} />
                  <span className="qs-num qs-text-right">{sumShort(parse(l.quantity) * parse(l.unitPrice))}</span>
                  <Button variant="ghost" size="sm" aria-label={t('O‘chirish')} disabled={!editable} onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))}><Trash2 size={15} /></Button>
                </div>
              ))}
              {editable && <Button variant="ghost" size="sm" onClick={() => setLines((all) => [...all, { key: key(), itemType: 'OTHER', title: '', quantity: '1', unitPrice: '' }])}><Plus size={14} /> {t('Qo‘lda qator qo‘shish')}</Button>}
            </div>
          </div>
          <div className="qs-card">
            <h2>{t('Shartlar')}</h2>
            <div className="qs-form">
              <div className="qs-form__row">
                <Input label={t('Tizim quvvati')} suffix={t('kVt')} inputMode="decimal" disabled={!editable} value={f.systemPowerKw} onChange={(e) => set({ systemPowerKw: e.target.value.replace(/[^\d.,]/g, '') })} />
                <Input label={t('Chegirma')} suffix={t('so‘m')} inputMode="numeric" disabled={!editable} value={f.discountAmount} onChange={(e) => set({ discountAmount: e.target.value.replace(/[^\d]/g, '') })} />
                <Input label={t('QQS stavkasi')} suffix="%" inputMode="decimal" disabled={!editable} value={f.vatRate} onChange={(e) => set({ vatRate: e.target.value.replace(/[^\d.,]/g, '') })} />
              </div>
              <label className="qs-check"><input type="checkbox" disabled={!editable} checked={f.vatIncluded} onChange={(e) => set({ vatIncluded: e.target.checked })} /> {t('Narxlarda QQS bor (aks holda qo‘shiladi)')}</label>
              <div className="qs-form__row">
                <Input label={t('Kafolat: uskuna')} suffix={t('oy')} inputMode="numeric" required disabled={!editable} value={f.warrantyEquipmentMonths} onChange={(e) => set({ warrantyEquipmentMonths: e.target.value.replace(/\D/g, '') })} />
                <Input label={t('Kafolat: montaj')} suffix={t('oy')} inputMode="numeric" required disabled={!editable} value={f.warrantyInstallationMonths} onChange={(e) => set({ warrantyInstallationMonths: e.target.value.replace(/\D/g, '') })} />
                <Input label={t('Montaj muddati')} suffix={t('kun')} inputMode="numeric" required disabled={!editable} value={f.durationDays} onChange={(e) => set({ durationDays: e.target.value.replace(/\D/g, '') })} />
                <Input label={t('Amal qiladi')} type="date" required min={plusDays(1)} disabled={!editable} value={f.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
              </div>
              <div className="qs-grid-2">
                <Textarea label={t('Nimalar kiradi')} required disabled={!editable} value={f.includedScope} maxLength={4000} onChange={(e) => set({ includedScope: e.target.value })} />
                <Textarea label={t('Nimalar kirmaydi')} required disabled={!editable} value={f.excludedScope} maxLength={4000} onChange={(e) => set({ excludedScope: e.target.value })} />
              </div>
              <Textarea label={t('Kafolat shartlari (ixtiyoriy)')} disabled={!editable} value={f.warrantyText} maxLength={4000} onChange={(e) => set({ warrantyText: e.target.value })} />
              {f.financing ? (
                <div className="qs-form__row">
                  <Input label={t('Bank / sotuvchi')} disabled={!editable} value={f.financing.providerName} onChange={(e) => set({ financing: { ...f.financing!, providerName: e.target.value } })} />
                  <Input label={t('Yillik stavka')} suffix="%" inputMode="decimal" disabled={!editable} value={f.financing.annualRate} onChange={(e) => set({ financing: { ...f.financing!, annualRate: e.target.value.replace(/[^\d.,]/g, '') } })} />
                  <Input label={t('Muddat')} suffix={t('oy')} inputMode="numeric" disabled={!editable} value={f.financing.termMonths} onChange={(e) => set({ financing: { ...f.financing!, termMonths: e.target.value.replace(/\D/g, '') } })} />
                </div>
              ) : (
                editable && <Button variant="ghost" size="sm" onClick={() => set({ financing: { providerName: '', annualRate: '24', termMonths: '24', financingType: 'BANK_LOAN' } })}><Plus size={14} /> {t('Moliyalashtirish varianti')}</Button>
              )}
            </div>
          </div>
        </div>
        <aside className="qs-builder__summary">
          <div className="qs-card">
            <h2>{t('Xulosa')}</h2>
            <div className="qs-sums qs-max-w-none">
              <div><span>{t('Uskuna')}</span><span>{sum(preview.equipment)}</span></div>
              <div><span>{t('Montaj')}</span><span>{sum(preview.installation)}</span></div>
              {preview.delivery > 0 && <div><span>{t('Yetkazish')}</span><span>{sum(preview.delivery)}</span></div>}
              {preview.other > 0 && <div><span>{t('Qo‘shimcha')}</span><span>{sum(preview.other)}</span></div>}
              {parse(f.discountAmount) > 0 && <div><span>{t('Chegirma')}</span><span>− {sum(parse(f.discountAmount))}</span></div>}
              <div><span>{f.vatIncluded ? t('shu jumladan QQS') : t('QQS')}</span><span>{sum(Math.round(preview.vat))}</span></div>
              <div className="is-total"><span>{t('Jami')}</span><span>{sum(Math.round(preview.total))}</span></div>
              {preview.perKw && <div><span>{t('1 kVt narxi')}</span><span>{sumShort(preview.perKw)}</span></div>}
            </div>
            {calcCost && <p className="qs-muted qs-m-0 qs-mt-3">{t('Mijoz kutgan narx diapazoni: {a}–{b}', { a: sumShort(calcCost * 0.9), b: sumShort(calcCost * 1.1) })}{lead.calculation?.systemPowerKw ? ` (${kw(lead.calculation.systemPowerKw)})` : ''}</p>}
            {panel && inverter && (
              <p className="qs-m-0 qs-mt-3">
                {t('Moslik')}: {compat.isLoading ? '…' : <Badge tone={compat.data?.status === 'OK' ? 'success' : compat.data?.status === 'ERROR' ? 'danger' : compat.data?.status === 'WARNING' ? 'warning' : 'neutral'}>{compat.data?.status === 'OK' ? t('Mos') : compat.data?.status === 'ERROR' ? t('Mos emas') : compat.data?.status === 'WARNING' ? t('Diqqat') : t('Ma’lumot yetarli emas')}</Badge>}
                <small className="qs-muted"> · {t('{s} ta ketma-ket × {p} qator', { s: Math.ceil(panelsCount / strings), p: strings })}</small>
              </p>
            )}
          </div>
          {editable && (
            <div className="qs-card">
              {missing.length > 0 && <Alert tone="warning" title={t('Yuborish uchun to‘ldiring')}>{missing.join(', ')}</Alert>}
              {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
              {saved && <Alert tone="success">{saved}</Alert>}
              <div className="qs-form__actions qs-mt-3">
                {status === 'DRAFT' && <Button variant="secondary" loading={saveDraft.isPending} disabled={!lines.length} onClick={() => saveDraft.mutate()}>{canSend ? t('Qoralamani saqlash') : t('Menejerga yuborish uchun saqlash')}</Button>}
                {status === 'DRAFT' && canSend && <Button loading={send.isPending} disabled={missing.length > 0} onClick={() => send.mutate()}>{t('Yuborish')}</Button>}
                {sent && canSend && <Button disabled={missing.length > 0} onClick={() => setReviseOpen(true)}>{t('Yangi tahrir yuborish')}</Button>}
                {current && canWithdraw && <Button variant="ghost" onClick={() => setWithdrawOpen(true)}>{t('Qaytarib olish')}</Button>}
              </div>
            </div>
          )}
        </aside>
      </div>
      <Modal open={reviseOpen} onClose={() => setReviseOpen(false)} title={t('Taklifni yangilash')} footer={<Button loading={revise.isPending} onClick={() => revise.mutate()}>{t('Yuborish')}</Button>}>
        <p>{t('Mijoz yangi tahrir haqida xabar oladi; oldingi tahrirlar tarixda saqlanadi.')}</p>
      </Modal>
      <ConfirmDialog open={withdrawOpen} title={t('Taklifni qaytarib olish')} description={t('Mijoz taklifni endi tanlay olmaydi. Keyin yangi taklif yuborishingiz mumkin.')} confirmLabel={t('Qaytarib olish')} tone="danger" loading={withdraw.isPending} onConfirm={() => withdraw.mutate()} onCancel={() => setWithdrawOpen(false)} />
    </div>
  );
}

/** Taklif shablonlari (TZ 13.3): tez-tez yuboriladigan to‘plamni bir bosishda yuklash yoki joriy taklifni shablon qilish. */
function TemplatesModal({ shopId, hasLines, current, onApply, onClose }: { shopId: string; hasLines: boolean; current: () => Pick<QuoteTemplate, 'items' | 'defaults'>; onApply: (tpl: QuoteTemplate) => void; onClose: () => void }) {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['quote-templates', shopId], queryFn: () => dealsService.quoteTemplates(shopId) });
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<QuoteTemplate | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['quote-templates', shopId] });
  const save = useMutation({ mutationFn: (id?: string) => dealsService.saveQuoteTemplate(shopId, { name: name.trim() || list.data?.find((x) => x.id === id)?.name || '', ...current() }, id), onSuccess: () => { setName(''); refresh(); } });
  const remove = useMutation({ mutationFn: (id: string) => dealsService.deleteQuoteTemplate(shopId, id), onSuccess: refresh });
  const error = save.error ?? remove.error;
  return (
    <Modal open large title={t('Taklif shablonlari')} onClose={onClose}>
      <div className="qs-form">
        {list.isLoading ? <PageLoader /> : !list.data?.length ? (
          <p className="qs-muted">{t('Hali shablon yo‘q. Tez-tez yuboradigan to‘plamingizni (panel, invertor, montaj, kafolat shartlari) shablon qilib saqlang.')}</p>
        ) : (
          list.data.map((tpl) => (
            <div key={tpl.id} className="qs-pick">
              <div>
                <strong>{tpl.name}</strong>
                <small>{t('{n} ta qator', { n: tpl.items.length })} · {sumShort(tpl.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0))} · {formatDate(tpl.updatedAt)}</small>
              </div>
              <div className="qs-page__actions">
                <Button size="sm" onClick={() => (hasLines ? setConfirm(tpl) : onApply(tpl))}>{t('Qo‘llash')}</Button>
                {hasLines && <Button size="sm" variant="ghost" loading={save.isPending && save.variables === tpl.id} onClick={() => save.mutate(tpl.id)}>{t('Joriy bilan yangilash')}</Button>}
                <Button size="sm" variant="ghost" aria-label={t('O‘chirish')} loading={remove.isPending && remove.variables === tpl.id} onClick={() => remove.mutate(tpl.id)}><Trash2 size={14} /></Button>
              </div>
            </div>
          ))
        )}
        {hasLines && (
          <div className="qs-page__actions" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 220 }}><Input label={t('Joriy taklifni shablon sifatida saqlash')} placeholder={t('Masalan: 5 kVt gibrid, Toshkent')} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
            <Button variant="secondary" disabled={name.trim().length < 2} loading={save.isPending && !save.variables} onClick={() => save.mutate(undefined)}>{t('Saqlash')}</Button>
          </div>
        )}
        <small className="qs-muted">{t('Shablonga qatorlar va shartlar (kafolat, muddat, nimalar kiradi/kirmaydi, chegirma, QQS, moliyalash) saqlanadi. Amal qilish muddati va quvvat har safar so‘rovdan olinadi.')}</small>
        {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={t('Shablonni qo‘llash')}
        description={t('Joriy qatorlar shablon qatorlari bilan almashtiriladi. Davom etasizmi?')}
        confirmLabel={t('Qo‘llash')}
        onConfirm={() => { if (confirm) onApply(confirm); setConfirm(null); }}
        onCancel={() => setConfirm(null)}
      />
    </Modal>
  );
}
