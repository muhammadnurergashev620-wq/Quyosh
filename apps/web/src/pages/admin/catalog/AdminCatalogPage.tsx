import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, RefreshCw } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { catalogService, type CategoryInput } from '@/features/catalog/catalog.service';
import { i18nText, SPEC_META, specValue } from '@/features/catalog/format';
import { SPEC_KEYS, type AdminModel, type Category, type ModelStatus, type SpecKey } from '@/features/catalog/types';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate, formatDateTime, formatDecimal, formatNumber } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Chip } from '@/components/ui/Chip';
import { Tab, TabBar } from '@/components/ui/Tabs';

const MODEL_STATUS: Record<ModelStatus, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  PENDING: { label: t('Tekshiruvda'), tone: 'warning' },
  APPROVED: { label: t('Tasdiqlangan'), tone: 'success' },
  REJECTED: { label: t('Rad etilgan'), tone: 'danger' },
  MERGED: { label: t('Birlashtirilgan'), tone: 'neutral' },
};

function useCatalogMutation<T>(fn: (vars: T) => Promise<unknown>, success: string, onDone?: () => void) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      pushToast(success, 'success');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'badges'] });
      onDone?.();
    },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
}

/** Modelni ko‘rib chiqish: xususiyatlarni tuzatish, tasdiqlash, rad etish yoki dublikatni birlashtirish. */
function ModelReview({ model, onClose }: { model: AdminModel; onClose: () => void }) {
  const [specs, setSpecs] = useState<Partial<Record<SpecKey, string>>>(() => Object.fromEntries(SPEC_KEYS.filter((key) => model[key] !== null && model[key] !== undefined).map((key) => [key, String(model[key])])));
  const [brand, setBrand] = useState(model.brand);
  const [name, setName] = useState(model.model);
  const [reason, setReason] = useState('');
  const [mergeQuery, setMergeQuery] = useState('');
  const [mergeTarget, setMergeTarget] = useState<AdminModel | null>(null);
  const candidates = useQuery({
    queryKey: ['admin', 'catalog', 'merge-search', mergeQuery],
    queryFn: () => catalogService.adminModels({ status: 'APPROVED', q: mergeQuery }),
    enabled: mergeQuery.trim().length >= 2,
  });
  const payload = () => ({
    brand: brand.trim(),
    model: name.trim(),
    ...Object.fromEntries(Object.entries(specs).filter(([, value]) => value !== '').map(([key, value]) => [key, key === 'batteryChemistry' ? value : Number(String(value).replace(',', '.'))])),
  });
  const save = useCatalogMutation((status?: 'APPROVED' | 'REJECTED') => catalogService.updateModel(model.id, { ...payload(), status, rejectReason: status === 'REJECTED' ? reason.trim() : undefined }), t('Saqlandi'), onClose);
  const merge = useCatalogMutation(() => catalogService.mergeModel(model.id, mergeTarget!.id), t('Modellar birlashtirildi'), onClose);
  const editable = model.status !== 'MERGED';
  const shown = SPEC_KEYS.filter((key) => specs[key] !== undefined || ['warrantyMonths'].includes(key));

  return (
    <div className="qs-form">
      <dl className="qs-dl">
        <dt>{t('Kategoriya')}</dt><dd>{i18nText(model.category.nameI18n)}</dd>
        <dt>{t('Taklif qilgan')}</dt><dd>{model.proposedByShop?.name ?? t('Admin')}</dd>
        <dt>{t('Do‘konlarda')}</dt><dd>{model._count.shopProducts}</dd>
        <dt>{t('Qo‘shilgan')}</dt><dd>{formatDateTime(model.createdAt)}</dd>
        {model.rejectReason && <><dt>{t('Rad etish sababi')}</dt><dd>{model.rejectReason}</dd></>}
      </dl>
      <div className="qs-form__row">
        <Input label={t('Brend')} value={brand} onChange={(e) => setBrand(e.target.value)} disabled={!editable} />
        <Input label={t('Model')} value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} />
      </div>
      <div className="qs-form__row">
        {shown.map((key) => (
          <Input key={key} label={`${SPEC_META[key].label}${SPEC_META[key].unit && key !== 'batteryUsableDod' ? `, ${SPEC_META[key].unit}` : ''}`} value={specs[key] ?? ''} onChange={(e) => setSpecs({ ...specs, [key]: e.target.value })} disabled={!editable} />
        ))}
      </div>
      <details>
        <summary>{t('Boshqa xususiyatni qo‘shish')}</summary>
        <div className="qs-chips qs-mt-2">
          {SPEC_KEYS.filter((key) => specs[key] === undefined && key !== 'warrantyMonths').map((key) => (
            <Chip key={key} onClick={() => setSpecs({ ...specs, [key]: '' })}>{SPEC_META[key].label}</Chip>
          ))}
        </div>
      </details>
      {editable && (
        <>
          <Textarea label={t('Rad etish sababi')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} hint={t('Faqat rad etishda majburiy — do‘kon ko‘radi')} />
          <div className="qs-form__actions">
            <Button variant="ghost" loading={save.isPending && save.variables === undefined} onClick={() => save.mutate(undefined)}>{t('Saqlash')}</Button>
            {model.status !== 'REJECTED' && <Button variant="danger" disabled={reason.trim().length < 3} loading={save.isPending && save.variables === 'REJECTED'} onClick={() => save.mutate('REJECTED')}>{t('Rad etish')}</Button>}
            {model.status !== 'APPROVED' && <Button loading={save.isPending && save.variables === 'APPROVED'} onClick={() => save.mutate('APPROVED')}>{t('Tasdiqlash')}</Button>}
          </div>
          <section className="qs-card qs-p-4">
            <strong>{t('Dublikatni birlashtirish')}</strong>
            <p className="qs-muted qs-m-0 qs-mt-1 qs-mb-2">{t('Bu model asosiy modelga qo‘shiladi; do‘kon mahsulotlari va narxlari ko‘chiriladi, eski havola yangisiga yo‘naltiriladi.')}</p>
            <Input label={t('Asosiy modelni qidirish')} value={mergeQuery} onChange={(e) => { setMergeQuery(e.target.value); setMergeTarget(null); }} />
            <ul className="qs-search-results qs-mt-2">
              {candidates.data?.items.filter((item) => item.id !== model.id).map((item) => (
                <li key={item.id}><Tab onClick={() => setMergeTarget(item)} selected={mergeTarget?.id === item.id}><span><strong>{item.brand} {item.model}</strong><small>{i18nText(item.category.nameI18n)}</small></span></Tab></li>
              ))}
            </ul>
            <div className="qs-form__actions qs-mt-2">
              <Button variant="secondary" disabled={!mergeTarget} loading={merge.isPending} onClick={() => merge.mutate(undefined)}>{t('Birlashtirish')}</Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ModelsTab() {
  const [status, setStatus] = useState<ModelStatus | undefined>('PENDING');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AdminModel | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [q]);
  const list = useQuery({ queryKey: ['admin', 'catalog', 'models', status, query, page], queryFn: () => catalogService.adminModels({ status, q: query || undefined, page }), placeholderData: keepPreviousData });
  if (list.isLoading) return <PageLoader />;
  if (list.isError || !list.data) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  return (
    <>
      <div className="qs-toolbar">
        <Input label={t('Qidirish')} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Brend yoki model')} />
        <div className="qs-chips">
          {(['PENDING', 'APPROVED', 'REJECTED', 'MERGED', undefined] as const).map((value) => (
            <Chip key={value ?? 'all'} onClick={() => { setStatus(value); setPage(1); }} selected={status === value}>
              {value ? MODEL_STATUS[value].label : t('Hammasi')}{value && <span>{list.data.counts[value] ?? 0}</span>}
            </Chip>
          ))}
        </div>
      </div>
      {!list.data.items.length ? <EmptyState icon={<Package size={30} />} title={status === 'PENDING' ? t('Tekshiruv navbati bo‘sh') : t('Model topilmadi')} /> : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Model')}</th><th>{t('Kategoriya')}</th><th>{t('Asosiy xususiyat')}</th><th>{t('Taklif qilgan')}</th><th>{t('Holat')}</th><th>{t('Sana')}</th></tr></thead>
            <tbody>
              {list.data.items.map((model) => {
                const key: SpecKey = model.nominalPowerW ? 'nominalPowerW' : model.inverterAcKw ? 'inverterAcKw' : 'batteryCapacityKwh';
                return (
                  <tr key={model.id} className="is-clickable" onClick={() => setOpen(model)}>
                    <td><div className="qs-cell-title"><strong>{model.brand} {model.model}</strong>{model.mergedInto && <small>→ {model.mergedInto.brand} {model.mergedInto.model}</small>}</div></td>
                    <td>{i18nText(model.category.nameI18n)}</td>
                    <td className="qs-num">{specValue(key, model[key])}</td>
                    <td>{model.proposedByShop?.name ?? '—'}</td>
                    <td><StatusBadge map={MODEL_STATUS} status={model.status} /></td>
                    <td className="qs-muted">{formatDate(model.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {list.data.pages > 1 && (
        <div className="qs-page__actions qs-justify-center">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Oldingi')}</Button>
          <span className="qs-muted">{page} / {list.data.pages}</span>
          <Button size="sm" variant="ghost" disabled={page >= list.data.pages} onClick={() => setPage(page + 1)}>{t('Keyingi')}</Button>
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.brand} ${open.model}` : ''} large>
        {open && <ModelReview key={open.id} model={open} onClose={() => setOpen(null)} />}
      </Modal>
    </>
  );
}

function CategoryForm({ initial, categories, onDone }: { initial?: Category; categories: Category[]; onDone: () => void }) {
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [uz, setUz] = useState(initial?.nameI18n.uz ?? '');
  const [oz, setOz] = useState(initial?.nameI18n.oz ?? '');
  const [ru, setRu] = useState(initial?.nameI18n.ru ?? '');
  const [parentId, setParentId] = useState(initial?.parentId ?? '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [schema, setSchema] = useState(JSON.stringify(initial?.attributeSchemaJson ?? [], null, 2));
  const [schemaError, setSchemaError] = useState('');
  const save = useCatalogMutation((input: CategoryInput) => (initial ? catalogService.updateCategory(initial.id, input) : catalogService.createCategory(input)), t('Saqlandi'), onDone);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    let attributeSchemaJson: CategoryInput['attributeSchemaJson'];
    try {
      const parsed: unknown = JSON.parse(schema || '[]');
      if (!Array.isArray(parsed)) throw new Error();
      attributeSchemaJson = parsed as CategoryInput['attributeSchemaJson'];
    } catch {
      return setSchemaError(t('Atributlar sxemasi JSON massiv bo‘lishi kerak'));
    }
    setSchemaError('');
    save.mutate({ slug: slug.trim(), nameI18n: { uz: uz.trim(), oz: oz.trim() || undefined, ru: ru.trim() || undefined }, parentId: parentId || null, sortOrder: Number(sortOrder) || 0, active, attributeSchemaJson });
  };
  return (
    <form className="qs-form" onSubmit={submit}>
      <div className="qs-form__row">
        <Input label={t('Nomi (lotin)')} value={uz} onChange={(e) => setUz(e.target.value)} required />
        <Input label={t('Nomi (kirill)')} value={oz} onChange={(e) => setOz(e.target.value)} />
        <Input label={t('Nomi (rus)')} value={ru} onChange={(e) => setRu(e.target.value)} />
      </div>
      <div className="qs-form__row">
        <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} required />
        <Select label={t('Ota kategoriya')} value={parentId} onChange={(e) => setParentId(e.target.value)} options={[{ value: '', label: t('Yo‘q (ildiz)') }, ...categories.filter((category) => category.id !== initial?.id).map((category) => ({ value: category.id, label: i18nText(category.nameI18n) }))]} />
        <Input label={t('Tartib')} inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/[^\d-]/g, ''))} />
      </div>
      <Textarea label={t('Atributlar sxemasi (JSON)')} value={schema} onChange={(e) => setSchema(e.target.value)} rows={8} className="qs-mono" error={schemaError || undefined} hint='[{"key":"nominalPowerW","type":"number","unit":"W","label":{"uz":"Quvvat"},"filter":"range"}]' />
      <label className="qs-check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t('Faol')}</label>
      <div className="qs-form__actions"><Button type="submit" loading={save.isPending}>{t('Saqlash')}</Button></div>
    </form>
  );
}

function CategoriesTab() {
  const list = useQuery({ queryKey: ['admin', 'catalog', 'categories'], queryFn: catalogService.adminCategories });
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const remove = useCatalogMutation((id: string) => catalogService.deleteCategory(id), t('Kategoriya o‘chirildi'));
  if (list.isLoading) return <PageLoader />;
  if (list.isError || !list.data) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  const flat = list.data.flatMap((category) => [category, ...category.children.map((child) => ({ ...child, depth: 1 }))]) as Array<Category & { depth?: number }>;
  return (
    <>
      <div className="qs-page__actions"><Button onClick={() => setEditing('new')}><Plus size={16} /> {t('Kategoriya qo‘shish')}</Button></div>
      <ul className="qs-list">
        {flat.map((category) => (
          <li key={category.id} style={{ marginLeft: category.depth ? 24 : 0 }}>
            <div><strong>{i18nText(category.nameI18n)}</strong><small>{category.slug} · {t('{n} ta model', { n: category.modelCount })} · {t('{n} ta atribut', { n: category.attributeSchemaJson?.length ?? 0 })}</small></div>
            {!category.active && <Badge>{t('Nofaol')}</Badge>}
            <span className="qs-page__actions">
              <Button size="sm" variant="secondary" onClick={() => setEditing(category)}>{t('Tahrirlash')}</Button>
              <Button size="sm" variant="ghost" disabled={category.modelCount > 0 || category.children.length > 0} onClick={() => remove.mutate(category.id)}>{t('O‘chirish')}</Button>
            </span>
          </li>
        ))}
      </ul>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('Yangi kategoriya') : t('Kategoriyani tahrirlash')} large>
        {editing && <CategoryForm initial={editing === 'new' ? undefined : editing} categories={list.data} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function RatesTab() {
  const rates = useQuery({ queryKey: ['admin', 'catalog', 'rates'], queryFn: catalogService.adminRates });
  const refresh = useCatalogMutation(() => catalogService.refreshRate(), t('Kurs yangilandi'));
  if (rates.isLoading) return <PageLoader />;
  if (rates.isError || !rates.data) return <Alert tone="danger">{getErrorMessage(rates.error)}</Alert>;
  const latest = rates.data.latest;
  return (
    <>
      <section className="qs-card">
        <header>
          <h2>{t('USD kursi (O‘zbekiston Respublikasi Markaziy banki)')}</h2>
          <Button variant="secondary" loading={refresh.isPending} onClick={() => refresh.mutate(undefined)}><RefreshCw size={16} /> {t('Yangilash')}</Button>
        </header>
        {latest ? (
          <p className="qs-stat-line">
            <span>1 USD = <b>{formatNumber(Number(latest.rateToUzs))}</b> {t('so‘m')}</span>
            <span>{t('Sana')}: <b>{latest.rateDate.split('-').reverse().join('.')}</b></span>
            {latest.stale && <Badge tone="warning">{t('Kurs eskirgan')}</Badge>}
          </p>
        ) : <Alert tone="warning">{t('Kurs hali olinmagan')}</Alert>}
        <p className="qs-muted qs-mb-0">{t('Har kuni 09:30 (Toshkent) avtomatik yangilanadi; muvaffaqiyatsiz bo‘lsa oxirgi kurs ishlatiladi.')}</p>
      </section>
      <div className="qs-table-wrap">
        <table className="qs-table">
          <thead><tr><th>{t('Sana')}</th><th className="qs-right">{t('Kurs')}</th><th>{t('Olingan vaqt')}</th></tr></thead>
          <tbody>
            {rates.data.history.map((row) => (
              <tr key={row.id}><td>{row.rateDate.slice(0, 10).split('-').reverse().join('.')}</td><td className="qs-right qs-num">{formatDecimal(Number(row.rateToUzs), 2)}</td><td className="qs-muted">{formatDateTime(row.fetchedAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** U12.4: katalog moderatsiyasi, kategoriyalar va valyuta kurslari. */
export function AdminCatalogPage() {
  const [tab, setTab] = useState<'models' | 'categories' | 'rates'>('models');
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Katalog moderatsiyasi')}</h1><p>{t('Yagona uskuna katalogi: do‘konlar taklif qilgan modellar, kategoriyalar va kurs.')}</p></div></div>
      <TabBar variant="tabs" role="tablist">
        {([['models', t('Modellar')], ['categories', t('Kategoriyalar')], ['rates', t('Valyuta kursi')]] as const).map(([key, label]) => (
          <Tab key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} selected={tab === key}>{label}</Tab>
        ))}
      </TabBar>
      {tab === 'models' && <ModelsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'rates' && <RatesTab />}
    </div>
  );
}
