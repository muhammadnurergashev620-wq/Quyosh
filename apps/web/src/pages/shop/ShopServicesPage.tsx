import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { useCurrentShop } from '@/features/shop/current-shop';
import { useShopBranches, useShopMutation, useShopServices } from '@/features/shop/hooks';
import { shopService } from '@/features/shop/shop.service';
import { PRICING_MODEL, SERVICE_TYPE } from '@/features/shop/labels';
import type { Currency, PricingModel, ServiceInput, ServiceType, ShopService } from '@/features/shop/types';
import { getErrorMessage } from '@/lib/error-messages';
import { formatMoney } from '@/lib/format';
import { t } from '@/i18n';
import '@/features/shop/shop.css';

function ServiceForm({ initial, branches, loading, onSubmit, onCancel }: { initial?: ShopService; branches: Array<{ id: string; name: string }>; loading: boolean; onSubmit: (input: ServiceInput) => void; onCancel: () => void }) {
  const [serviceType, setServiceType] = useState<ServiceType>(initial?.serviceType ?? 'INSTALLATION');
  const [pricingModel, setPricingModel] = useState<PricingModel>(initial?.pricingModel ?? 'PER_KW');
  const [price, setPrice] = useState(initial?.price ? String(Math.round(Number(initial.price))) : '');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'UZS');
  const [branchId, setBranchId] = useState(initial?.branchId ?? '');
  const [warranty, setWarranty] = useState(initial?.warrantyMonths != null ? String(initial.warrantyMonths) : '');
  const [description, setDescription] = useState(initial?.descriptionI18n?.uz ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState('');
  const needsPrice = pricingModel !== 'QUOTE_REQUIRED';

  function submit(event: FormEvent) {
    event.preventDefault();
    if (needsPrice && !price) return setError(t('Narxni kiriting'));
    setError('');
    onSubmit({
      serviceType,
      pricingModel,
      price: needsPrice ? price : undefined,
      currency,
      branchId: branchId || undefined,
      warrantyMonths: warranty ? Number(warranty) : undefined,
      descriptionI18n: description.trim() ? { uz: description.trim() } : undefined,
      active,
    });
  }

  return (
    <form className="qs-form" onSubmit={submit} noValidate>
      <div className="qs-form__row">
        <Select label={t('Xizmat turi')} value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)} options={(Object.keys(SERVICE_TYPE) as ServiceType[]).map((value) => ({ value, label: SERVICE_TYPE[value] }))} />
        <Select label={t('Narx modeli')} value={pricingModel} onChange={(e) => setPricingModel(e.target.value as PricingModel)} options={(Object.keys(PRICING_MODEL) as PricingModel[]).map((value) => ({ value, label: PRICING_MODEL[value] }))} />
      </div>
      {needsPrice && (
        <div className="qs-form__row">
          <MoneyInput label={t('Narx')} value={price} onValueChange={setPrice} suffix={currency === 'USD' ? '$' : t('so‘m')} />
          <Select label={t('Valyuta')} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} options={[{ value: 'UZS', label: 'UZS' }, { value: 'USD', label: 'USD' }]} />
        </div>
      )}
      <div className="qs-form__row">
        <Select label={t('Filial')} value={branchId} onChange={(e) => setBranchId(e.target.value)} options={[{ value: '', label: t('Barcha filiallar') }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
        <Input label={t('Montaj kafolati (oy)')} inputMode="numeric" value={warranty} onChange={(e) => setWarranty(e.target.value.replace(/\D/g, '').slice(0, 3))} />
      </div>
      <Textarea label={t('Tavsif')} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} hint={t('Nimalar kiradi: kabel, konstruksiya, ishga tushirish…')} />
      <label className="qs-check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t('Xizmat faol')}</label>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="qs-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('Bekor qilish')}</Button>
        <Button type="submit" loading={loading}>{t('Saqlash')}</Button>
      </div>
    </form>
  );
}

