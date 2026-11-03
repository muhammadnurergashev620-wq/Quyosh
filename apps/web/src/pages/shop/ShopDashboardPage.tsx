import { Link, Navigate } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/common/PageLoader';
import { useCurrentShop } from '@/features/shop/current-shop';
import { useManagedShop, useShopMutation } from '@/features/shop/hooks';
import { shopService } from '@/features/shop/shop.service';
import { SHOP_STATUS, VERIFICATION_STATUS } from '@/features/shop/labels';
import { ShopSwitcher } from '@/features/shop/components/ShopSwitcher';
import type { ManagedShop } from '@/features/shop/types';
import { getErrorMessage } from '@/lib/error-messages';
import { formatNumber } from '@/lib/utils';
import { t } from '@/i18n';
import { ShopKpis } from '@/pages/m7/ShopM7Pages';
import '@/features/shop/shop.css';

const CHECKLIST: Record<ManagedShop['checklist'][number]['key'], { label: string; to: string }> = {
  profile: { label: t('Logo va tavsif'), to: '/dokon/onboarding' },
  branch: { label: t('Birinchi filial'), to: '/dokon/filiallar' },
  serviceArea: { label: t('Xizmat hududi'), to: '/dokon/filiallar' },
  verification: { label: t('Verifikatsiya hujjatlari'), to: '/dokon/onboarding' },
  products: { label: t('Birinchi mahsulotlar'), to: '/dokon/katalog' },
};

/** U11.2: holat, KPI (30 kun), «Bugun javob bering», profil to‘liqligi va tezkor amallar. */
export function ShopDashboardPage() {
  const { shop: current, isLoading, can } = useCurrentShop();
  const managed = useManagedShop(current?.id ?? null);
  const submit = useShopMutation(current?.id ?? null, (shopId) => shopService.submit(shopId), { success: t('Do‘kon tekshiruvga yuborildi') });
  if (isLoading || managed.isLoading) return <PageLoader />;
  if (!current) return <Navigate to="/dokon/onboarding" replace />;
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
          <Badge tone={SHOP_STATUS[shop.status].tone}>{SHOP_STATUS[shop.status].label}</Badge>
          <Badge tone={VERIFICATION_STATUS[shop.verificationStatus].tone}>{VERIFICATION_STATUS[shop.verificationStatus].label}</Badge>
        </div>
      </div>

      {shop.status === 'SUSPENDED' && (
        <Alert tone="danger" title={t('Do‘kon vaqtincha to‘xtatilgan')}>
          {t('Faqat ko‘rish mumkin. Sabab: {reason}', { reason: shop.suspendReason ?? '—' })}
        </Alert>
      )}
      {shop.status === 'PENDING_REVIEW' && <Alert tone="warning" title={t('Tekshiruvda')}>{t('Administrator hujjatlaringizni ko‘rib chiqmoqda. Natija bildirishnoma orqali keladi.')}</Alert>}
      {shop.rejection && shop.status === 'DRAFT' && (
        <Alert tone="danger" title={t('Tekshiruv rad etildi')}>
          {shop.rejection.reason} — {t('kamchiliklarni tuzatib, qayta yuboring.')}
        </Alert>
      )}

      <ShopKpis shopId={shop.id} />

      <div className="qs-grid-2">
        <section className="qs-card">
          <header><h2>{t('Profil to‘liqligi')}</h2></header>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
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
          {shop.status === 'DRAFT' && isOwner && (
            <div className="qs-form__actions" style={{ marginTop: 16 }}>
              <Button loading={submit.isPending} disabled={shop.counts.verificationDocs === 0} onClick={() => submit.mutate(undefined)}>
                {t('Tekshiruvga yuborish')}
              </Button>
            </div>
          )}
        </section>
        <section className="qs-card">
          <header><h2>{t('Ko‘rsatkichlar')}</h2></header>
          <div className="qs-kpis">
            <Link to="/dokon/katalog"><strong>{formatNumber(shop.counts.products)}</strong><small>{t('Faol mahsulotlar')}</small></Link>
            <Link to="/dokon/filiallar"><strong>{formatNumber(shop.counts.branches)}</strong><small>{t('Filiallar')}</small></Link>
            <Link to="/dokon/xizmatlar"><strong>{formatNumber(shop.counts.services)}</strong><small>{t('Xizmatlar')}</small></Link>
            <div><strong>{Number(shop.ratingAvg).toFixed(1)}</strong><small>{t('Reyting ({n} ta sharh)', { n: shop.ratingCount })}</small></div>
          </div>
        </section>
      </div>

      <section className="qs-card">
        <header><h2>{t('Tezkor amallar')}</h2></header>
        <div className="qs-page__actions">
          {can('catalog.write') && <Link className="gm-button gm-button--secondary gm-button--md" to="/dokon/katalog">{t('Mahsulot qo‘shish')}</Link>}
          {can('catalog.write') && <Link className="gm-button gm-button--secondary gm-button--md" to="/dokon/import">{t('Narxlarni import qilish')}</Link>}
          {can('branches.write') && <Link className="gm-button gm-button--secondary gm-button--md" to="/dokon/filiallar">{t('Filial qo‘shish')}</Link>}
          {isOwner && <Link className="gm-button gm-button--secondary gm-button--md" to="/dokon/xodimlar">{t('Xodim taklif qilish')}</Link>}
        </div>
      </section>
    </div>
  );
}
