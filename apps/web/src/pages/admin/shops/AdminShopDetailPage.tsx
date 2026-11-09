import { ErrorState } from '@/components/ui/ErrorState';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, KeyRound, Plus, Trash2, UserPlus } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonAnchor } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageLoader } from '@/components/common/PageLoader';
import { adminShopsService, type AdminShopDetail, type BadgeType } from '@/features/admin/shops/service';
import { IssuedCredentials } from '@/features/admin/shops/IssuedCredentials';
import { AddMemberForm } from '@/features/shop/components/AddMemberForm';
import { MEMBER_ROLE, personName, SHOP_STATUS } from '@/features/shop/labels';
import { getErrorMessage } from '@/lib/error-messages';
import { regionName } from '@/lib/regions';
import { env } from '@/lib/env';
import { formatDate, formatDateTime, formatRating } from '@/lib/format';
import { CERT_TYPE } from '@/pages/m7/cert-labels';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import { StatusBadge } from '@/components/ui/StatusBadge';

type Member = AdminShopDetail['members'][number];
interface Issued { title: string; login: string | null; password: string }

/** Xodim qo‘shish: hisob + vaqtincha parol (TZ 3.7.2) — umumiy forma, admin uchun. */
function AddMemberModal({ shopId, onClose, onIssued }: { shopId: string; onClose: () => void; onIssued: (issued: Issued) => void }) {
  return (
    <AddMemberForm
      submit={(input) => adminShopsService.addMember(shopId, input)}
      onCancel={onClose}
      onDone={(data) => onIssued({ title: t('Xodim qo‘shildi'), login: data.user.login ?? null, password: data.temporaryPassword })}
    />
  );
}

/** Belgi qo‘yish: rasmiy diler, sertifikatli montajchi, litsenziya — faqat admin (hujjat shart emas). */
function BadgeForm({ shopId, onDone }: { shopId: string; onDone: () => void }) {
  const [certType, setCertType] = useState<BadgeType>('OFFICIAL_DEALER');
  const [brand, setBrand] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const add = useMutation({
    mutationFn: () => adminShopsService.addBadge(shopId, { certType, brand: brand.trim() || undefined, validUntil: validUntil || undefined }),
    onSuccess: () => { setBrand(''); setValidUntil(''); onDone(); },
  });
  return (
    <form className="qs-form" onSubmit={(e) => { e.preventDefault(); add.mutate(); }} noValidate>
      <div className="qs-form__row">
        <Select label={t('Belgi')} value={certType} onChange={(e) => setCertType(e.target.value as BadgeType)} options={Object.entries(CERT_TYPE).map(([value, label]) => ({ value, label }))} />
        <Input label={t('Brend')} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={120} hint={certType === 'OFFICIAL_DEALER' ? t('Rasmiy diler uchun majburiy') : undefined} required={certType === 'OFFICIAL_DEALER'} />
        <Input label={t('Amal qilish muddati')} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} hint={t('Bo‘sh bo‘lsa — muddatsiz')} />
      </div>
      {add.isError && <Alert tone="danger">{getErrorMessage(add.error)}</Alert>}
      <div className="qs-form__actions">
        <Button type="submit" size="sm" loading={add.isPending} disabled={certType === 'OFFICIAL_DEALER' && !brand.trim()}><Plus size={15} /> {t('Belgi qo‘yish')}</Button>
      </div>
    </form>
  );
}

