import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { PageLoader } from '@/components/common/PageLoader';
import { MediaUploadField } from '@/features/media/components/MediaUploadField';
import { useCurrentShop } from '@/features/shop/current-shop';
import { useManagedShop, useShopMutation } from '@/features/shop/hooks';
import { shopService } from '@/features/shop/shop.service';
import { SHOP_STATUS, VERIFICATION_STATUS } from '@/features/shop/labels';
import { ShopSwitcher } from '@/features/shop/components/ShopSwitcher';
import type { ManagedShop } from '@/features/shop/types';
import { getErrorMessage } from '@/lib/error-messages';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import { StatusBadge } from '@/components/ui/StatusBadge';

function ProfileForm({ shop }: { shop: ManagedShop }) {
  const [description, setDescription] = useState(shop.description ?? '');
  const [email, setEmail] = useState(shop.email ?? '');
  const update = useShopMutation(shop.id, shopService.update, { success: t('Saqlandi') });
  return (
    <div className="qs-form">
      <div className="qs-grid-2">
        <MediaUploadField label={t('Logo')} accept="image/*" kind="SHOP_LOGO" linkType="Shop" linkId={shop.id} onReady={(id) => update.mutate({ logoAssetId: id })} />
        <MediaUploadField label={t('Muqova rasmi')} accept="image/*" kind="SHOP_LOGO" linkType="Shop" linkId={shop.id} onReady={(id) => update.mutate({ coverAssetId: id })} />
      </div>
      {shop.logoAssetId && <Badge tone="success">{t('Logo yuklangan')}</Badge>}
      <Textarea label={t('Do‘kon haqida')} value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={10000} hint={t('Qaysi uskunalar, qaysi hududlarda, necha yillik tajriba — mijoz shu matnni o‘qiydi')} />
      <Input label={t('Email (ixtiyoriy)')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {update.isError && <Alert tone="danger">{getErrorMessage(update.error)}</Alert>}
      <div className="qs-form__actions">
        <Button loading={update.isPending} onClick={() => update.mutate({ description: description.trim(), email: email.trim() || undefined })}>{t('Saqlash')}</Button>
      </div>
    </div>
  );
}

/** Do‘kon profili: logo, muqova, tavsif, email. Do‘kon va uning egasini admin yaratadi (TZ 3.7), shuning uchun ochish/onboarding yo‘q. */
export function ShopOwnProfilePage() {
  const { shop: current, isLoading } = useCurrentShop();
  const managed = useManagedShop(current?.id ?? null);
  if (isLoading || managed.isLoading) return <PageLoader />;
  if (!current || managed.isError || !managed.data) return <Alert tone="danger">{managed.error ? getErrorMessage(managed.error) : t('Do‘kon topilmadi')}</Alert>;
  const shop = managed.data;
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Do‘kon profili')}</h1><p>{shop.name}</p></div>
        <div className="qs-page__actions">
          <ShopSwitcher />
          <StatusBadge map={SHOP_STATUS} status={shop.status} />
          <StatusBadge map={VERIFICATION_STATUS} status={shop.verificationStatus} />
        </div>
      </div>
      <section className="qs-card"><ProfileForm shop={shop} /></section>
    </div>
  );
}
