import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageLoader } from '@/components/common/PageLoader';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useCurrentShop } from '@/features/shop/current-shop';
import { useShopMembers, useShopMutation } from '@/features/shop/hooks';
import { shopService } from '@/features/shop/shop.service';
import { AddMemberForm } from '@/features/shop/components/AddMemberForm';
import { IssuedCredentials } from '@/features/admin/shops/IssuedCredentials';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, UserPlus } from 'lucide-react';
import { PermissionPicker } from '@/features/shop/components/PermissionPicker';
import { DEFAULT_PERMISSIONS, MEMBER_ROLE, personName } from '@/features/shop/labels';
import type { ShopMember } from '@/features/shop/types';
import { getErrorMessage } from '@/lib/error-messages';
import { t } from '@/i18n';
import '@/features/shop/shop.css';

function MemberForm({ initial, loading, onSubmit, onCancel }: { initial: ShopMember; loading: boolean; onSubmit: (input: { memberRole: 'MANAGER' | 'STAFF'; permissions: string[] }) => void; onCancel: () => void }) {
  const [memberRole, setMemberRole] = useState<'MANAGER' | 'STAFF'>(initial.memberRole as 'MANAGER' | 'STAFF');
  const [permissions, setPermissions] = useState<string[]>(initial.permissions ?? DEFAULT_PERMISSIONS.STAFF);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ memberRole, permissions });
  }
  return (
    <form className="qs-form" onSubmit={submit} noValidate>
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
      <div className="qs-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('Bekor qilish')}</Button>
        <Button type="submit" loading={loading}>{t('Saqlash')}</Button>
      </div>
    </form>
  );
}

/** U11.15: xodimlar va ruxsatlar. Egasi yangi xodim qo‘shadi (login + vaqtincha parol) va parolini tiklaydi; OWNER bitta va o‘zgartirilmaydi. */
export function ShopMembersPage() {
  const { shopId, shop } = useCurrentShop();
  const isOwner = shop?.memberRole === 'OWNER';
  const members = useShopMembers(shopId, isOwner);
  const [editing, setEditing] = useState<ShopMember | null>(null);
  const [removing, setRemoving] = useState<ShopMember | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<ShopMember | null>(null);
  const [issued, setIssued] = useState<{ title: string; login: string | null; password: string } | null>(null);
  const queryClient = useQueryClient();
  const reset = useShopMutation(shopId, (id, userId: string) => shopService.resetMemberPassword(id, userId));
  const update = useShopMutation(shopId, (id, vars: { memberId: string; memberRole: 'MANAGER' | 'STAFF'; permissions: string[] }) => shopService.updateMember(id, vars.memberId, vars), { success: t('Saqlandi') });
  const remove = useShopMutation(shopId, (id, memberId: string) => shopService.removeMember(id, memberId), { success: t('Xodim chiqarildi') });

  if (!isOwner) return <Alert tone="info">{t('Xodimlarni faqat do‘kon egasi boshqaradi.')}</Alert>;
  if (members.isLoading) return <PageLoader />;
  if (members.isError || !members.data) return <Alert tone="danger">{getErrorMessage(members.error)}</Alert>;

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Xodimlar')}</h1><p>{t('Har bir xodimga faqat kerakli bo‘limlarni oching.')}</p></div>
        <Button onClick={() => setAdding(true)}><UserPlus size={16} aria-hidden="true" /> {t('Yangi xodim qo‘shish')}</Button>
      </div>
      <ul className="qs-list">
        {members.data.members.map((member) => (
          <li key={member.id}>
            <UserAvatar name={personName(member.user)} seed={member.user.id} src={member.user.avatarAssetId ? `/avatars/${member.user.avatarAssetId}` : null} />
            <div>
              <strong>{personName(member.user)}</strong>
              <small>{[member.user.login, member.user.phone, member.user.email].filter(Boolean).join(' · ')}{member.user.mustPasswordChange ? ` · ${t('vaqtincha parol hali almashtirilmagan')}` : ''}</small>
              {member.memberRole !== 'OWNER' && <small>{t('{n} ta ruxsat', { n: member.permissions.length })}</small>}
            </div>
            <Badge tone={member.memberRole === 'OWNER' ? 'primary' : 'neutral'}>{MEMBER_ROLE[member.memberRole]}</Badge>
            {member.memberRole !== 'OWNER' && (
              <span className="qs-page__actions">
                <Button size="sm" variant="secondary" onClick={() => setEditing(member)}>{t('Ruxsatlar')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setResetting(member)}><KeyRound size={14} aria-hidden="true" /> {t('Parolni tiklash')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(member)}>{t('Chiqarish')}</Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? personName(editing.user) : ''} large>
        {editing && (
          <MemberForm initial={editing} loading={update.isPending} onCancel={() => setEditing(null)} onSubmit={({ memberRole, permissions }) => update.mutate({ memberId: editing.id, memberRole, permissions }, { onSuccess: () => setEditing(null) })} />
        )}
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title={t('Yangi xodim qo‘shish')} large>
        {adding && (
          <AddMemberForm
            submit={(input) => shopService.addMember(shopId!, input)}
            onCancel={() => setAdding(false)}
            onDone={(data) => {
              setAdding(false);
              setIssued({ title: t('Xodim qo‘shildi'), login: data.user.login ?? null, password: data.temporaryPassword });
              void queryClient.invalidateQueries({ queryKey: ['shop'] });
              void members.refetch();
            }}
          />
        )}
      </Modal>
      <Modal open={!!issued} onClose={() => undefined} title={issued?.title ?? ''} dismissible={false}>
        {issued && <IssuedCredentials title={issued.title} login={issued.login} password={issued.password} onClose={() => setIssued(null)} />}
      </Modal>
      <ConfirmDialog
        open={!!resetting}
        title={t('Parolni qayta tiklash')}
        description={t('{name} uchun yangi vaqtincha parol yaratiladi, barcha qurilmalardan chiqariladi va birinchi kirishda parolni almashtiradi.', { name: resetting ? personName(resetting.user) : '' })}
        confirmLabel={t('Tiklash')}
        showCancel
        cancelLabel={t('Bekor qilish')}
        loading={reset.isPending}
        onConfirm={() =>
          resetting &&
          reset.mutate(resetting.user.id, {
            onSuccess: (data) => {
              setResetting(null);
              setIssued({ title: t('Yangi vaqtincha parol'), login: data.user.login ?? resetting.user.login ?? null, password: data.temporaryPassword });
              void members.refetch();
            },
          })
        }
        onCancel={() => setResetting(null)}
      />
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
