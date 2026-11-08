import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BadgeCheck, MapPin, Phone, Star } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonAnchor, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { publicShopsService, type PublicShopProfile } from '@/features/catalog/public-shops.service';
import { i18nText, keySpecs, sum } from '@/features/catalog/format';
import { PRICING_MODEL, SERVICE_TYPE, STOCK_STATUS, WEEKDAYS } from '@/features/shop/labels';
import { getErrorMessage } from '@/lib/error-messages';
import { regionName } from '@/lib/regions';
import { cx } from '@/lib/utils';
import { formatNumber, formatRating } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import { rememberReturnTo } from '@/lib/return-to';
import { ShopLogo } from './ShopsPage';
import { FavoriteButton, PublicShopReviews } from '@/pages/deals/MiscDealsPages';
import { t } from '@/i18n';
import { m7Service } from '@/features/m7/m7.service';
import { track } from '@/features/m7/track';
import { CERT_TYPE } from '@/pages/m7/cert-labels';
import { kw as kwLabel } from '@/features/calc/labels';
import '@/features/shop/shop.css';
import '@/features/catalog/catalog.css';
import '@/features/m7/m7.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tab, TabBar } from '@/components/ui/Tabs';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Hozir ochiqmi (Toshkent vaqti bo‘yicha). */
export function openNow(hours: Partial<Record<string, Array<[string, string]>>> | null, now = new Date()): boolean | null {
  if (!hours) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((part) => [part.type, part.value]));
  const day = DAY_KEYS[['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday ?? '')];
  const time = `${parts.hour}:${parts.minute}`;
  return !!day && !!hours[day]?.some(([from, to]) => time >= from && time < to);
}

function priceText(service: PublicShopProfile['services'][number]) {
  if (service.pricingModel === 'QUOTE_REQUIRED' || !service.price) return PRICING_MODEL.QUOTE_REQUIRED;
  const money = service.currency === 'USD' ? `${formatNumber(Number(service.price))} $` : sum(service.price);
  if (service.pricingModel === 'FROM') return t('{price} dan', { price: money });
  if (service.pricingModel === 'PER_KW') return t('{price} / kW', { price: money });
  if (service.pricingModel === 'PER_UNIT') return t('{price} / dona', { price: money });
  return money;
}

type Tab = 'overview' | 'services' | 'products' | 'portfolio';

/** U7.4: do‘kon profili — umumiy (sharhlar), xizmatlar va narxlar, mahsulotlar, portfolio; sertifikat belgilari. */
export function ShopProfilePage() {
  const { slug = '' } = useParams();
  const hasSession = useAuthStore((s) => s.hasSession);
  const [tab, setTab] = useState<Tab>('overview');
  const [page, setPage] = useState(1);
  const profile = useQuery({ queryKey: ['public', 'shop', slug], queryFn: () => publicShopsService.profile(slug) });
  const products = useQuery({ queryKey: ['public', 'shop', slug, 'products', page], queryFn: () => publicShopsService.products(slug, page), enabled: tab === 'products' && !!profile.data });
  const contact = useMutation({ mutationFn: () => publicShopsService.contact(slug) });
  const projects = useQuery({ queryKey: ['public', 'shop', slug, 'projects'], queryFn: () => m7Service.publicProjects(slug), enabled: tab === 'portfolio' && !!profile.data });
  useEffect(() => { if (profile.data) track({ eventType: 'shop_view', shopId: profile.data.id }, `shop-${profile.data.id}`); }, [profile.data]);

  if (profile.isLoading) return <PageLoader />;
  if (profile.isError || !profile.data) return <Alert tone="danger">{getErrorMessage(profile.error)}</Alert>;
  const shop = profile.data;
  const open = shop.branches.map((branch) => openNow(branch.openingHoursJson)).find((value) => value !== null) ?? null;

  return (
    <div className="qs-page">
      <section className="qs-shop-hero">
        <div className="qs-shop-hero__cover" aria-hidden="true" />
        <div className="qs-shop-hero__info">
          <ShopLogo name={shop.name} />
          <div>
            <h1>{shop.name}</h1>
            <div className="qs-page__actions">
              <Badge tone="success"><BadgeCheck size={13} /> {t('Tasdiqlangan do‘kon')}</Badge>
              {(shop as { certifications?: Array<{ certType: keyof typeof CERT_TYPE; brand: string | null }> }).certifications?.map((c, i) => <Badge key={i} tone="primary"><BadgeCheck size={13} /> {CERT_TYPE[c.certType]}{c.brand ? ` · ${c.brand}` : ''}</Badge>)}
              <span className="qs-rating"><Star size={14} aria-hidden="true" /> {formatRating(shop.ratingAvg)} <small className="qs-muted">({t('{n} ta sharh', { n: shop.ratingCount })})</small></span>
              {open !== null && <span className={cx('qs-open', open ? 'is-open' : 'is-closed')}>{open ? t('Hozir ochiq') : t('Hozir yopiq')}</span>}
            </div>
          </div>
          <div className="qs-page__actions">
            {contact.data ? (
              <ButtonAnchor variant="secondary" href={`tel:${contact.data.phone}`}><Phone size={16} /> {contact.data.phone}</ButtonAnchor>
            ) : hasSession ? (
              <Button variant="secondary" loading={contact.isPending} onClick={() => contact.mutate()}><Phone size={16} /> {shop.phoneMasked ?? t('Telefon')}</Button>
            ) : (
              <ButtonLink variant="secondary" to="/login" onClick={() => rememberReturnTo(`/mijoz/dokonlar/${slug}`)} title={t('Raqamni ko‘rish uchun kiring')}><Phone size={16} /> {shop.phoneMasked}</ButtonLink>
            )}
            {hasSession && <FavoriteButton shopId={shop.id} />}
            <ButtonLink to={`/mijoz/sorovlar?yangi=1&dokon=${shop.id}`} onClick={() => !hasSession && rememberReturnTo(`/mijoz/sorovlar?yangi=1&dokon=${shop.id}`)}>{t('Taklif so‘rash')}</ButtonLink>
          </div>
        </div>
      </section>
      {!hasSession && shop.phoneMasked && <p className="qs-muted qs-m-0">{t('Raqamni ko‘rish uchun kiring')}</p>}

      <TabBar variant="tabs" role="tablist">
        {([['overview', t('Umumiy')], ['services', t('Xizmatlar va narxlar')], ['products', t('Mahsulotlar ({n})', { n: shop.productCount })], ['portfolio', t('Portfolio')]] as const).map(([key, label]) => (
          <Tab key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} selected={tab === key}>{label}</Tab>
        ))}
      </TabBar>

      {tab === 'overview' && (
        <div className="qs-grid-2">
          <section className="qs-card">
            <h2>{t('Do‘kon haqida')}</h2>
            <p className="qs-pre-line qs-m-0">{shop.description || t('Tavsif qo‘shilmagan.')}</p>
          </section>
          <section className="qs-card">
            <h2>{t('Filiallar')}</h2>
            <ul className="qs-list">
              {shop.branches.map((branch) => {
                const isOpen = openNow(branch.openingHoursJson);
                return (
                  <li key={branch.id}>
                    <div>
                      <strong>{branch.name}</strong>
                      <small><MapPin size={12} aria-hidden="true" /> {[regionName(branch.regionCode), branch.address].filter(Boolean).join(' · ')}</small>
                      <small>{WEEKDAYS.filter((day) => branch.openingHoursJson?.[day.key]?.length).map((day) => `${day.label.slice(0, 2)} ${branch.openingHoursJson![day.key]![0]!.join('–')}`).join(' · ') || t('Ish vaqti ko‘rsatilmagan')}</small>
                    </div>
                    {isOpen !== null && <span className={cx('qs-open', isOpen ? 'is-open' : 'is-closed')}>{isOpen ? t('Ochiq') : t('Yopiq')}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
      {tab === 'overview' && <PublicShopReviews slug={shop.slug} shopName={shop.name} />}

      {tab === 'services' && (!shop.services.length ? <EmptyState title={t('Xizmatlar ko‘rsatilmagan')} /> : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Xizmat')}</th><th>{t('Narx')}</th><th>{t('Kafolat')}</th></tr></thead>
            <tbody>
              {shop.services.map((service) => (
                <tr key={service.id}>
                  <td><div className="qs-cell-title"><strong>{SERVICE_TYPE[service.serviceType]}</strong>{service.descriptionI18n && <small>{i18nText(service.descriptionI18n as { uz: string })}</small>}</div></td>
                  <td className="qs-num">{priceText(service)}</td>
                  <td>{service.warrantyMonths != null ? t('{n} oy', { n: service.warrantyMonths }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {tab === 'portfolio' && (projects.isLoading ? <PageLoader /> : !projects.data?.length ? <EmptyState title={t('Loyihalar qo‘shilmagan')} /> : (
        <div className="qs-projects">
          {projects.data.map((p) => (
            <article key={p.id} className="qs-project">
              {p.images[0]?.url ? <img src={p.images[0].url} alt={p.title} loading="lazy" /> : <div style={{ aspectRatio: '4 / 3', background: 'var(--qs-color-surface-muted)' }} />}
              <div>
                <strong>{p.title}</strong>
                <small className="qs-muted">{[p.city, p.systemPowerKw ? kwLabel(Number(p.systemPowerKw)) : null, p.completedAt ? p.completedAt.slice(0, 7) : null].filter(Boolean).join(' · ')}</small>
                {p.verifiedInstallation && <Badge tone="success"><BadgeCheck size={12} /> {t('Tasdiqlangan montaj')}</Badge>}
                {p.description && <p className="qs-m-0 qs-fs-13">{p.description}</p>}
              </div>
            </article>
          ))}
        </div>
      ))}
      {tab === 'products' && (products.isLoading ? <PageLoader /> : !products.data?.items.length ? <EmptyState title={t('Mahsulot qo‘shilmagan')} /> : (
        <>
          <div className="qs-table-wrap">
            <table className="qs-table">
              <thead><tr><th>{t('Model')}</th><th>{t('Narx')}</th><th>{t('Mavjudlik')}</th></tr></thead>
              <tbody>
                {products.data.items.map((product) => {
                  const best = product.offers[0];
                  return (
                    <tr key={product.id}>
                      <td><div className="qs-cell-title"><Link to={`/mijoz/mahsulotlar/${product.productModel.slug}`}><strong>{product.productModel.brand} {product.productModel.model}</strong></Link><small>{i18nText(product.productModel.category.nameI18n)} · {keySpecs(product.productModel).slice(0, 2).join(' · ')}</small></div></td>
                      <td className="qs-num">{best ? (best.currency === 'USD' ? `${formatNumber(Number(best.price))} $` : sum(best.price)) : t('So‘rov orqali')}</td>
                      <td>{best ? <StatusBadge map={STOCK_STATUS} status={best.stockStatus} /> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {products.data.pages > 1 && (
            <div className="qs-page__actions qs-justify-center">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Oldingi')}</Button>
              <span className="qs-muted">{page} / {products.data.pages}</span>
              <Button size="sm" variant="ghost" disabled={page >= products.data.pages} onClick={() => setPage(page + 1)}>{t('Keyingi')}</Button>
            </div>
          )}
        </>
      ))}
    </div>
  );
}
