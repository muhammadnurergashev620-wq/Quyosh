import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Package, Plus, Search } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { useCurrentShop } from '@/features/shop/current-shop';
import { useShopBranches } from '@/features/shop/hooks';
import { PRODUCT_STATUS, STOCK_STATUS } from '@/features/shop/labels';
import type { Currency, StockStatus, ShopProductStatus } from '@/features/shop/types';
import { catalogService } from '@/features/catalog/catalog.service';
import { i18nText, keySpecs, SPEC_META } from '@/features/catalog/format';
import type { Category, ModelCard, Offer, OfferInput, ShopProduct, SpecKey } from '@/features/catalog/types';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate, formatNumber } from '@/lib/utils';
import { useAppStore } from '@/store/app.store';
import { ApiError } from '@/types/api';
import { t } from '@/i18n';
import '@/features/shop/shop.css';

const productsKey = (shopId: string | null) => ['shop', shopId ?? '-', 'products'];

function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Narx jadvali inline tahrir (U11.6). Eskirgan versiya — «boshqa xodim o‘zgartirgan» xabari va yangilash. */
function OfferCell({ shopId, product, offer, writable }: { shopId: string; product: ShopProduct; offer: Offer; writable: boolean }) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [price, setPrice] = useState(String(Math.round(Number(offer.price) * 100) / 100));
  useEffect(() => setPrice(String(Math.round(Number(offer.price) * 100) / 100)), [offer.price, offer.version]);
  const save = useMutation({
    mutationFn: (input: OfferInput) => catalogService.updateOffer(shopId, product.id, offer.id, { ...input, price: input.price, version: offer.version }),
    onSuccess: () => {
      pushToast(t('Narx yangilandi'), 'success');
      void queryClient.invalidateQueries({ queryKey: productsKey(shopId) });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') pushToast(t('Bu narx boshqa xodim tomonidan o‘zgartirilgan · Yangisi yuklandi'), 'error');
      else pushToast(getErrorMessage(error), 'error');
      void queryClient.invalidateQueries({ queryKey: productsKey(shopId) });
    },
  });
  const commit = () => {
    const normalized = price.replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) === Number(offer.price)) return setPrice(String(Number(offer.price)));
    save.mutate({ price: normalized });
  };
  return (
    <div className="qs-cell-title">
      <span className="qs-inline-price">
        {writable ? (
          <input aria-label={t('Narx')} value={price} onChange={(e) => setPrice(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} disabled={save.isPending} inputMode="decimal" />
        ) : (
          <strong className="qs-num">{formatNumber(Number(offer.price))}</strong>
        )}
        <span>{offer.currency === 'USD' ? '$' : t('so‘m')}</span>
      </span>
      <small>
        {offer.branch?.name ?? t('Barcha filiallar')} ·{' '}
        {writable ? (
          <select aria-label={t('Zaxira holati')} value={offer.stockStatus} onChange={(e) => save.mutate({ price: offer.price, stockStatus: e.target.value as StockStatus })} style={{ font: 'inherit', border: 0, background: 'transparent', color: 'inherit' }}>
            {(Object.keys(STOCK_STATUS) as StockStatus[]).map((value) => <option key={value} value={value}>{STOCK_STATUS[value].label}</option>)}
          </select>
        ) : STOCK_STATUS[offer.stockStatus].label}
        {offer.validUntil && ` · ${t('{date} gacha', { date: formatDate(offer.validUntil) })}`}
      </small>
    </div>
  );
}

