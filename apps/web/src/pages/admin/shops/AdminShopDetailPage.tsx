import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { PageLoader } from '@/components/common/PageLoader';
import { adminShopsService } from '@/features/admin/shops/service';
import { mediaService } from '@/features/media/services/media.service';
import { DOC_TYPE, MEMBER_ROLE, personName, SHOP_STATUS, VERIFICATION_STATUS } from '@/features/shop/labels';
import type { InvitationResult } from '@/features/shop/types';
import { useMe } from '@/features/session/hooks/useMe';
import { getErrorMessage } from '@/lib/error-messages';
import { regionName } from '@/lib/regions';
import { env } from '@/lib/env';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import '@/features/shop/shop.css';

type ReasonAction = 'reject' | 'suspend';

function openDocument(fileId: string, onError: (message: string) => void) {
  // Brauzer popup blokerini chetlab o‘tish: oynani darhol ochib, manzilni keyin beramiz.
  const tab = window.open('about:blank', '_blank');
  mediaService
    .getSignedUrl(fileId, 'original')
    .then((result) => {
      if (tab) tab.location.href = result.url;
    })
    .catch((error: unknown) => {
      tab?.close();
      onError(getErrorMessage(error));
    });
}

/** U12.3: do‘kon kartasi — hujjatlar, a’zolar, filiallar, tarix va holat amallari. */
export function AdminShopDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const me = useMe();
  const superAdmin = !!me.data?.isSuperAdmin;
  const detail = useQuery({ queryKey: ['admin', 'shops', 'detail', id], queryFn: () => adminShopsService.detail(id) });
  const [reasonFor, setReasonFor] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState('');
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerTarget, setOwnerTarget] = useState('');
  const [invite, setInvite] = useState<InvitationResult | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'shops'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'badges'] });
  };
  const action = useMutation({
    mutationFn: (kind: 'approve' | 'resume' | ReasonAction) => {
      if (kind === 'approve') return adminShopsService.approve(id);
      if (kind === 'resume') return adminShopsService.resume(id);
      if (kind === 'reject') return adminShopsService.reject(id, reason.trim());
      return adminShopsService.suspend(id, reason.trim());
    },
    onSuccess: () => {
      pushToast(t('Saqlandi'), 'success');
      setReasonFor(null);
      setReason('');
      refresh();
    },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
  const ownerInvite = useMutation({
    mutationFn: () => adminShopsService.inviteOwner(id, ownerTarget.trim()),
    onSuccess: (result) => {
      setInvite(result);
      setOwnerOpen(false);
      setOwnerTarget('');
      refresh();
    },
  });

  if (detail.isLoading) return <PageLoader />;
  if (detail.isError || !detail.data) return <Alert tone="danger">{getErrorMessage(detail.error)}</Alert>;
  const shop = detail.data;
  const owner = shop.members.find((member) => member.memberRole === 'OWNER');

  return (
    <div className="qs-page">
      <Link to="/admin/dokonlar" className="qs-muted" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={16} /> {t('Do‘konlar')}</Link>
      <div className="qs-page__head">
        <div>
          <h1>{shop.name}</h1>
          <p>{[shop.stir && `STIR ${shop.stir}`, shop.phone, shop.email].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="qs-page__actions">
          <Badge tone={SHOP_STATUS[shop.status].tone}>{SHOP_STATUS[shop.status].label}</Badge>
          <Badge tone={VERIFICATION_STATUS[shop.verificationStatus].tone}>{VERIFICATION_STATUS[shop.verificationStatus].label}</Badge>
        </div>
      </div>

      <div className="qs-page__actions">
        {shop.status === 'PENDING_REVIEW' && (
          <>
            <Button loading={action.isPending && action.variables === 'approve'} disabled={!owner} onClick={() => action.mutate('approve')}>{t('Tasdiqlash')}</Button>
            <Button variant="danger" onClick={() => setReasonFor('reject')}>{t('Rad etish')}</Button>
          </>
        )}
        {superAdmin && shop.status === 'DRAFT' && owner && <Button variant="secondary" onClick={() => action.mutate('approve')}>{t('Faollashtirish')}</Button>}
        {superAdmin && shop.status === 'ACTIVE' && <Button variant="danger" onClick={() => setReasonFor('suspend')}>{t('To‘xtatish')}</Button>}
        {superAdmin && shop.status === 'SUSPENDED' && <Button onClick={() => action.mutate('resume')}>{t('Qayta faollashtirish')}</Button>}
        {superAdmin && <Button variant="secondary" onClick={() => setOwnerOpen(true)}>{owner ? t('Egalikni o‘tkazish') : t('Egaga taklif yuborish')}</Button>}
        {shop.status === 'ACTIVE' && <a className="gm-button gm-button--ghost gm-button--md" href={`${env.customerUrl.replace(/\/mijoz\/?$/, '')}/mijoz/dokonlar/${shop.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> {t('Ochiq sahifa')}</a>}
      </div>
      {!owner && <Alert tone="warning">{t('Do‘konning egasi yo‘q: egasi taklifni qabul qilmaguncha do‘kon faollashmaydi.')}</Alert>}
      {shop.status === 'SUSPENDED' && shop.suspendReason && <Alert tone="danger" title={t('To‘xtatilgan')}>{shop.suspendReason}</Alert>}
      {invite && (
        <Alert tone="success" title={t('Taklif yuborildi')}>
          {invite.target}{invite.developmentLink && <><br /><code style={{ overflowWrap: 'anywhere' }}>{invite.developmentLink}</code></>}
        </Alert>
      )}

      <div className="qs-grid-2">
        <section className="qs-card">
          <header><h2>{t('Verifikatsiya hujjatlari')}</h2></header>
          {!shop.verificationDocs.length ? <p className="qs-muted">{t('Hujjat yuklanmagan.')}</p> : (
            <ul className="qs-list">
              {shop.verificationDocs.map((doc) => (
                <li key={doc.id}>
                  <div><strong>{DOC_TYPE[doc.docType]}</strong><small>{formatDateTime(doc.createdAt)}{doc.reason ? ` · ${doc.reason}` : ''}</small></div>
                  <Badge tone={doc.status === 'ACCEPTED' ? 'success' : doc.status === 'REJECTED' ? 'danger' : 'warning'}>{doc.status === 'ACCEPTED' ? t('Qabul qilingan') : doc.status === 'REJECTED' ? t('Rad etilgan') : t('Kutilmoqda')}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => openDocument(doc.fileId, (message) => pushToast(message, 'error'))}><ExternalLink size={14} /> {t('Ochish')}</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="qs-card">
          <header><h2>{t('Ma’lumotlar')}</h2></header>
          <dl className="qs-dl">
            <dt>{t('Manzil (slug)')}</dt><dd className="qs-mono">{shop.slug}</dd>
            <dt>{t('Yaratilgan')}</dt><dd>{formatDateTime(shop.createdAt)} · {shop.createdSource === 'ADMIN' ? t('admin') : t('o‘zi')}{shop.createdBy ? ` (${personName(shop.createdBy)})` : ''}</dd>
            <dt>{t('Mahsulotlar')}</dt><dd>{shop._count.products}</dd>
            <dt>{t('Xizmatlar')}</dt><dd>{shop._count.services}</dd>
            <dt>{t('Reyting')}</dt><dd>{Number(shop.ratingAvg).toFixed(1)} ({shop.ratingCount})</dd>
          </dl>
          {shop.description && <p style={{ marginBottom: 0, whiteSpace: 'pre-line' }}>{shop.description}</p>}
        </section>
        <section className="qs-card">
          <header><h2>{t('A’zolar')}</h2></header>
          <ul className="qs-list">
            {shop.members.map((member) => (
              <li key={member.id}>
                <div><Link to={`/admin/foydalanuvchilar/${member.user.id}`}><strong>{personName(member.user)}</strong></Link><small>{member.user.phone ?? member.user.email}</small></div>
                <Badge tone={member.memberRole === 'OWNER' ? 'primary' : 'neutral'}>{MEMBER_ROLE[member.memberRole]}</Badge>
              </li>
            ))}
            {shop.invitations.map((invitation) => (
              <li key={invitation.id}>
                <div><strong>{invitation.target}</strong><small>{t('Taklif · {date} gacha', { date: formatDate(invitation.expiresAt) })}</small></div>
                <Badge tone="warning">{MEMBER_ROLE[invitation.memberRole]}</Badge>
              </li>
            ))}
          </ul>
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

      <Modal open={!!reasonFor} onClose={() => setReasonFor(null)} title={reasonFor === 'reject' ? t('Tekshiruvni rad etish') : t('Do‘konni to‘xtatish')}>
        <div className="qs-form">
          <Textarea label={t('Sabab')} value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={2000} hint={reasonFor === 'reject' ? t('Do‘kon egasi shu matnni ko‘radi va kamchiliklarni tuzatadi') : undefined} autoFocus />
          <div className="qs-form__actions">
            <Button variant="ghost" onClick={() => setReasonFor(null)}>{t('Bekor qilish')}</Button>
            <Button variant="danger" loading={action.isPending} disabled={reason.trim().length < 3} onClick={() => reasonFor && action.mutate(reasonFor)}>{t('Tasdiqlash')}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={ownerOpen} onClose={() => setOwnerOpen(false)} title={owner ? t('Egalikni o‘tkazish') : t('Egaga taklif yuborish')}>
        <div className="qs-form">
          {owner && <Alert tone="warning">{t('Yangi ega taklifni qabul qilganda hozirgi ega ({name}) menejer bo‘ladi.', { name: personName(owner.user) })}</Alert>}
          <Input label={t('Telefon yoki email')} value={ownerTarget} onChange={(e) => setOwnerTarget(e.target.value)} autoFocus />
          {ownerInvite.isError && <Alert tone="danger">{getErrorMessage(ownerInvite.error)}</Alert>}
          <div className="qs-form__actions">
            <Button variant="ghost" onClick={() => setOwnerOpen(false)}>{t('Bekor qilish')}</Button>
            <Button loading={ownerInvite.isPending} disabled={ownerTarget.trim().length < 5} onClick={() => ownerInvite.mutate()}>{t('Taklif yuborish')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
