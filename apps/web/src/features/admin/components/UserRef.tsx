import { accountName } from '@/lib/account-name';
import { useAdminUser } from '../hooks/useAdmin';
import { AccountLink } from './AccountLink';
import { t } from '@/i18n';

/** Ichki UUID o‘rniga foydalanuvchining ismi va raqamli ID sini ko‘rsatadi (bosilsa profili ochiladi). */
export function UserRef({ id }: { id: string | null | undefined }) {
  const user = useAdminUser(id ?? undefined);
  if (!id) return <span>—</span>;
  if (!user.data) return <span>{user.isError ? t('Noma’lum foydalanuvchi') : '…'}</span>;
  return (
    <AccountLink accountNumber={user.data.accountNumber} className="gm-userref">{t('{accountName} · ID {accountNumber}', { accountName: accountName(user.data), accountNumber: user.data.accountNumber })}</AccountLink>
  );
}
