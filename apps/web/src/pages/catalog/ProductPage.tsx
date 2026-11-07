import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Store } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { catalogService } from '@/features/catalog/catalog.service';
import { useCompare } from '@/features/catalog/compare-store';
import { i18nText, priceWithRate, SPEC_META, specValue } from '@/features/catalog/format';
import { SPEC_KEYS, type SpecKey } from '@/features/catalog/types';
import { mediaService } from '@/features/media/services/media.service';
import { STOCK_STATUS } from '@/features/shop/labels';
import { getErrorMessage } from '@/lib/error-messages';
import { REGIONS, regionName } from '@/lib/regions';
import { formatDate } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import { CategoryGlyph, CompareBar } from './CatalogParts';
import { t } from '@/i18n';
import { track } from '@/features/m7/track';
import '@/features/shop/shop.css';
import '@/features/catalog/catalog.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SelectMenu } from '@/components/ui/SelectMenu';

/** U7.5: mahsulot sahifasi — xususiyatlar, datasheet va «Bu modelni sotayotgan do‘konlar». */
export function ProductPage() {
  const { slug = '' } = useParams();
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState<'price' | 'updated'>('price');
  const compare = useCompare();
  const pushToast = useAppStore((s) => s.pushToast);
  const model = useQuery({ queryKey: ['catalog', 'model', slug], queryFn: () => catalogService.model(slug) });
  const offers = useQuery({ queryKey: ['catalog', 'offers', slug, region, sort], queryFn: () => catalogService.offers(slug, { region: region || undefined, sort }), enabled: !!model.data && !model.data.redirectSlug });
  // Mahsulot ko‘rishi: umumiy funnel uchun va har taklif bergan do‘kon analitikasi uchun (U11.14).
  useEffect(() => {
    const m = model.data as { id?: string } | undefined;
    if (!m?.id || !offers.data) return;
    track({ eventType: 'product_view', entityId: m.id }, `pv-${m.id}`);
    for (const shopId of [...new Set(offers.data.items.map((o) => o.shop.id))].slice(0, 10)) track({ eventType: 'product_view', entityId: m.id, shopId }, `pv-${m.id}-${shopId}`);
  }, [model.data, offers.data]);

  if (model.isLoading) return <PageLoader />;
  if (model.isError || !model.data) return <Alert tone="danger">{getErrorMessage(model.error)}</Alert>;
  if (model.data.redirectSlug) return <Navigate to={`/mijoz/mahsulotlar/${model.data.redirectSlug}`} replace />;
  const data = model.data;
  const schemaKeys = (data.category.attributeSchemaJson ?? []).map((attr) => attr.key).filter((key): key is SpecKey => (SPEC_KEYS as readonly string[]).includes(key));
  const keys = [...new Set<SpecKey>([...schemaKeys, ...SPEC_KEYS.filter((key) => data[key] !== null && data[key] !== undefined)])].filter((key) => data[key] !== null && data[key] !== undefined);
  const inCompare = compare.items.some((item) => item.id === data.id);

  return (
    <div className="qs-page">
      <Link to={`/mijoz/mahsulotlar?kategoriya=${data.category.slug}`} className="qs-muted" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={16} /> {i18nText(data.category.nameI18n)}</Link>
      <div className="qs-product">
        <div className="qs-form">
          <div className="qs-product__gallery"><CategoryGlyph slug={data.category.slug} size={120} /></div>
          <section className="qs-card">
            <h2>{t('Xususiyatlar')}</h2>
            <table className="qs-specs">
              <tbody>
                {keys.map((key) => <tr key={key}><th scope="row">{SPEC_META[key].label}</th><td className="qs-num">{specValue(key, data[key])}</td></tr>)}
              </tbody>
            </table>
            {data.datasheetFileId && (
              <Button variant="secondary" size="sm" style={{ marginTop: 12 }} onClick={() => void mediaService.getSignedUrl(data.datasheetFileId!, 'original').then((result) => window.open(result.url, '_blank', 'noopener'))}>
                <FileText size={16} /> {t('Datasheet (PDF)')}
              </Button>
            )}
          </section>
        </div>
        <div className="qs-form">
          <div>
            <span className="qs-pcard__brand">{data.brand}</span>
            <h1 style={{ margin: '4px 0 8px', fontFamily: 'var(--qs-font-display)' }}>{data.model}</h1>
            <div className="qs-page__actions">
              <Button variant={inCompare ? 'secondary' : 'ghost'} size="sm" onClick={() => { if (!compare.toggle({ id: data.id, slug: data.slug, label: `${data.brand} ${data.model}` })) pushToast(t('Bir vaqtda 4 tagacha mahsulot solishtiriladi'), 'info'); }}>
                {inCompare ? t('Solishtirishda ✓') : t('Solishtirishga qo‘shish')}
              </Button>
            </div>
          </div>
          <section className="qs-card">
            <header>
              <h2>{t('Bu modelni sotayotgan do‘konlar')}</h2>
            </header>
            <div className="qs-form__row" style={{ marginBottom: 12 }}>
              <SelectMenu className="qs-select" aria-label={t('Hudud')} value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">{t('Barcha hududlar')}</option>
                {REGIONS.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </SelectMenu>
              <SelectMenu className="qs-select" aria-label={t('Saralash')} value={sort} onChange={(e) => setSort(e.target.value as 'price' | 'updated')}>
                <option value="price">{t('Narx bo‘yicha')}</option>
                <option value="updated">{t('Yangilangan sana bo‘yicha')}</option>
              </SelectMenu>
            </div>
            {offers.isLoading ? <PageLoader /> : !offers.data?.items.length ? (
              <EmptyState icon={<Store size={28} />} title={t('Hozircha taklif yo‘q')} description={t('Bu model hozircha do‘konlar katalogida yo‘q. Taklif so‘rovida do‘kondan shu modelni so‘rashingiz mumkin.')} />
            ) : (
              <div className="qs-form" style={{ gap: 8 }}>
                {offers.data.items.map((offer) => {
                  const price = priceWithRate(offer.price, offer.currency, offer.priceUzs, offers.data.rate);
                  return (
                    <div key={offer.id} className="qs-offer">
                      <span><Link to={`/mijoz/dokonlar/${offer.shop.slug}`}><b>{offer.shop.name}</b></Link></span>
                      <strong>{price.main}</strong>
                      <small>{[offer.branch?.name, regionName(offer.branch?.regionCode)].filter(Boolean).join(' · ') || t('Barcha filiallar')}</small>
                      <small style={{ textAlign: 'right' }}>{price.note ?? (offer.vatIncluded ? t('QQS bilan') : t('QQSsiz'))}</small>
                      <small><StatusBadge map={STOCK_STATUS} status={offer.stockStatus} /></small>
                      <small style={{ textAlign: 'right' }}>{t('Yangilangan: {date}', { date: formatDate(offer.updatedAt) })}</small>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="qs-muted" style={{ marginBottom: 0, fontSize: 13 }}>{t('Yakuniy narx do‘kon taklifida tasdiqlanadi. Masofa bo‘yicha saralash xarita bilan qo‘shiladi.')}</p>
          </section>
        </div>
      </div>
      <CompareBar />
    </div>
  );
}
