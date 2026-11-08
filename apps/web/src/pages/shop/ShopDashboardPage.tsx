import { ButtonLink } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { PageLoader } from '@/components/common/PageLoader';
import { useCurrentShop } from '@/features/shop/current-shop';
import { useManagedShop } from '@/features/shop/hooks';
import { SHOP_STATUS } from '@/features/shop/labels';
import { ShopSwitcher } from '@/features/shop/components/ShopSwitcher';
import type { ManagedShop } from '@/features/shop/types';
import { getErrorMessage } from '@/lib/error-messages';
import { formatNumber, formatRating } from '@/lib/format';
import { t } from '@/i18n';
import { ShopKpis } from '@/pages/m7/ShopM7Pages';
import '@/features/shop/shop.css';
import { StatusBadge } from '@/components/ui/StatusBadge';

const CHECKLIST: Record<ManagedShop['checklist'][number]['key'], { label: string; to: string }> = {
  profile: { label: t('Logo va tavsif'), to: '/dokon/profil' },
  branch: { label: t('Birinchi filial'), to: '/dokon/filiallar' },
  serviceArea: { label: t('Xizmat hududi'), to: '/dokon/filiallar' },
  products: { label: t('Birinchi mahsulotlar'), to: '/dokon/katalog' },
};

/** U11.2: holat, KPI (30 kun), «Bugun javob bering», profil to‘liqligi va tezkor amallar. */
export function ShopDashboardPage() {
  const { shop: current, isLoading, can } = useCurrentShop();
  const managed = useManagedShop(current?.id ?? null);
  if (isLoading || managed.isLoading) return <PageLoader />;
  if (!current) return <Alert tone="info" title={t('Do‘kon topilmadi')}>{t('Hisobingiz hali do‘konga biriktirilmagan. Administratorga murojaat qiling.')}</Alert>;
  if (managed.isError || !managed.data) return <Alert tone="danger">{getErrorMessage(managed.error)}</Alert>;
  const shop = managed.data;
  const isOwner = shop.membership.memberRole === 'OWNER';

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div>
          <h1>{shop.name}</h1>
          <p>{t('Do‘kon boshqaruv paneli')}</p>
        </div>
        <div className="qs-page__actions">
          <ShopSwitcher />
          <StatusBadge map={SHOP_STATUS} status={shop.status} />
        </div>
      </div>

      <ShopKpis shopId={shop.id} />

      <div className="qs-grid-2">
        <section className="qs-card">
          <header><h2>{t('Profil to‘liqligi')}</h2></header>
          <div className="qs-flex qs-gap-5 qs-items-center qs-wrap">
            <div className="qs-ring" style={{ ['--value' as string]: shop.completeness }} role="img" aria-label={t('Profil to‘liqligi: {n}%', { n: shop.completeness })}>
              <strong>{shop.completeness}%</strong>
            </div>
            <ul className="qs-checklist">
              {shop.checklist.map((item) => (
                <li key={item.key} className={item.done ? 'is-done' : undefined}>
                  {item.done ? <CheckCircle2 size={18} color="var(--qs-color-success)" aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                  <Link to={CHECKLIST[item.key].to}>{CHECKLIST[item.key].label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="qs-card">
          <header><h2>{t('Ko‘rsatkichlar')}</h2></header>
          <div className="qs-kpis">
            <Link to="/dokon/katalog"><strong>{formatNumber(shop.counts.products)}</strong><small>{t('Faol mahsulotlar')}</small></Link>
            <Link to="/dokon/filiallar"><strong>{formatNumber(shop.counts.branches)}</strong><small>{t('Filiallar')}</small></Link>
            <Link to="/dokon/xizmatlar"><strong>{formatNumber(shop.counts.services)}</strong><small>{t('Xizmatlar')}</small></Link>
            <div><strong>{formatRating(shop.ratingAvg)}</strong><small>{t('Reyting ({n} ta sharh)', { n: shop.ratingCount })}</small></div>
          </div>
        </section>
      </div>

      <section className="qs-card">
        <header><h2>{t('Tezkor amallar')}</h2></header>
        <div className="qs-page__actions">
          {can('catalog.write') && <ButtonLink variant="secondary" to="/dokon/katalog">{t('Mahsulot qo‘shish')}</ButtonLink>}
          {can('catalog.write') && <ButtonLink variant="secondary" to="/dokon/import">{t('Narxlarni import qilish')}</ButtonLink>}
          {can('branches.write') && <ButtonLink variant="secondary" to="/dokon/filiallar">{t('Filial qo‘shish')}</ButtonLink>}
          {isOwner && <ButtonLink variant="secondary" to="/dokon/xodimlar">{t('Xodimlar')}</ButtonLink>}
        </div>
      </section>
    </div>
  );
}
