import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMe } from '@/features/session/hooks/useMe';
import { accountPath } from '../account-path';
import { t } from '@/i18n';

export function AccountLink({ accountNumber, className, children }: { accountNumber: number; className?: string; children: ReactNode }) {
  const me = useMe();
  const own = accountNumber === me.data?.accountNumber;
  return (
    <Link to={accountPath(accountNumber, me.data?.accountNumber)} className={className} title={own ? t('Mening profilim') : t('Profilni ochish')}>
      {children}
    </Link>
  );
}
