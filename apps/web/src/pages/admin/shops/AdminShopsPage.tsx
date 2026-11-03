import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Store } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { adminShopsService, type AdminShopFilters, type Duplicates } from '@/features/admin/shops/service';
import { personName, SHOP_STATUS, VERIFICATION_STATUS } from '@/features/shop/labels';
import type { InvitationResult, ShopStatus } from '@/features/shop/types';
import { useMe } from '@/features/session/hooks/useMe';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate } from '@/lib/utils';
import { t } from '@/i18n';
import '@/features/shop/shop.css';

/** TZ 3.7.1: superadmin do‘kon yaratadi — dublikat tekshiruvi, egaga taklif. */
function CreateShopModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [stir, setStir] = useState('');
  const [owner, setOwner] = useState('');
  const [activate, setActivate] = useState(false);
  const [duplicates, setDuplicates] = useState<Duplicates | null>(null);
  const [confirmDup, setConfirmDup] = useState(false);
  const [result, setResult] = useState<{ shopId: string; invitation: InvitationResult } | null>(null);
  const digits = phone.replace(/\D/g, '');

  useEffect(() => {
    if (!open || (!/^\d{9}$/.test(stir) && digits.length !== 9)) return setDuplicates(null);
    const timer = setTimeout(() => {
      void adminShopsService.duplicates(/^\d{9}$/.test(stir) ? stir : undefined, digits.length === 9 ? `+998${digits}` : undefined).then(setDuplicates).catch(() => setDuplicates(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [open, stir, digits]);

  const create = useMutation({
    mutationFn: () => adminShopsService.create({ name: name.trim(), phone: `+998${digits}`, stir: stir || undefined, ownerTarget: owner.trim(), confirmDuplicates: confirmDup, activate }),
    onSuccess: (data) => {
      setResult({ shopId: data.shop.id, invitation: data.invitation });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'shops'] });
    },
  });
  const close = () => {
    setName(''); setPhone(''); setStir(''); setOwner(''); setActivate(false); setDuplicates(null); setConfirmDup(false); setResult(null); create.reset();
    onClose();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  const needsConfirm = !!duplicates?.shops.length && !duplicates.blocking;

  return (
    <Modal open={open} onClose={close} title={t('Do‘kon yaratish')} wide>
      {result ? (
        <div className="qs-form">
          <Alert tone="success" title={t('Do‘kon yaratildi')}>{t('Egasiga taklif yuborildi: {target}. U qabul qilgach do‘kon egali bo‘ladi.', { target: result.invitation.target })}</Alert>
          {result.invitation.developmentLink && <code style={{ overflowWrap: 'anywhere' }}>{result.invitation.developmentLink}</code>}
          <div className="qs-form__actions">
            <Button variant="ghost" onClick={close}>{t('Yopish')}</Button>
            <Button onClick={() => { const id = result.shopId; close(); navigate(`/admin/dokonlar/${id}`); }}>{t('Do‘konni ochish')}</Button>
          </div>
        </div>
      ) : (
        <form className="qs-form" onSubmit={submit} noValidate>
          <Input label={t('Do‘kon nomi')} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          <div className="qs-form__row">
            <Input label={t('Do‘kon telefoni')} prefix="+998" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <Input label={t('STIR')} inputMode="numeric" value={stir} onChange={(e) => setStir(e.target.value.replace(/\D/g, '').slice(0, 9))} />
          </div>
          <Input label={t('Egasi (telefon yoki email)')} value={owner} onChange={(e) => setOwner(e.target.value)} required hint={t('Egasiga 7 kunlik taklif havolasi yuboriladi')} />
          {duplicates && (duplicates.shops.length > 0 || duplicates.users.length > 0) && (
            <Alert tone={duplicates.blocking ? 'danger' : 'warning'} title={duplicates.blocking ? t('Bu STIR bilan do‘kon mavjud') : t('O‘xshash yozuvlar topildi')}>
              <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
                {duplicates.shops.map((shop) => <li key={shop.id}>{shop.name} · {SHOP_STATUS[shop.status].label}{shop.stir ? ` · STIR ${shop.stir}` : ''}</li>)}
                {duplicates.users.map((user) => <li key={user.id}>{t('Foydalanuvchi')}: {personName(user)} (#{user.accountNumber})</li>)}
              </ul>
              {needsConfirm && <label className="qs-check"><input type="checkbox" checked={confirmDup} onChange={(e) => setConfirmDup(e.target.checked)} /> {t('Baribir yaratish')}</label>}
            </Alert>
          )}
          <label className="qs-check"><input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} /> {t('Darhol faollashtirish (hujjatlar tekshirilgan)')}</label>
          {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
          <div className="qs-form__actions">
            <Button type="button" variant="ghost" onClick={close}>{t('Bekor qilish')}</Button>
            <Button type="submit" loading={create.isPending} disabled={!name.trim() || digits.length !== 9 || !owner.trim() || !!duplicates?.blocking || (needsConfirm && !confirmDup)}>{t('Yaratish')}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** U12.3: do‘konlar ro‘yxati. `preset="review"` — «Tasdiqlash» navbati (PENDING_REVIEW). */
export function AdminShopsPage({ preset }: { preset?: 'review' }) {
  const navigate = useNavigate();
  const me = useMe();
  const [filters, setFilters] = useState<AdminShopFilters>(preset === 'review' ? { status: 'PENDING_REVIEW' } : {});
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => ({ ...current, search: search.trim() || undefined, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useQuery({ queryKey: ['admin', 'shops', filters], queryFn: () => adminShopsService.list(filters), placeholderData: keepPreviousData });
  const superAdmin = !!me.data?.isSuperAdmin;

  if (list.isLoading) return <PageLoader />;
  if (list.isError || !list.data) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  const counts = list.data.counts;
  const statuses: Array<ShopStatus | undefined> = [undefined, 'PENDING_REVIEW', 'ACTIVE', 'DRAFT', 'SUSPENDED'];

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div>
          <h1>{preset === 'review' ? t('Tasdiqlash navbati') : t('Do‘konlar')}</h1>
          <p>{preset === 'review' ? t('Tekshiruvga yuborilgan do‘konlar: hujjatlarni ko‘rib, tasdiqlang yoki sabab bilan rad eting.') : t('Barcha do‘konlar, holati va egalari.')}</p>
        </div>
        {superAdmin && preset !== 'review' && <Button onClick={() => setCreating(true)}><Plus size={18} /> {t('Do‘kon yaratish')}</Button>}
      </div>
      <div className="qs-toolbar">
        <Input label={t('Qidirish')} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Nom, STIR yoki telefon')} />
        {preset !== 'review' && (
          <div className="qs-chips" role="group" aria-label={t('Holat')}>
            {statuses.map((status) => (
              <button key={status ?? 'all'} type="button" className={cx('qs-chip', filters.status === status && 'is-on')} onClick={() => setFilters({ ...filters, status, page: 1 })}>
                {status ? SHOP_STATUS[status].label : t('Hammasi')}
                {status && <span>{counts[status] ?? 0}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {!list.data.items.length ? (
        <EmptyState icon={<Store size={30} />} title={preset === 'review' ? t('Navbat bo‘sh') : t('Do‘kon topilmadi')} />
      ) : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Do‘kon')}</th><th>{t('Egasi')}</th><th>{t('Holat')}</th><th>{t('Verifikatsiya')}</th><th className="qs-right">{t('Filial / mahsulot / hujjat')}</th><th>{t('Yaratilgan')}</th></tr></thead>
            <tbody>
              {list.data.items.map((shop) => (
                <tr key={shop.id} className="is-clickable" onClick={() => navigate(`/admin/dokonlar/${shop.id}`)}>
                  <td><div className="qs-cell-title"><strong>{shop.name}</strong><small>{[shop.stir && `STIR ${shop.stir}`, shop.phone].filter(Boolean).join(' · ')}</small></div></td>
                  <td>{shop.owner ? personName(shop.owner) : <Badge tone="warning">{t('Egasiz')}</Badge>}</td>
                  <td><Badge tone={SHOP_STATUS[shop.status].tone}>{SHOP_STATUS[shop.status].label}</Badge></td>
                  <td><Badge tone={VERIFICATION_STATUS[shop.verificationStatus].tone}>{VERIFICATION_STATUS[shop.verificationStatus].label}</Badge></td>
                  <td className="qs-right qs-num">{shop._count.branches} / {shop._count.products} / {shop._count.verificationDocs}</td>
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