const priceText = (service: ShopService) => {
  if (service.pricingModel === 'QUOTE_REQUIRED' || !service.price) return PRICING_MODEL.QUOTE_REQUIRED;
  const money = formatMoney(service.price, service.currency);
  if (service.pricingModel === 'FROM') return t('{price} dan', { price: money });
  if (service.pricingModel === 'PER_KW') return t('{price} / kW', { price: money });
  if (service.pricingModel === 'PER_UNIT') return t('{price} / dona', { price: money });
  return money;
};

/** U11.9: xizmatlar (montaj, obyektga chiqish, audit, texnik xizmat, yetkazish). */
export function ShopServicesPage() {
  const { shopId, can } = useCurrentShop();
  const services = useShopServices(shopId);
  const branches = useShopBranches(shopId);
  const [editing, setEditing] = useState<ShopService | 'new' | null>(null);
  const [removing, setRemoving] = useState<ShopService | null>(null);
  const create = useShopMutation(shopId, shopService.createService, { success: t('Xizmat qo‘shildi') });
  const update = useShopMutation(shopId, (id, vars: { serviceId: string; input: ServiceInput }) => shopService.updateService(id, vars.serviceId, vars.input), { success: t('Saqlandi') });
  const remove = useShopMutation(shopId, (id, serviceId: string) => shopService.deleteService(id, serviceId), { success: t('Xizmat o‘chirildi') });
  const writable = can('services.write');
  const branchName = (id: string | null) => branches.data?.find((branch) => branch.id === id)?.name ?? t('Barcha filiallar');

  if (services.isLoading) return <PageLoader />;
  if (services.isError) return <Alert tone="danger">{getErrorMessage(services.error)}</Alert>;

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Xizmatlar')}</h1><p>{t('Montaj va boshqa xizmatlar narxi taklif tayyorlashda ishlatiladi.')}</p></div>
        {writable && <Button onClick={() => setEditing('new')}><Plus size={18} /> {t('Xizmat qo‘shish')}</Button>}
      </div>
      {!services.data?.length ? (
        <EmptyState icon={<Wrench size={32} />} title={t('Hali xizmat yo‘q')} description={t('Masalan: «Montaj — har kW uchun 1 200 000 so‘m».')} action={writable && <Button onClick={() => setEditing('new')}>{t('Xizmat qo‘shish')}</Button>} />
      ) : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Xizmat')}</th><th>{t('Narx')}</th><th>{t('Filial')}</th><th>{t('Kafolat')}</th><th>{t('Holat')}</th>{writable && <th />}</tr></thead>
            <tbody>
              {services.data.map((service) => (
                <tr key={service.id}>
                  <td><div className="qs-cell-title"><strong>{SERVICE_TYPE[service.serviceType]}</strong>{service.descriptionI18n?.uz && <small>{service.descriptionI18n.uz}</small>}</div></td>
                  <td className="qs-num">{priceText(service)}</td>
                  <td>{branchName(service.branchId)}</td>
                  <td>{service.warrantyMonths != null ? t('{n} oy', { n: service.warrantyMonths }) : '—'}</td>
                  <td><Badge tone={service.active ? 'success' : 'neutral'}>{service.active ? t('Faol') : t('Nofaol')}</Badge></td>
                  {writable && (
                    <td className="qs-right">
                      <span className="qs-page__actions qs-justify-end">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(service)}>{t('Tahrirlash')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setRemoving(service)}>{t('O‘chirish')}</Button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('Yangi xizmat') : t('Xizmatni tahrirlash')} wide>
        {editing && (
          <ServiceForm
            initial={editing === 'new' ? undefined : editing}
            branches={branches.data ?? []}
            loading={create.isPending || update.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => (editing === 'new' ? create.mutate(input, { onSuccess: () => setEditing(null) }) : update.mutate({ serviceId: editing.id, input }, { onSuccess: () => setEditing(null) }))}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!removing}
        title={t('Xizmatni o‘chirish')}
        description={t('«{name}» xizmati o‘chiriladi.', { name: removing ? SERVICE_TYPE[removing.serviceType] : '' })}
        confirmLabel={t('O‘chirish')}
        tone="danger"
        showCancel
        cancelLabel={t('Bekor qilish')}
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
