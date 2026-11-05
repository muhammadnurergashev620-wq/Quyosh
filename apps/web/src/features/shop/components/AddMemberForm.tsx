import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { getErrorMessage } from '@/lib/error-messages';
import { t } from '@/i18n';
import { DEFAULT_PERMISSIONS, MEMBER_ROLE } from '../labels';
import { PermissionPicker } from './PermissionPicker';

export interface NewMemberInput {
  firstName: string;
  lastName?: string;
  login: string;
  phone?: string;
  memberRole: 'MANAGER' | 'STAFF';
  permissions: string[];
}
export interface IssuedMember { user: { login?: string | null }; temporaryPassword: string }

const digits = (value: string) => value.replace(/\D/g, '');
const LOGIN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;

/** Xodim qo‘shish: ism, login, ixtiyoriy telefon, rol va ruxsatlar. Hisobni (login + vaqtincha parol) server yaratadi — admin va do‘kon egasi uchun umumiy. */
export function AddMemberForm({ submit, onDone, onCancel }: { submit: (input: NewMemberInput) => Promise<IssuedMember>; onDone: (issued: IssuedMember) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', login: '', phone: '', memberRole: 'STAFF' as 'MANAGER' | 'STAFF' });
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_PERMISSIONS.STAFF);
  const add = useMutation({
    gcTime: 0,
    mutationFn: () =>
      submit({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        login: form.login.trim(),
        phone: digits(form.phone).length === 9 ? `+998${digits(form.phone)}` : undefined,
        memberRole: form.memberRole,
        permissions,
      }),
    onSuccess: onDone,
  });
  return (
    <form className="qs-form" onSubmit={(e) => { e.preventDefault(); add.mutate(); }} noValidate>
      <div className="qs-form__row">
        <Input label={t('Ism')} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required maxLength={100} autoFocus />
        <Input label={t('Familiya (ixtiyoriy)')} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} maxLength={100} />
      </div>
      <Input label={t('Login')} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value.replace(/\s/g, '') })} required maxLength={32} autoCapitalize="none" spellCheck={false} placeholder="masalan: bobur.xodim" hint={t('Lotin harflari, raqamlar va . _ - (3–32 belgi). Vaqtincha parolni tizim yaratadi va bir marta ko‘rsatadi')} />
      <Input label={t('Telefon (ixtiyoriy)')} prefix="+998" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="90 123 45 67" />
      <Select
        label={t('Rol')}
        value={form.memberRole}
        onChange={(e) => { const role = e.target.value as 'MANAGER' | 'STAFF'; setForm({ ...form, memberRole: role }); setPermissions(DEFAULT_PERMISSIONS[role]); }}
        options={[{ value: 'MANAGER', label: MEMBER_ROLE.MANAGER }, { value: 'STAFF', label: MEMBER_ROLE.STAFF }]}
      />
      <PermissionPicker value={permissions} onChange={setPermissions} />
      {add.isError && <Alert tone="danger">{getErrorMessage(add.error)}</Alert>}
      <div className="qs-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('Bekor qilish')}</Button>
        <Button type="submit" loading={add.isPending} disabled={form.firstName.trim().length < 2 || !LOGIN_RE.test(form.login.trim()) || (digits(form.phone).length !== 0 && digits(form.phone).length !== 9)}>{t('Qo‘shish')}</Button>
      </div>
    </form>
  );
}
