import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, SearchX } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { catalogService, type CatalogFilters } from '@/features/catalog/catalog.service';
import { i18nText } from '@/features/catalog/format';
import type { Category } from '@/features/catalog/types';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import { CompareBar, ProductCard } from './CatalogParts';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/catalog/catalog.css';
import { SelectMenu } from '@/components/ui/SelectMenu';

const SORTS = [
  { value: 'offers', label: t('Tavsiya etilgan') },
  { value: 'price', label: t('Arzonroq') },
  { value: '-price', label: t('Qimmatroq') },
  { value: '-power', label: t('Quvvat bo‘yicha') },
  { value: 'new', label: t('Yangilari') },
];

const num = (value: string | null) => (value && Number.isFinite(Number(value)) ? Number(value) : undefined);

/** U7.5: katalog — chap filtr (280 px), grid, solishtirish paneli. Filtrlar manzil qatorida (ulashsa bo‘ladi). */
export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters: CatalogFilters = {
    categorySlug: params.get('kategoriya') ?? undefined,
    brand: params.get('brend') ?? undefined,
    q: params.get('q') ?? undefined,
    minPowerW: num(params.get('minW')),
    maxPowerW: num(params.get('maxW')),
    minPrice: num(params.get('minNarx')),
    maxPrice: num(params.get('maxNarx')),
    stock: params.get('mavjud') === '1' ? 'IN_STOCK' : undefined,
    sort: params.get('saralash') ?? 'offers',
    page: num(params.get('sahifa')) ?? 1,
  };
  const set = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'sahifa') next.delete('sahifa');
    setParams(next, { replace: true });
  };
  const categories = useQuery({ queryKey: ['catalog', 'categories'], queryFn: catalogService.categories, staleTime: 5 * 60_000 });
  const category = useMemo(() => {
    const flat: Category[] = (categories.data ?? []).flatMap((item) => [item, ...item.children]);
    return flat.find((item) => item.slug === filters.categorySlug);
  }, [categories.data, filters.categorySlug]);
  const brands = useQuery({ queryKey: ['catalog', 'brands', category?.id], queryFn: () => catalogService.brands(category?.id), staleTime: 60_000 });
  const models = useQuery({ queryKey: ['catalog', 'models', filters], queryFn: () => catalogService.models(filters), placeholderData: keepPreviousData });
  const showPower = !category || category.slug === 'quyosh-panellari';

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div>
          <h1>{category ? i18nText(category.nameI18n) : t('Mahsulotlar')}</h1>
          <p>{t('Yagona uskuna katalogi: bir model — bir sahifa, barcha do‘konlar narxi bilan.')}</p>
        </div>
      </div>
      <div className="qs-catalog">
        <aside className={cx('qs-catalog__filters', filtersOpen && 'is-open')} aria-label={t('Filtrlar')}>
          <div>
            <h3>{t('Kategoriya')}</h3>
            <ul className="qs-catalog__cats">
              <li><button type="button" className={cx(!filters.categorySlug && 'is-on')} onClick={() => set('kategoriya', undefined)}>{t('Hammasi')}</button></li>
              {(categories.data ?? []).map((item) => (
                <li key={item.id}>
                  <button type="button" className={cx(item.slug === filters.categorySlug && 'is-on')} onClick={() => { set('kategoriya', item.slug); }}>
                    {i18nText(item.nameI18n)} <small>{item.modelCount}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {!!brands.data?.length && (
            <div>
              <h3>{t('Brend')}</h3>
              <SelectMenu aria-label={t('Brend')} value={filters.brand ?? ''} onChange={(e) => set('brend', e.target.value || undefined)}>
                <option value="">{t('Barcha brendlar')}</option>
                {brands.data.map((item) => <option key={item.brand} value={item.brand}>{item.brand} ({item.count})</option>)}
              </SelectMenu>
            </div>
          )}
          {showPower && (
            <div>
              <h3>{t('Panel quvvati, W')}</h3>
              <div className="qs-range">
                <input aria-label={t('dan')} placeholder={t('dan')} inputMode="numeric" defaultValue={filters.minPowerW ?? ''} onBlur={(e) => set('minW', e.target.value.replace(/\D/g, '') || undefined)} />
                <input aria-label={t('gacha')} placeholder={t('gacha')} inputMode="numeric" defaultValue={filters.maxPowerW ?? ''} onBlur={(e) => set('maxW', e.target.value.replace(/\D/g, '') || undefined)} />
              </div>
            </div>
          )}
          <div>
            <h3>{t('Narx, so‘m')}</h3>
            <div className="qs-range">
              <input aria-label={t('dan')} placeholder={t('dan')} inputMode="numeric" defaultValue={filters.minPrice ?? ''} onBlur={(e) => set('minNarx', e.target.value.replace(/\D/g, '') || undefined)} />
              <input aria-label={t('gacha')} placeholder={t('gacha')} inputMode="numeric" defaultValue={filters.maxPrice ?? ''} onBlur={(e) => set('maxNarx', e.target.value.replace(/\D/g, '') || undefined)} />
            </div>
          </div>
          <label className="qs-check"><input type="checkbox" checked={filters.stock === 'IN_STOCK'} onChange={(e) => set('mavjud', e.target.checked ? '1' : undefined)} /> {t('Faqat mavjudlari')}</label>
          {[...params.keys()].some((key) => key !== 'saralash') && <Button size="sm" variant="ghost" onClick={() => setParams(new URLSearchParams(), { replace: true })}>{t('Filtrlarni tozalash')}</Button>}
        </aside>
        <section>
          <div className="qs-catalog__bar">
            <Button size="sm" variant="secondary" className="qs-catalog__filter-btn" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={16} /> {t('Filtrlar')}</Button>
            <Input label={t('Qidirish')} value={params.get('q') ?? ''} onChange={(e) => set('q', e.target.value || undefined)} placeholder={t('Brend yoki model')} />
            <span>{models.data ? t('{n} ta model', { n: formatNumber(models.data.total) }) : ''}</span>
            <SelectMenu aria-label={t('Saralash')} value={filters.sort} onChange={(e) => set('saralash', e.target.value)}>
              {SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
            </SelectMenu>
          </div>
          {models.data?.rate?.stale && <Alert tone="warning">{t('Valyuta kursi eskirgan bo‘lishi mumkin ({date}).', { date: models.data.rate.rateDate })}</Alert>}
          {models.isLoading ? (
            <div className="qs-products">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="qs-pcard" style={{ height: 320 }} />)}</div>
          ) : models.isError || !models.data ? (
            <Alert tone="danger">{getErrorMessage(models.error)}</Alert>
          ) : !models.data.items.length ? (
            <EmptyState icon={<SearchX size={30} />} title={t('Mos mahsulot topilmadi')} description={t('Filtrlarni yumshatib ko‘ring.')} />
          ) : (
            <div className="qs-products">{models.data.items.map((item) => <ProductCard key={item.id} item={item} />)}</div>
          )}
          {models.data && models.data.pages > 1 && (
            <div className="qs-page__actions" style={{ justifyContent: 'center', marginTop: 16 }}>
              <Button size="sm" variant="ghost" disabled={(filters.page ?? 1) <= 1} onClick={() => set('sahifa', String((filters.page ?? 1) - 1))}>{t('Oldingi')}</Button>
              <span className="qs-muted">{filters.page} / {models.data.pages}</span>
              <Button size="sm" variant="ghost" disabled={(filters.page ?? 1) >= models.data.pages} onClick={() => set('sahifa', String((filters.page ?? 1) + 1))}>{t('Keyingi')}</Button>
            </div>
          )}
          <CompareBar />
        </section>
      </div>
    </div>
  );
}