function OfferFields({ value, onChange, branches }: { value: OfferInput; onChange: (next: OfferInput) => void; branches: Array<{ id: string; name: string }> }) {
  return (
    <>
      <div className="qs-form__row">
        <MoneyInput label={t('Narx')} value={value.price} onValueChange={(price) => onChange({ ...value, price })} suffix={value.currency === 'USD' ? '$' : t('so‘m')} />
        <Select label={t('Valyuta')} value={value.currency ?? 'UZS'} onChange={(e) => onChange({ ...value, currency: e.target.value as Currency })} options={[{ value: 'UZS', label: 'UZS' }, { value: 'USD', label: 'USD' }]} />
        <Select label={t('QQS')} value={value.vatIncluded === false ? 'no' : 'yes'} onChange={(e) => onChange({ ...value, vatIncluded: e.target.value === 'yes' })} options={[{ value: 'yes', label: t('QQS bilan') }, { value: 'no', label: t('QQSsiz') }]} />
      </div>
      <div className="qs-form__row">
        <Select label={t('Zaxira')} value={value.stockStatus ?? 'IN_STOCK'} onChange={(e) => onChange({ ...value, stockStatus: e.target.value as StockStatus })} options={(Object.keys(STOCK_STATUS) as StockStatus[]).map((stock) => ({ value: stock, label: STOCK_STATUS[stock].label }))} />
        <Select label={t('Filial')} value={value.branchId ?? ''} onChange={(e) => onChange({ ...value, branchId: e.target.value || null })} options={[{ value: '', label: t('Barcha filiallar') }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
        <Input label={t('Miqdor (ixtiyoriy)')} inputMode="numeric" value={value.quantity ?? ''} onChange={(e) => onChange({ ...value, quantity: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} />
      </div>
      <div className="qs-form__row">
        <Input label={t('Amal qilish boshlanishi')} type="date" value={value.validFrom ?? ''} onChange={(e) => onChange({ ...value, validFrom: e.target.value || undefined })} />
        <Input label={t('Amal qilish tugashi')} type="date" value={value.validUntil ?? ''} onChange={(e) => onChange({ ...value, validUntil: e.target.value || null })} />
      </div>
    </>
  );
}

const PROPOSE_FIELDS: Record<string, SpecKey[]> = {
  'quyosh-panellari': ['nominalPowerW', 'efficiencyPct', 'widthMm', 'heightMm', 'vocV', 'iscA', 'warrantyMonths'],
  invertorlar: ['inverterAcKw', 'inverterMaxDcV', 'mpptMinV', 'mpptMaxV', 'efficiencyPct', 'warrantyMonths'],
  akkumulyatorlar: ['batteryCapacityKwh', 'batteryVoltageV', 'batteryUsableDod', 'batteryChemistry', 'batteryCycles', 'warrantyMonths'],
};

function ProposeForm({ shopId, categories, initialQuery, onDone, onCancel }: { shopId: string; categories: Category[]; initialQuery: string; onDone: (model: ModelCard) => void; onCancel: () => void }) {
  const flat = categories.flatMap((category) => [category, ...category.children]);
  const [categoryId, setCategoryId] = useState(flat[0]?.id ?? '');
  const [brand, setBrand] = useState(initialQuery.split(' ')[0] ?? '');
  const [model, setModel] = useState(initialQuery.split(' ').slice(1).join(' '));
  const [specs, setSpecs] = useState<Partial<Record<SpecKey, string>>>({});
  const propose = useMutation({ mutationFn: () => catalogService.propose(shopId, { categoryId, brand: brand.trim(), model: model.trim(), ...Object.fromEntries(Object.entries(specs).filter(([, v]) => v !== '').map(([k, v]) => [k, k === 'batteryChemistry' ? v : Number(v!.replace(',', '.'))])) }), onSuccess: onDone });
  const slug = flat.find((category) => category.id === categoryId)?.slug ?? '';
  const fields = PROPOSE_FIELDS[slug] ?? ['warrantyMonths'];
  return (
    <form className="qs-form" onSubmit={(e: FormEvent) => { e.preventDefault(); propose.mutate(); }}>
      <Alert tone="info">{t('Yangi model administrator tekshiruvidan keyin katalogda chiqadi. Shu paytgacha u sizda «Qoralama» bo‘lib turadi.')}</Alert>
      <Select label={t('Kategoriya')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={flat.map((category) => ({ value: category.id, label: i18nText(category.nameI18n) }))} />
      <div className="qs-form__row">
        <Input label={t('Brend')} value={brand} onChange={(e) => setBrand(e.target.value)} required maxLength={120} />
        <Input label={t('Model')} value={model} onChange={(e) => setModel(e.target.value)} required maxLength={160} />
      </div>
      <div className="qs-form__row">
        {fields.map((key) => (
          <Input key={key} label={`${SPEC_META[key].label}${SPEC_META[key].unit && key !== 'batteryUsableDod' ? `, ${SPEC_META[key].unit}` : key === 'batteryUsableDod' ? ' (0–1)' : ''}`} value={specs[key] ?? ''} onChange={(e) => setSpecs({ ...specs, [key]: e.target.value })} inputMode={key === 'batteryChemistry' ? 'text' : 'decimal'} />
        ))}
      </div>
      {propose.isError && <Alert tone="danger">{getErrorMessage(propose.error)}</Alert>}
      <div className="qs-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('Orqaga')}</Button>
        <Button type="submit" loading={propose.isPending} disabled={!brand.trim() || !model.trim()}>{t('Taklif qilish')}</Button>
      </div>
    </form>
  );
}

function AddProductModal({ shopId, open, onClose }: { shopId: string; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const branches = useShopBranches(shopId);
  const categories = useQuery({ queryKey: ['catalog', 'categories'], queryFn: catalogService.categories, staleTime: 5 * 60_000 });
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim());
  const [selected, setSelected] = useState<ModelCard | null>(null);
  const [proposing, setProposing] = useState(false);
  const [description, setDescription] = useState('');
  const [offer, setOffer] = useState<OfferInput>({ price: '', currency: 'UZS', vatIncluded: true, stockStatus: 'IN_STOCK', branchId: null });
  const results = useQuery({ queryKey: ['shop', shopId, 'model-search', debounced], queryFn: () => catalogService.searchModels(shopId, debounced), enabled: open && debounced.length >= 2 });
  const create = useMutation({
    mutationFn: () => catalogService.createProduct(shopId, { productModelId: selected!.id, description: description.trim() || undefined, offer: offer.price ? offer : undefined }),
    onSuccess: () => {
      pushToast(t('Mahsulot qo‘shildi'), 'success');
      void queryClient.invalidateQueries({ queryKey: ['shop', shopId] });
      close();
    },
  });
  function close() {
    setQuery('');
    setSelected(null);
    setProposing(false);
    setDescription('');
    setOffer({ price: '', currency: 'UZS', vatIncluded: true, stockStatus: 'IN_STOCK', branchId: null });
    create.reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={proposing ? t('Yangi model taklif qilish') : t('Mahsulot qo‘shish')} large>
      {proposing ? (
        <ProposeForm shopId={shopId} categories={categories.data ?? []} initialQuery={query} onCancel={() => setProposing(false)} onDone={(model) => { setSelected(model); setProposing(false); }} />
      ) : !selected ? (
        <div className="qs-form">
          <Input label={t('Brend yoki model')} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Longi Hi-MO 6" autoFocus />
          {debounced.length >= 2 && (
            results.isLoading ? <PageLoader /> : (
              <ul className="qs-search-results">
                {results.data?.map((model) => (
                  <li key={model.id}>
                    <button type="button" onClick={() => setSelected(model)}>
                      <Package size={18} aria-hidden="true" />
                      <span><strong>{model.brand} {model.model}</strong><small>{i18nText(model.category.nameI18n)} · {keySpecs(model).join(' · ')}</small></span>
                      {model.status === 'PENDING' && <Badge tone="warning">{t('Tekshiruvda')}</Badge>}
                    </button>
                  </li>
                ))}
                {!results.data?.length && <li className="qs-muted">{t('Katalogda topilmadi.')}</li>}
              </ul>
            )
          )}
          <div className="qs-form__actions">
            <Button type="button" variant="secondary" onClick={() => setProposing(true)}><Plus size={16} /> {t('Yangi model taklif qilish')}</Button>
          </div>
        </div>
      ) : (
        <form className="qs-form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="qs-card" style={{ padding: 12 }}>
            <strong>{selected.brand} {selected.model}</strong>
            <div className="qs-muted">{i18nText(selected.category.nameI18n)} · {keySpecs(selected).join(' · ')}</div>
            {selected.status === 'PENDING' && <Badge tone="warning">{t('Model tekshiruvda — mahsulot qoralama bo‘lib qo‘shiladi')}</Badge>}
          </div>
          <Textarea label={t('Tavsif (ixtiyoriy)')} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={10000} />
          <OfferFields value={offer} onChange={setOffer} branches={branches.data ?? []} />
          {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
          <div className="qs-form__actions">
            <Button type="button" variant="ghost" onClick={() => setSelected(null)}>{t('Boshqa model')}</Button>
            <Button type="submit" loading={create.isPending}>{t('Qo‘shish')}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function AddOfferModal({ shopId, product, onClose }: { shopId: string; product: ShopProduct | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const branches = useShopBranches(shopId);
  const [offer, setOffer] = useState<OfferInput>({ price: '', currency: 'UZS', vatIncluded: true, stockStatus: 'IN_STOCK', branchId: null });
  const create = useMutation({
    mutationFn: () => catalogService.createOffer(shopId, product!.id, offer),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: productsKey(shopId) }); onClose(); },
  });
  return (
    <Modal open={!!product} onClose={onClose} title={product ? t('Narx qo‘shish: {name}', { name: `${product.productModel.brand} ${product.productModel.model}` }) : ''} large>
      <form className="qs-form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <OfferFields value={offer} onChange={setOffer} branches={branches.data ?? []} />
        {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
        <div className="qs-form__actions"><Button type="submit" loading={create.isPending} disabled={!offer.price}>{t('Saqlash')}</Button></div>
      </form>
    </Modal>
  );
}

/** U11.6: katalog va mahsulotlar — ro‘yxat, inline narx, ommaviy amallar. */
export function ShopCatalogPage() {
  const { shopId, can } = useCurrentShop();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [status, setStatus] = useState<ShopProductStatus | ''>('');
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [offerFor, setOfferFor] = useState<ShopProduct | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [percent, setPercent] = useState('');
  const products = useQuery({ queryKey: [...productsKey(shopId), status, debouncedQ, page], queryFn: () => catalogService.products(shopId!, { status: status || undefined, q: debouncedQ || undefined, page }), enabled: !!shopId, placeholderData: keepPreviousData });
  const bulk = useMutation({
    mutationFn: (input: Parameters<typeof catalogService.bulk>[1]) => catalogService.bulk(shopId!, input),
    onSuccess: (result) => {
      pushToast(t('{n} ta yozuv yangilandi', { n: result.affected }), 'success');
      setSelected(new Set());
      setPercent('');
      void queryClient.invalidateQueries({ queryKey: productsKey(shopId) });
    },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
  const writable = can('catalog.write');
  const offersWritable = can('offers.write');
  const items = useMemo(() => products.data?.items ?? [], [products.data]);
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  if (!shopId || products.isLoading) return <PageLoader />;
  if (products.isError) return <Alert tone="danger">{getErrorMessage(products.error)}</Alert>;
  const counts = products.data?.counts ?? {};
  const ids = [...selected];

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Mahsulotlar')}</h1><p>{t('Yagona katalogdagi modellar va sizning narxlaringiz.')}</p></div>
        {writable && (
          <div className="qs-page__actions">
            <Link to="/dokon/import" className="gm-button gm-button--secondary gm-button--md"><FileUp size={18} /> {t('Import')}</Link>
            <Button onClick={() => setAdding(true)}><Plus size={18} /> {t('Mahsulot qo‘shish')}</Button>
          </div>
        )}
      </div>
      <div className="qs-toolbar">
        <Input label={t('Qidirish')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t('Brend yoki model')} />
        <div className="qs-chips" role="group" aria-label={t('Holat')}>
          {(['', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as const).map((value) => (
            <button key={value || 'all'} type="button" className={cx('qs-chip', status === value && 'is-on')} onClick={() => { setStatus(value); setPage(1); }}>
              {value ? PRODUCT_STATUS[value].label : t('Hammasi')}
              {value && counts[value] !== undefined && <span>{counts[value]}</span>}
            </button>
          ))}
        </div>
      </div>
      {!items.length ? (
        <EmptyState icon={<Search size={30} />} title={t('Mahsulot topilmadi')} description={t('Katalogdan model qo‘shing yoki narxlar ro‘yxatini import qiling.')} action={writable && <Button onClick={() => setAdding(true)}>{t('Mahsulot qo‘shish')}</Button>} />
      ) : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead>
              <tr>
                {writable && <th aria-label={t('Tanlash')}><input type="checkbox" checked={items.every((item) => selected.has(item.id))} onChange={(e) => setSelected(e.target.checked ? new Set(items.map((item) => item.id)) : new Set())} /></th>}
                <th>{t('Model')}</th><th>{t('Narxlar (filiallar bo‘yicha)')}</th><th>{t('Holat')}</th><th>{t('Yangilangan')}</th>{writable && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                <tr key={product.id}>
                  {writable && <td><input type="checkbox" aria-label={`${product.productModel.brand} ${product.productModel.model}`} checked={selected.has(product.id)} onChange={() => toggle(product.id)} /></td>}
                  <td>
                    <div className="qs-cell-title">
                      <strong>{product.productModel.brand} {product.productModel.model}</strong>
                      <small>{i18nText(product.productModel.category.nameI18n)}</small>
                      {product.productModel.status === 'PENDING' && <Badge tone="warning">{t('Model tekshiruvda')}</Badge>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {product.offers.map((offer) => <OfferCell key={offer.id} shopId={shopId} product={product} offer={offer} writable={offersWritable} />)}
                      {!product.offers.length && <span className="qs-muted">{t('Narx yo‘q — mijozlarga «Narx so‘rov orqali»')}</span>}
                      {offersWritable && <Button size="sm" variant="ghost" onClick={() => setOfferFor(product)}><Plus size={14} /> {t('Narx')}</Button>}
                    </div>
                  </td>
                  <td><Badge tone={PRODUCT_STATUS[product.status].tone}>{PRODUCT_STATUS[product.status].label}</Badge></td>
                  <td className="qs-muted">{formatDate(product.updatedAt)}</td>
                  {writable && (
                    <td className="qs-right">
                      {product.status === 'ARCHIVED' || product.status === 'DRAFT' ? (
                        <Button size="sm" variant="secondary" disabled={product.productModel.status !== 'APPROVED'} onClick={() => bulk.mutate({ ids: [product.id], action: 'ACTIVATE' })}>{t('Faollashtirish')}</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => bulk.mutate({ ids: [product.id], action: 'ARCHIVE' })}>{t('Arxivlash')}</Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(products.data?.pages ?? 1) > 1 && (
        <div className="qs-page__actions" style={{ justifyContent: 'center' }}>
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Oldingi')}</Button>
          <span className="qs-muted">{page} / {products.data?.pages}</span>
          <Button size="sm" variant="ghost" disabled={page >= (products.data?.pages ?? 1)} onClick={() => setPage(page + 1)}>{t('Keyingi')}</Button>
        </div>
      )}
      {writable && ids.length > 0 && (
        <div className="qs-bulkbar" role="region" aria-label={t('Ommaviy amallar')}>
          <strong>{t('{n} ta tanlandi', { n: ids.length })}</strong>
          {offersWritable && (
            <>
              <input aria-label={t('Foiz')} placeholder="+5 / -10" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.,+-]/g, ''))} style={{ width: 90 }} />
              <Button size="sm" variant="secondary" loading={bulk.isPending} disabled={!Number(percent.replace(',', '.'))} onClick={() => bulk.mutate({ ids, action: 'PRICE_PERCENT', percent: Number(percent.replace(',', '.')) })}>{t('Narxni % ga o‘zgartirish')}</Button>
              <select aria-label={t('Zaxira holati')} defaultValue="" onChange={(e) => e.target.value && bulk.mutate({ ids, action: 'STOCK', stockStatus: e.target.value })}>
                <option value="" disabled>{t('Zaxira holati…')}</option>
                {(Object.keys(STOCK_STATUS) as StockStatus[]).map((value) => <option key={value} value={value}>{STOCK_STATUS[value].label}</option>)}
              </select>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={() => bulk.mutate({ ids, action: 'ARCHIVE' })}>{t('Arxivlash')}</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t('Bekor qilish')}</Button>
        </div>
      )}
      <AddProductModal shopId={shopId} open={adding} onClose={() => setAdding(false)} />
      <AddOfferModal key={offerFor?.id ?? 'none'} shopId={shopId} product={offerFor} onClose={() => setOfferFor(null)} />
    </div>
  );
}
