import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileUp, MapPinned, Package, Store } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { PageLoader } from '@/components/common/PageLoader';
import { MediaUploadField } from '@/features/media/components/MediaUploadField';
import { useCurrentShop, useShopSelection, myShopsKey } from '@/features/shop/current-shop';
import { useManagedShop, useShopBranches, useShopDocuments, useShopMutation } from '@/features/shop/hooks';
import { shopService } from '@/features/shop/shop.service';
import { BranchForm } from '@/features/shop/components/BranchForm';
import { ServiceAreaEditor } from '@/features/shop/components/ServiceAreaEditor';
import { DOC_TYPE, SERVICE_TYPE, SHOP_STATUS, VERIFICATION_STATUS } from '@/features/shop/labels';
import type { ManagedShop, ServiceType, ShopDocType } from '@/features/shop/types';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import '@/features/shop/shop.css';

/** TZ 3.5 / U11.1: «Do‘kon ochish» — nom, telefon, STIR va faoliyat turlari. */
function CreateShopForm() {
  const queryClient = useQueryClient();
  const setShopId = useShopSelection((s) => s.setShopId);
  const pushToast = useAppStore((s) => s.pushToast);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [stir, setStir] = useState('');
  const [activities, setActivities] = useState<ServiceType[]>(['INSTALLATION']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (name.trim().length < 2) return setError(t('Do‘kon nomini kiriting'));
    if (digits.length !== 9) return setError(t('Telefon raqami 9 ta raqamdan iborat bo‘lishi kerak'));
    if (stir && !/^\d{9}$/.test(stir)) return setError(t('STIR 9 ta raqamdan iborat'));
    setError('');
    setLoading(true);
    try {
      const shop = await shopService.create({ name: name.trim(), phone: `+998${digits}`, stir: stir || undefined, activities });
      setShopId(shop.id);
      await Promise.all([queryClient.invalidateQueries({ queryKey: myShopsKey }), queryClient.invalidateQueries({ queryKey: ['users', 'me'] })]);
      pushToast(t('Do‘kon yaratildi. Endi profilni to‘ldiring.'), 'success');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const toggle = (type: ServiceType) => setActivities((list) => (list.includes(type) ? list.filter((item) => item !== type) : [...list, type]));

  return (
    <section className="qs-card" style={{ maxWidth: 640 }}>
      <header>
        <Store size={22} aria-hidden="true" />
        <h2>{t('Do‘kon ochish')}</h2>
      </header>
      <p className="qs-muted">{t('Do‘kon qoralama holatida yaratiladi. Profil, filial va hujjatlarni to‘ldirib, tekshiruvga yuborasiz — tasdiqlangach mijozlarga ko‘rinadi.')}</p>
      <form className="qs-form" onSubmit={(e) => void submit(e)} noValidate>
        <Input label={t('Do‘kon nomi')} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus />
        <div className="qs-form__row">
          <Input label={t('Telefon')} prefix="+998" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="90 123 45 67" required />
          <Input label={t('STIR (ixtiyoriy)')} inputMode="numeric" value={stir} onChange={(e) => setStir(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="123456789" />
        </div>
        <fieldset className="qs-chips" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="gm-field__label">{t('Faoliyat turi')}</legend>
          {(Object.keys(SERVICE_TYPE) as ServiceType[]).map((type) => (
            <button key={type} type="button" className={cx('qs-chip', activities.includes(type) && 'is-on')} aria-pressed={activities.includes(type)} onClick={() => toggle(type)}>
              {SERVICE_TYPE[type]}
            </button>
          ))}
        </fieldset>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="qs-form__actions">
          <Button type="submit" loading={loading}>{t('Do‘kon yaratish')}</Button>
        </div>
      </form>
    </section>
  );
}

const STEPS = [
  { key: 'profile', label: t('Profil'), icon: Store },
  { key: 'branch', label: t('Birinchi filial'), icon: MapPinned },
  { key: 'serviceArea', label: t('Xizmat hududi'), icon: MapPinned },
  { key: 'verification', label: t('Hujjatlar'), icon: FileUp },
  { key: 'products', label: t('Mahsulotlar'), icon: Package },
] as const;

function ProfileStep({ shop, onNext }: { shop: ManagedShop; onNext: () => void }) {
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
      <div className="qs-form__actions">
        <Button loading={update.isPending} onClick={() => update.mutate({ description: description.trim(), email: email.trim() || undefined }, { onSuccess: onNext })}>
          {t('Saqlash va davom etish')}
        </Button>
      </div>
    </div>
  );
}

function BranchStep({ shopId, onNext }: { shopId: string; onNext: () => void }) {
  const branches = useShopBranches(shopId);
  const create = useShopMutation(shopId, shopService.createBranch, { success: t('Filial qo‘shildi') });
  if (branches.isLoading) return <PageLoader />;
  if (branches.data?.length) {
    return (
      <div className="qs-form">
        <ul className="qs-list">
          {branches.data.map((branch) => (
            <li key={branch.id}><div><strong>{branch.name}</strong><small>{branch.address}</small></div><CheckCircle2 size={18} color="var(--qs-color-success)" aria-hidden="true" /></li>
          ))}
        </ul>
        <div className="qs-form__actions">
          <Link to="/dokon/filiallar" className="gm-button gm-button--ghost gm-button--md">{t('Filiallarni boshqarish')}</Link>
          <Button onClick={onNext}>{t('Davom etish')}</Button>
        </div>
      </div>
    );
  }
  return <BranchForm loading={create.isPending} submitLabel={t('Filialni saqlash')} onSubmit={(input) => create.mutate(input, { onSuccess: onNext })} />;
}

function ServiceAreaStep({ shopId, onNext }: { shopId: string; onNext: () => void }) {
  const branches = useShopBranches(shopId);
  const branch = branches.data?.[0];
  if (branches.isLoading) return <PageLoader />;
  if (!branch) return <Alert tone="info">{t('Avval birinchi filialni qo‘shing.')}</Alert>;
  return (
    <div className="qs-form">
      <p className="qs-muted" style={{ margin: 0 }}>{t('Mijoz qaysi hududda bo‘lsa, unga xizmat ko‘rsatadigan do‘konlar birinchi tavsiya qilinadi.')}</p>
      <ServiceAreaEditor shopId={shopId} branch={branch} onDone={onNext} />
    </div>
  );
}

function VerificationStep({ shop, onNext }: { shop: ManagedShop; onNext: () => void }) {
  const docs = useShopDocuments(shop.id);
  const [docType, setDocType] = useState<ShopDocType>('REGISTRATION');
  const add = useShopMutation(shop.id, (shopId, fileId: string) => shopService.addDocument(shopId, fileId, docType), { success: t('Hujjat qo‘shildi') });
  const isOwner = shop.membership.memberRole === 'OWNER';
  if (!isOwner) return <Alert tone="info">{t('Hujjatlarni faqat do‘kon egasi yuklaydi.')}</Alert>;
  return (
    <div className="qs-form">
      <p className="qs-muted">{t('Davlat ro‘yxatidan o‘tganlik guvohnomasi yoki litsenziya (PDF yoki rasm). Hujjatlar faqat administratorga ko‘rinadi.')}</p>
      <div className="qs-form__row">
        <Select label={t('Hujjat turi')} value={docType} onChange={(e) => setDocType(e.target.value as ShopDocType)} options={(Object.keys(DOC_TYPE) as ShopDocType[]).map((value) => ({ value, label: DOC_TYPE[value] }))} />
        <MediaUploadField label={t('Fayl')} accept="application/pdf,image/*" kind="VERIFICATION_DOC" linkType="Shop" linkId={shop.id} onReady={(id) => add.mutate(id)} />
      </div>
      {!!docs.data?.length && (
        <ul className="qs-list">
          {docs.data.map((doc) => (
            <li key={doc.id}>
              <div><strong>{DOC_TYPE[doc.docType]}</strong>{doc.reason && <small>{doc.reason}</small>}</div>
              <Badge tone={doc.status === 'ACCEPTED' ? 'success' : doc.status === 'REJECTED' ? 'danger' : 'warning'}>
                {doc.status === 'ACCEPTED' ? t('Qabul qilingan') : doc.status === 'REJECTED' ? t('Rad etilgan') : t('Kutilmoqda')}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="qs-form__actions">
        <Button variant={docs.data?.length ? 'primary' : 'ghost'} onClick={onNext}>{docs.data?.length ? t('Davom etish') : t('Keyinroq')}</Button>
      </div>
    </div>
  );
}

function ProductsStep({ shop }: { shop: ManagedShop }) {
  const navigate = useNavigate();
  const submit = useShopMutation(shop.id, (shopId) => shopService.submit(shopId), { success: t('Do‘kon tekshiruvga yuborildi') });
  const canSubmit = shop.status === 'DRAFT' && shop.membership.memberRole === 'OWNER';
  return (
    <div className="qs-form">
      <div className="qs-grid-2">
        <Link to="/dokon/katalog" className="qs-card" style={{ color: 'inherit', textDecoration: 'none' }}>
          <Package size={22} aria-hidden="true" />
          <h2 style={{ margin: '8px 0 4px' }}>{t('Qo‘lda qo‘shish')}</h2>
          <p className="qs-muted">{t('Yagona katalogdan modelni toping va narxini kiriting.')}</p>
        </Link>
        <Link to="/dokon/import" className="qs-card" style={{ color: 'inherit', textDecoration: 'none' }}>
          <FileUp size={22} aria-hidden="true" />
          <h2 style={{ margin: '8px 0 4px' }}>{t('CSV/XLSX import')}</h2>
          <p className="qs-muted">{t('Narxlar ro‘yxatini shablon orqali bir martada yuklang.')}</p>
        </Link>
      </div>
      {canSubmit && (
        <Alert tone="info" title={t('Tekshiruvga yuborish')}>
          {t('Administrator hujjatlarni tekshiradi. Tasdiqlangach do‘kon katalog va xaritada ko‘rinadi.')}
        </Alert>
      )}
      <div className="qs-form__actions">
        <Button variant="ghost" onClick={() => navigate('/dokon')}>{t('Bosh panelga')}</Button>
        {canSubmit && <Button loading={submit.isPending} onClick={() => submit.mutate(undefined)}>{t('Tekshiruvga yuborish')}</Button>}
      </div>
    </div>
  );
}

export function ShopOnboardingPage() {
  const { shop: selectedShop, isLoading } = useCurrentShop();
  const managed = useManagedShop(selectedShop?.id ?? null);
  const [step, setStep] = useState<(typeof STEPS)[number]['key']>('profile');
  if (isLoading || (selectedShop && managed.isLoading)) return <PageLoader />;

  if (!selectedShop) {
    return (
      <div className="qs-page">
        <div className="qs-page__head"><div><h1>{t('Do‘kon ochish')}</h1><p>{t('Quyosh platformasida sotuvchi yoki montajchi sifatida ishlash uchun do‘kon yarating.')}</p></div></div>
        <CreateShopForm />
      </div>
    );
  }
  if (managed.isError || !managed.data) return <Alert tone="danger">{getErrorMessage(managed.error)}</Alert>;
  const shop = managed.data;
  const done = new Set(shop.checklist.filter((item) => item.done).map((item) => item.key));
  const index = STEPS.findIndex((item) => item.key === step);
  const current = STEPS[index] ?? STEPS[0];
  const next = () => setStep((STEPS[index + 1] ?? current).key);

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div>
          <h1>{shop.name}</h1>
          <p>{t('Profil to‘liqligi: {n}%', { n: shop.completeness })}</p>
        </div>
        <div className="qs-page__actions">
          <Badge tone={SHOP_STATUS[shop.status].tone}>{SHOP_STATUS[shop.status].label}</Badge>
          <Badge tone={VERIFICATION_STATUS[shop.verificationStatus].tone}>{VERIFICATION_STATUS[shop.verificationStatus].label}</Badge>
        </div>
      </div>
      {shop.rejection && <Alert tone="danger" title={t('Tekshiruv rad etildi')}>{shop.rejection.reason}</Alert>}
      <ol className="qs-steps">
        {STEPS.map((item, position) => (
          <li key={item.key} className={cx(done.has(item.key) && 'is-done', item.key === step && 'is-current')}>
            <button type="button" onClick={() => setStep(item.key)} aria-current={item.key === step ? 'step' : undefined}>
              {position + 1}. {item.label}
            </button>
          </li>
        ))}
      </ol>
      <section className="qs-card">
        <h2>{current.label}</h2>
        {step === 'profile' && <ProfileStep shop={shop} onNext={next} />}
        {step === 'branch' && <BranchStep shopId={shop.id} onNext={next} />}
        {step === 'serviceArea' && (
          <ServiceAreaStep shopId={shop.id} onNext={next} />
        )}
        {step === 'verification' && <VerificationStep shop={shop} onNext={next} />}
        {step === 'products' && <ProductsStep shop={shop} />}
      </section>
    </div>
  );
}
