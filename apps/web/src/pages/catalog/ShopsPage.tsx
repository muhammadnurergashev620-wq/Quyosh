import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { BadgeCheck, MapPin, Star, Store } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { publicShopsService, type PublicShopCard } from '@/features/catalog/public-shops.service';
import { SERVICE_TYPE } from '@/features/shop/labels';
import type { ServiceType } from '@/features/shop/types';
import { getErrorMessage } from '@/lib/error-messages';
import { REGIONS, regionName } from '@/lib/regions';
import { t } from '@/i18n';
import { CERT_TYPE } from '@/pages/m7/cert-labels';
import '@/features/shop/shop.css';
import '@/features/catalog/catalog.css';
import { formatRating } from '@/lib/format';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Chip } from '@/components/ui/Chip';

export function ShopLogo({ name }: { name: string }) {
  return <span className="qs-shopcard__logo" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>;
}

function ShopCard({ shop }: { shop: PublicShopCard }) {
  const regions = [...new Set(shop.branches.map((branch) => regionName(branch.regionCode)).filter(Boolean))];
  return (
    <Link to={`/mijoz/dokonlar/${shop.slug}`} className="qs-shopcard">
      <header>
        <ShopLogo name={shop.name} />
        <div className="qs-cell-title">
          <strong>{shop.name} <BadgeCheck size={16} color="var(--qs-color-success)" aria-label={t('Tasdiqlangan do‘kon')} /></strong>
          <span className="qs-rating"><Star size={14} aria-hidden="true" /> {formatRating(shop.ratingAvg)} <small className="qs-muted">({shop.ratingCount})</small></span>
        </div>
      </header>
      {shop.description && <p>{shop.description}</p>}
      {regions.length > 0 && <small className="qs-muted"><MapPin size={13} aria-hidden="true" /> {regions.join(', ')}</small>}
      {!!shop.certifications?.length && <div className="qs-chips">{shop.certifications.map((c, i) => <Chip key={i} selected><BadgeCheck size={12} /> {CERT_TYPE[c.certType]}{c.brand ? ` · ${c.brand}` : ''}</Chip>)}</div>}
      <div className="qs-chips">
        {shop.serviceTypes.slice(0, 4).map((type) => <Chip key={type}>{SERVICE_TYPE[type]}</Chip>)}
        {shop.productCount > 0 && <Chip>{t('{n} ta mahsulot', { n: shop.productCount })}</Chip>}
      </div>
    </Link>
  );
}

/** U7.4: do‘konlar ro‘yxati. Masofa va xarita — M3. */
export function ShopsPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [service, setService] = useState<ServiceType | ''>('');
  const [region, setRegion] = useState('');
  const [cert, setCert] = useState('');
  const [sort, setSort] = useState('rating');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useInfiniteQuery({
    queryKey: ['public', 'shops', query, service, region, sort, cert],
    queryFn: ({ pageParam }) => publicShopsService.list({ search: query || undefined, service: service || undefined, region: region || undefined, sort, cursor: pageParam, cert: cert || undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const shops = list.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Do‘konlar')}</h1><p>{t('Tasdiqlangan sotuvchi va montajchilar.')}</p></div></div>
      <div className="qs-toolbar">
        <Input label={t('Qidirish')} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Do‘kon nomi')} />
        <SelectMenu className="qs-select" aria-label={t('Hudud')} value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">{t('Barcha hududlar')}</option>
          {REGIONS.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </SelectMenu>
        <SelectMenu className="qs-select" aria-label={t('Sertifikat')} value={cert} onChange={(e) => setCert(e.target.value)}>
          <option value="">{t('Barcha do‘konlar')}</option>
          {Object.entries(CERT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectMenu>
        <SelectMenu className="qs-select" aria-label={t('Saralash')} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="rating">{t('Reyting bo‘yicha')}</option>
          <option value="new">{t('Yangilari')}</option>
          <option value="name">{t('Nomi bo‘yicha')}</option>
        </SelectMenu>
      </div>
      <div className="qs-chips">
        <Chip onClick={() => setService('')} selected={!service}>{t('Barcha xizmatlar')}</Chip>
        {(Object.keys(SERVICE_TYPE) as ServiceType[]).map((type) => (
          <Chip key={type} onClick={() => setService(type)} selected={service === type}>{SERVICE_TYPE[type]}</Chip>
        ))}
      </div>
      {list.isLoading ? <PageLoader /> : list.isError ? <Alert tone="danger">{getErrorMessage(list.error)}</Alert> : !shops.length ? (
        <EmptyState icon={<Store size={30} />} title={t('Do‘kon topilmadi')} />
      ) : (
        <div className="qs-shops">{shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}</div>
      )}
      {list.hasNextPage && <div className="qs-page__actions qs-justify-center"><Button variant="secondary" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{t('Yana ko‘rsatish')}</Button></div>}
    </div>
  );
}
