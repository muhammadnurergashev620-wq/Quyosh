import { useState } from 'react';
import type { FormEvent } from 'react';
import { Copy, UserPlus, Users } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useCurrentShop } from '@/features/shop/current-shop';
import { useShopMembers, useShopMutation } from '@/features/shop/hooks';
import { shopService } from '@/features/shop/shop.service';
import { DEFAULT_PERMISSIONS, MEMBER_ROLE, PERMISSION_GROUPS, personName } from '@/features/shop/labels';
import type { InvitationResult, ShopMember } from '@/features/shop/types';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import '@/features/shop/shop.css';

function PermissionPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((item) => item !== key) : [...value, key]);
  return (
    <div className="qs-perm-groups">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.title}>
          <legend>{group.title}</legend>
          {group.items.map((item) => (
            <label key={item.key} className="qs-check">
              <input type="checkbox" checked={value.includes(item.key)} onChange={() => toggle(item.key)} /> {item.label}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function MemberForm({ initial, loading, onSubmit, onCancel, invite }: { initial?: ShopMember; loading: boolean; invite?: boolean; onSubmit: (input: { target: string; memberRole: 'MANAGER' | 'STAFF'; permissions: string[] }) => void; onCancel: () => void }) {
  const [target, setTarget] = useState('');
  const [memberRole, setMemberRole] = useState<'MANAGER' | 'STAFF'>((initial?.memberRole as 'MANAGER' | 'STAFF') ?? 'STAFF');
  const [permissions, setPermissions] = useState<string[]>(initial?.permissions ?? DEFAULT_PERMISSIONS.STAFF);
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (invite && target.trim().length < 5) return setError(t('Telefon raqami yoki emailni kiriting'));
    setError('');
    onSubmit({ target: target.trim(), memberRole, permissions });
  }
  return (
    <form className="qs-form" onSubmit={submit} noValidate>
      {invite && <Input label={t('Telefon yoki email')} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="+998 90 123 45 67" autoFocus hint={t('Taklif havolasi SMS yoki email orqali yuboriladi, 7 kun amal qiladi')} />}
      <Select
        label={t('Rol')}
        value={memberRole}
        onChange={(e) => {
          const role = e.target.value as 'MANAGER' | 'STAFF';
          setMemberRole(role);
          setPermissions(DEFAULT_PERMISSIONS[role]);
        }}
        options={[{ value: 'MANAGER', label: MEMBER_ROLE.MANAGER }, { value: 'STAFF', label: MEMBER_ROLE.STAFF }]}
      />
      <PermissionPicker value={permissions} onChange={setPermissions} />
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="qs-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('Bekor qilish')}</Button>
        <Button type="submit" loading={loading}>{invite ? t('Taklif yuborish') : t('Saqlash')}</Button>
      </div>
    </form>
  );
}

/** U11.15: xodimlar, takliflar va ruxsatlar. OWNER bitta va o‘zgartirilmaydi. */
export function ShopMembersPage() {
  const { shopId, shop } = useCurrentShop();
  const isOwner = shop?.memberRole === 'OWNER';
  const members = useShopMembers(shopId, isOwner);
  const pushToast = useAppStore((s) => s.pushToast);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<ShopMember | null>(null);
  const [removing, setRemoving] = useState<ShopMember | null>(null);
  const [sent, setSent] = useState<InvitationResult | null>(null);
  const invite = useShopMutation(shopId, shopService.invite);
  const update = useShopMutation(shopId, (id, vars: { memberId: string; memberRole: 'MANAGER' | 'STAFF'; permissions: string[] }) => shopService.updateMember(id, vars.memberId, vars), { success: t('Saqlandi') });
  const remove = useShopMutation(shopId, (id, memberId: string) => shopService.removeMember(id, memberId), { success: t('Xodim chiqarildi') });
  const revoke = useShopMutation(shopId, (id, invitationId: string) => shopService.revokeInvitation(id, invitationId), { success: t('Taklif bekor qilindi') });

  if (!isOwner) return <Alert tone="info">{t('Xodimlarni faqat do‘kon egasi boshqaradi.')}</Alert>;
  if (members.isLoading) return <PageLoader />;
  if (members.isError || !members.data) return <Alert tone="danger">{getErrorMessage(members.error)}</Alert>;

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Xodimlar')}</h1><p>{t('Har bir xodimga faqat kerakli bo‘limlarni oching.')}</p></div>
        <Button onClick={() => setInviting(true)}><UserPlus size={18} /> {t('Xodim taklif qilish')}</Button>
      </div>
      {sent && (
        <Alert tone="success" title={t('Taklif yuborildi')}>
          {t('{target} manziliga taklif yuborildi. Muddati: {date}.', { target: sent.target, date: formatDate(sent.expiresAt) })}
          {sent.developmentLink && (
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <code style={{ overflowWrap: 'anywhere' }}>{sent.developmentLink}</code>
              <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(sent.developmentLink!).then(() => pushToast(t('Nusxa olindi'), 'success'))}>
                <Copy size={14} /> {t('Nusxa')}
              </Button>
            </span>
          )}
        </Alert>
      )}
      <ul className="qs-list">
        {members.data.members.map((member) => (
          <li key={member.id}>
            <UserAvatar name={personName(member.user)} seed={member.user.id} src={member.user.avatarAssetId ? `/avatars/${member.user.avatarAssetId}` : null} />
            <div>
              <strong>{personName(member.user)}</strong>
              <small>{[member.user.phone, member.user.email].filter(Boolean).join(' · ')}</small>
              {member.memberRole !== 'OWNER' && <small>{t('{n} ta ruxsat', { n: member.permissions.length })}</small>}
            </div>
            <Badge tone={member.memberRole === 'OWNER' ? 'primary' : 'neutral'}>{MEMBER_ROLE[member.memberRole]}</Badge>
            {member.memberRole !== 'OWNER' && (
              <span className="qs-page__actions">
                <Button size="sm" variant="secondary" onClick={() => setEditing(member)}>{t('Ruxsatlar')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(member)}>{t('Chiqarish')}</Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <section className="qs-card">
        <header><h2>{t('Kutilayotgan takliflar')}</h2></header>
        {!members.data.invitations.length ? (
          <EmptyState icon={<Users size={28} />} title={t('Kutilayotgan taklif yo‘q')} />
        ) : (
          <ul className="qs-list">
            {members.data.invitations.map((invitation) => (
              <li key={invitation.id}>
                <div><strong>{invitation.target}</strong><small>{MEMBER_ROLE[invitation.memberRole]} · {t('{date} gacha', { date: formatDate(invitation.expiresAt) })}</small></div>
                {invitation.purpose === 'MEMBER' && <Button size="sm" variant="ghost" loading={revoke.isPending && revoke.variables === invitation.id} onClick={() => revoke.mutate(invitation.id)}>{t('Bekor qilish')}</Button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={inviting} onClose={() => setInviting(false)} title={t('Xodim taklif qilish')} large>
        {inviting && (
          <MemberForm invite loading={invite.isPending} onCancel={() => setInviting(false)} onSubmit={(input) => invite.mutate(input, { onSuccess: (result) => { setSent(result); setInviting(false); } })} />
        )}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? personName(editing.user) : ''} large>
        {editing && (
          <MemberForm initial={editing} loading={update.isPending} onCancel={() => setEditing(null)} onSubmit={({ memberRole, permissions }) => update.mutate({ memberId: editing.id, memberRole, permissions }, { onSuccess: () => setEditing(null) })} />
        )}
      </Modal>
      <ConfirmDialog
        open={!!removing}
        title={t('Xodimni chiqarish')}
        description={t('{name} do‘kon paneliga kira olmaydi.', { name: removing ? personName(removing.user) : '' })}
        confirmLabel={t('Chiqarish')}
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
