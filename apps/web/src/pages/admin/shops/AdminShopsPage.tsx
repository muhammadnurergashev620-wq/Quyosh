import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Store } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { adminShopsService, type AdminShopFilters, type Duplicates } from '@/features/admin/shops/service';
import { IssuedCredentials } from '@/features/admin/shops/IssuedCredentials';
import { personName, SHOP_STATUS } from '@/features/shop/labels';
import type { ShopStatus } from '@/features/shop/types';
import { REGIONS } from '@/lib/regions';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate } from '@/lib/utils';
import { t } from '@/i18n';
import '@/features/shop/shop.css';

/** TZ 3.7.1: admin do‘kon + egasining hisobini yaratadi; vaqtincha parolni tizim yaratadi va bir marta ko‘rsatiladi. */
function CreateShopModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', stir: '', phone: '', regionCode: 'toshkent-shahri', address: '', ownerFirstName: '', ownerLastName: '', ownerLogin: '', ownerPhone: '' });
  const [duplicates, setDuplicates] = useState<Duplicates | null>(null);
  const [confirmDup, setConfirmDup] = useState(false);
  const [result, setResult] = useState<{ shopId: string; login: string | null; password: string } | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const digits = (value: string) => value.replace(/\D/g, '');
  const phone = digits(form.phone);
  const ownerPhone = digits(form.ownerPhone);

  useEffect(() => {
    if (!open || (!/^\d{9}$/.test(form.stir) && phone.length !== 9)) return setDuplicates(null);
    const timer = setTimeout(() => {
      void adminShopsService.duplicates(/^\d{9}$/.test(form.stir) ? form.stir : undefined, phone.length === 9 ? `+998${phone}` : undefined).then(setDuplicates).catch(() => setDuplicates(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [open, form.stir, phone]);

  const create = useMutation({
    gcTime: 0,
    mutationFn: () =>
      adminShopsService.create({
        name: form.name.trim(), stir: form.stir, phone: `+998${phone}`, regionCode: form.regionCode, address: form.address.trim(),
        ownerFirstName: form.ownerFirstName.trim(), ownerLastName: form.ownerLastName.trim() || undefined, ownerLogin: form.ownerLogin.trim(), ownerPhone: ownerPhone.length === 9 ? `+998${ownerPhone}` : undefined, confirmDuplicates: confirmDup,
      }),
    onSuccess: (data) => {
      setResult({ shopId: data.shop.id, login: data.owner.login ?? null, password: data.temporaryPassword });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'shops'] });
    },
  });
  const close = () => {
    setForm({ name: '', stir: '', phone: '', regionCode: 'toshkent-shahri', address: '', ownerFirstName: '', ownerLastName: '', ownerLogin: '', ownerPhone: '' });
    setDuplicates(null); setConfirmDup(false); setResult(null); create.reset();
    onClose();
  };
  const needsConfirm = !!duplicates?.shops.length && !duplicates.blocking;
  const valid = form.name.trim().length >= 2 && /^\d{9}$/.test(form.stir) && phone.length === 9 && form.address.trim().length >= 5 && form.ownerFirstName.trim().length >= 2 && LOGIN_RE.test(form.ownerLogin.trim()) && (ownerPhone.length === 0 || ownerPhone.length === 9);

  return (
    <Modal open={open} onClose={result ? () => undefined : close} title={t('Do‘kon yaratish')} wide dismissible={!result}>
      {result ? (
        <IssuedCredentials
          title={t('Do‘kon yaratildi')}
          login={result.login}
          password={result.password}
          onClose={() => { const id = result.shopId; close(); navigate(`/admin/dokonlar/${id}`); }}
        />
      ) : (
        <form className="qs-form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }} noValidate>
          <h3 style={{ margin: 0 }}>{t('Do‘kon ma’lumotlari')}</h3>
          <Input label={t('Do‘kon nomi')} value={form.name} onChange={(e) => set({ name: e.target.value })} required maxLength={120} />
          <div className="qs-form__row">
            <Input label={t('STIR')} inputMode="numeric" value={form.stir} onChange={(e) => set({ stir: e.target.value.replace(/\D/g, '').slice(0, 9) })} required placeholder="123456789" />
            <Input label={t('Do‘kon telefoni')} prefix="+998" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} required placeholder="90 123 45 67" />
          </div>
          <div className="qs-form__row">
            <Select label={t('Viloyat')} value={form.regionCode} onChange={(e) => set({ regionCode: e.target.value })} options={REGIONS.map((region) => ({ value: region.code, label: region.name }))} />
            <Input label={t('Manzil')} value={form.address} onChange={(e) => set({ address: e.target.value })} required maxLength={500} hint={t('Birinchi filial sifatida saqlanadi')} />
          </div>
          {duplicates && (duplicates.shops.length > 0 || duplicates.users.length > 0) && (
            <Alert tone={duplicates.blocking ? 'danger' : 'warning'} title={duplicates.blocking ? t('Bu STIR bilan do‘kon mavjud') : t('O‘xshash yozuvlar topildi')}>
              <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
                {duplicates.shops.map((shop) => <li key={shop.id}>{shop.name} · {SHOP_STATUS[shop.status].label}{shop.stir ? ` · STIR ${shop.stir}` : ''}</li>)}
                {duplicates.users.map((user) => <li key={user.id}>{t('Foydalanuvchi')}: {personName(user)} (#{user.accountNumber})</li>)}
              </ul>
              {needsConfirm && <label className="qs-check"><input type="checkbox" checked={confirmDup} onChange={(e) => setConfirmDup(e.target.checked)} /> {t('Baribir yaratish')}</label>}
            </Alert>
          )}
          <h3 style={{ margin: '8px 0 0' }}>{t('Egasining hisobi')}</h3>
          <div className="qs-form__row">
            <Input label={t('Ism')} value={form.ownerFirstName} onChange={(e) => set({ ownerFirstName: e.target.value })} required maxLength={100} />
            <Input label={t('Familiya (ixtiyoriy)')} value={form.ownerLastName} onChange={(e) => set({ ownerLastName: e.target.value })} maxLength={100} />
          </div>
          <Input label={t('Login')} value={form.ownerLogin} onChange={(e) => set({ ownerLogin: e.target.value.replace(/\s/g, '') })} required maxLength={32} autoCapitalize="none" spellCheck={false} placeholder="masalan: quyosh.servis" hint={t('Lotin harflari, raqamlar va . _ - (3–32 belgi). Vaqtincha parolni tizim yaratadi va keyingi oynada bir marta ko‘rsatadi')} />
          <Input label={t('Telefon (ixtiyoriy)')} prefix="+998" inputMode="tel" value={form.ownerPhone} onChange={(e) => set({ ownerPhone: e.target.value })} placeholder="90 123 45 67" />
          {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
          <div className="qs-form__actions">
            <Button type="button" variant="ghost" onClick={close}>{t('Bekor qilish')}</Button>
            <Button type="submit" loading={create.isPending} disabled={!valid || !!duplicates?.blocking || (needsConfirm && !confirmDup)}>{t('Yaratish')}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** U12.3 / U12.11: do‘konlar ro‘yxati; do‘konni faqat admin yaratadi (v3.1). */
const LOGIN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;

export function AdminShopsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AdminShopFilters>({});
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => ({ ...current, search: search.trim() || undefined, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useQuery({ queryKey: ['admin', 'shops', filters], queryFn: () => adminShopsService.list(filters), placeholderData: keepPreviousData });

  if (list.isLoading) return <PageLoader />;
  if (list.isError || !list.data) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  const counts = list.data.counts;
  const statuses: Array<ShopStatus | undefined> = [undefined, 'ACTIVE', 'SUSPENDED'];

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div>
          <h1>{t('Do‘konlar')}</h1>
          <p>{t('Do‘konni faqat administrator yaratadi: do‘kon, egasining hisobi va vaqtincha parol.')}</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={18} /> {t('Do‘kon yaratish')}</Button>
      </div>
      <div className="qs-toolbar">
        <Input label={t('Qidirish')} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Nom, STIR yoki telefon')} />
          <div className="qs-chips" role="group" aria-label={t('Holat')}>
            {statuses.map((status) => (
              <button key={status ?? 'all'} type="button" className={cx('qs-chip', filters.status === status && 'is-on')} onClick={() => setFilters({ ...filters, status, page: 1 })}>
                {status ? SHOP_STATUS[status].label : t('Hammasi')}
                {status && <span>{counts[status] ?? 0}</span>}
              </button>
            ))}
          </div>
      </div>
      {!list.data.items.length ? (
        <EmptyState icon={<Store size={30} />} title={t('Do‘kon topilmadi')} />
      ) : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Do‘kon')}</th><th>{t('Egasi')}</th><th>{t('Holat')}</th><th className="qs-right">{t('Filial / mahsulot')}</th><th>{t('Yaratilgan')}</th></tr></thead>
            <tbody>
              {list.data.items.map((shop) => (
                <tr key={shop.id} className="is-clickable" onClick={() => navigate(`/admin/dokonlar/${shop.id}`)}>
                  <td><div className="qs-cell-title"><strong>{shop.name}</strong><small>{[shop.stir && `STIR ${shop.stir}`, shop.phone].filter(Boolean).join(' · ')}</small></div></td>
                  <td>{shop.owner ? personName(shop.owner) : <Badge tone="warning">{t('Egasiz')}</Badge>}</td>
                  <td><Badge tone={SHOP_STATUS[shop.status].tone}>{SHOP_STATUS[shop.status].label}</Badge></td>
                  <td className="qs-right qs-num">{shop._count.branches} / {shop._count.products}</td>
                  <td className="qs-muted">{formatDate(shop.createdAt)}{shop.createdSource === 'ADMIN' && <div><small>{t('admin yaratgan')}</small></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data.pages > 1 && (
        <div className="qs-page__actions" style={{ justifyContent: 'center' }}>
          <Button size="sm" variant="ghost" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}>{t('Oldingi')}</Button>
          <span className="qs-muted">{filters.page ?? 1} / {list.data.pages}</span>
          <Button size="sm" variant="ghost" disabled={(filters.page ?? 1) >= list.data.pages} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}>{t('Keyingi')}</Button>
        </div>
      )}
      <CreateShopModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