/** U12.11: do‘kon kartasi — a’zolar (parolni tiklash, egani almashtirish, xodim qo‘shish), belgilar, filiallar, tarix, to‘xtatish. */
export function AdminShopDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const detail = useQuery({ queryKey: ['admin', 'shops', 'detail', id], queryFn: () => adminShopsService.detail(id) });
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [resetting, setResetting] = useState<Member | null>(null);
  const [newOwner, setNewOwner] = useState<Member | null>(null);
  const [ownerReason, setOwnerReason] = useState('');
  const [removingBadge, setRemovingBadge] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'shops'] });
  const suspend = useMutation({
    mutationFn: () => adminShopsService.suspend(id, reason.trim()),
    onSuccess: () => { pushToast(t('Saqlandi'), 'success'); setSuspending(false); setReason(''); refresh(); },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
  const resume = useMutation({
    mutationFn: () => adminShopsService.resume(id),
    onSuccess: () => { pushToast(t('Saqlandi'), 'success'); refresh(); },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
  const reset = useMutation({
    gcTime: 0,
    mutationFn: (member: Member) => adminShopsService.resetPassword(id, member.user.id),
    onSuccess: (data) => { setResetting(null); setIssued({ title: t('Yangi vaqtincha parol'), login: data.user.login ?? null, password: data.temporaryPassword }); refresh(); },
    onError: (error) => { setResetting(null); pushToast(getErrorMessage(error), 'error'); },
  });
  const changeOwner = useMutation({
    mutationFn: (member: Member) => adminShopsService.changeOwner(id, member.user.id, ownerReason.trim()),
    onSuccess: () => { pushToast(t('Ega almashtirildi'), 'success'); setNewOwner(null); setOwnerReason(''); refresh(); },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
  const removeBadge = useMutation({
    mutationFn: (badgeId: string) => adminShopsService.removeBadge(id, badgeId),
    onSuccess: () => { setRemovingBadge(null); refresh(); },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });

  if (detail.isLoading) return <PageLoader />;
  if (detail.isError || !detail.data) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  const shop = detail.data;
  const owner = shop.members.find((member) => member.memberRole === 'OWNER');

  return (
    <div className="qs-page">
      <Link to="/admin/dokonlar" className="qs-muted qs-inline-flex qs-gap-2 qs-items-center"><ArrowLeft size={16} /> {t('Do‘konlar')}</Link>
      <div className="qs-page__head">
        <div>
          <h1>{shop.name}</h1>
          <p>{[shop.stir && `STIR ${shop.stir}`, shop.phone, shop.email].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="qs-page__actions">
          <StatusBadge map={SHOP_STATUS} status={shop.status} />
        </div>
      </div>

      <div className="qs-page__actions">
        <Button variant="secondary" onClick={() => setAddingMember(true)}><UserPlus size={16} /> {t('Xodim qo‘shish')}</Button>
        {shop.status === 'ACTIVE' && <Button variant="danger" onClick={() => setSuspending(true)}>{t('To‘xtatish')}</Button>}
        {shop.status === 'SUSPENDED' && <Button loading={resume.isPending} onClick={() => resume.mutate()}>{t('Qayta faollashtirish')}</Button>}
        {shop.status === 'ACTIVE' && <ButtonAnchor variant="ghost" href={`${env.customerUrl.replace(/\/mijoz\/?$/, '')}/mijoz/dokonlar/${shop.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> {t('Do‘kon profili')}</ButtonAnchor>}
      </div>
      {shop.status === 'SUSPENDED' && shop.suspendReason && <Alert tone="danger" title={t('To‘xtatilgan')}>{shop.suspendReason}</Alert>}

      <div className="qs-grid-2">
        <section className="qs-card">
          <header><h2>{t('A’zolar va parollar')}</h2></header>
          <ul className="qs-list">
            {shop.members.map((member) => (
              <li key={member.id}>
                <div>
                  <Link to={`/admin/foydalanuvchilar/${member.user.id}`}><strong>{personName(member.user)}</strong></Link>
                  <small>{[member.user.login, member.user.phone].filter(Boolean).join(' · ') || member.user.email}{member.user.mustPasswordChange ? ` · ${t('vaqtincha parol hali almashtirilmagan')}` : ''}</small>
                </div>
                <Badge tone={member.memberRole === 'OWNER' ? 'primary' : 'neutral'}>{MEMBER_ROLE[member.memberRole]}</Badge>
                <span className="qs-page__actions">
                  <Button size="sm" variant="secondary" onClick={() => setResetting(member)}><KeyRound size={14} /> {t('Parolni tiklash')}</Button>
                  {member.memberRole !== 'OWNER' && <Button size="sm" variant="ghost" onClick={() => setNewOwner(member)}>{t('Ega qilish')}</Button>}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="qs-card">
          <header><h2>{t('Belgilar')}</h2></header>
          {!shop.certifications.length ? <p className="qs-muted">{t('Belgi qo‘yilmagan.')}</p> : (
            <ul className="qs-list">
              {shop.certifications.map((badge) => (
                <li key={badge.id}>
                  <div>
                    <strong>{CERT_TYPE[badge.certType]}{badge.brand ? `: ${badge.brand}` : ''}</strong>
                    <small>{badge.validUntil ? t('{date} gacha', { date: formatDate(badge.validUntil) }) : t('Muddatsiz')}</small>
                  </div>
                  <Badge tone={badge.status === 'APPROVED' ? 'success' : 'neutral'}>{badge.status === 'APPROVED' ? t('Faol') : t('Muddati o‘tgan')}</Badge>
                  <Button size="sm" variant="ghost" aria-label={t('Olib tashlash')} onClick={() => setRemovingBadge(badge.id)}><Trash2 size={14} /></Button>
                </li>
              ))}
            </ul>
          )}
          <BadgeForm shopId={shop.id} onDone={refresh} />
        </section>
        <section className="qs-card">
          <header><h2>{t('Ma’lumotlar')}</h2></header>
          <dl className="qs-dl">
            <dt>{t('Manzil (slug)')}</dt><dd className="qs-mono">{shop.slug}</dd>
            <dt>{t('Yaratilgan')}</dt><dd>{formatDateTime(shop.createdAt)} · {shop.createdSource === 'ADMIN' ? t('admin') : t('o‘zi (eski)')}{shop.createdBy ? ` (${personName(shop.createdBy)})` : ''}</dd>
            <dt>{t('Mahsulotlar')}</dt><dd>{shop._count.products}</dd>
            <dt>{t('Xizmatlar')}</dt><dd>{shop._count.services}</dd>
            <dt>{t('Reyting')}</dt><dd>{formatRating(shop.ratingAvg)} ({shop.ratingCount})</dd>
          </dl>
          {shop.description && <p className="qs-mb-0 qs-pre-line">{shop.description}</p>}
        </section>
        <section className="qs-card">
          <header><h2>{t('Filiallar')}</h2></header>
          {!shop.branches.length ? <p className="qs-muted">{t('Filial yo‘q.')}</p> : (
            <ul className="qs-list">
              {shop.branches.map((branch) => <li key={branch.id}><div><strong>{branch.name}</strong><small>{[regionName(branch.regionCode), branch.address].filter(Boolean).join(' · ')}</small></div></li>)}
            </ul>
          )}
        </section>
      </div>

      <section className="qs-card">
        <header><h2>{t('Tarix')}</h2></header>
        <ol className="qs-timeline">
          {shop.history.map((entry) => (
            <li key={entry.id}>
              <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
              <span><code>{entry.action}</code>{entry.actor ? ` — ${personName(entry.actor)}` : ''}{entry.reason ? `: ${entry.reason}` : ''}</span>
            </li>
          ))}
        </ol>
      </section>

      <Modal open={addingMember} onClose={() => setAddingMember(false)} title={t('Xodim qo‘shish')} large>
        {addingMember && <AddMemberModal shopId={shop.id} onClose={() => setAddingMember(false)} onIssued={(value) => { setAddingMember(false); setIssued(value); refresh(); }} />}
      </Modal>
      <Modal open={!!issued} onClose={() => undefined} dismissible={false} title={issued?.title ?? ''}>
        {issued && <IssuedCredentials title={issued.title} login={issued.login} password={issued.password} onClose={() => setIssued(null)} />}
      </Modal>
      <Modal open={suspending} onClose={() => setSuspending(false)} title={t('Do‘konni to‘xtatish')}>
        <div className="qs-form">
          <Textarea label={t('Sabab')} value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={2000} autoFocus />
          <div className="qs-form__actions">
            <Button variant="ghost" onClick={() => setSuspending(false)}>{t('Bekor qilish')}</Button>
            <Button variant="danger" loading={suspend.isPending} disabled={reason.trim().length < 3} onClick={() => suspend.mutate()}>{t('To‘xtatish')}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={!!newOwner} onClose={() => setNewOwner(null)} title={t('Egani almashtirish')}>
        {newOwner && (
          <div className="qs-form">
            <Alert tone="warning">{t('{name} do‘kon egasi bo‘ladi, hozirgi ega ({old}) menejerga aylanadi.', { name: personName(newOwner.user), old: owner ? personName(owner.user) : '—' })}</Alert>
            <Textarea label={t('Sabab')} value={ownerReason} onChange={(e) => setOwnerReason(e.target.value)} rows={3} maxLength={2000} autoFocus />
            <div className="qs-form__actions">
              <Button variant="ghost" onClick={() => setNewOwner(null)}>{t('Bekor qilish')}</Button>
              <Button loading={changeOwner.isPending} disabled={ownerReason.trim().length < 3} onClick={() => changeOwner.mutate(newOwner)}>{t('Almashtirish')}</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={!!resetting}
        title={t('Parolni qayta tiklash')}
        description={t('{name} uchun yangi vaqtincha parol yaratiladi, barcha qurilmalardan chiqariladi va birinchi kirishda parolni almashtiradi.', { name: resetting ? personName(resetting.user) : '' })}
        confirmLabel={t('Tiklash')}
        showCancel
        cancelLabel={t('Bekor qilish')}
        loading={reset.isPending}
        onConfirm={() => resetting && reset.mutate(resetting)}
        onCancel={() => setResetting(null)}
      />
      <ConfirmDialog
        open={!!removingBadge}
        title={t('Belgini olib tashlash')}
        description={t('Belgi do‘kon profilidan yo‘qoladi.')}
        confirmLabel={t('Olib tashlash')}
        tone="danger"
        showCancel
        cancelLabel={t('Bekor qilish')}
        loading={removeBadge.isPending}
        onConfirm={() => removingBadge && removeBadge.mutate(removingBadge)}
        onCancel={() => setRemovingBadge(null)}
      />
    </div>
  );
}
