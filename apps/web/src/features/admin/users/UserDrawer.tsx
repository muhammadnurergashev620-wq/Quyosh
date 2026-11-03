import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, ExternalLink, Mail, Phone, Snowflake, Store, Trash2, UserCheck, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/common/UserAvatar';
import { UserActionDialog } from '@/features/admin/components/UserActionDialog';
import { useAdminUserByNumber } from '@/features/admin/hooks/useAdmin';
import type { UserAction } from '@/features/admin/user-actions';
import type { AdminUser } from '@/features/admin/types';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import { describeDevice } from '@/lib/user-agent';
import { USER_STATUS } from './users-ui';
import './UserDrawer.css';
import { t } from '@/i18n';

const MEMBER_ROLE: Record<string, string> = { OWNER: 'Ega', MANAGER: 'Menejer', STAFF: 'Xodim' };

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gm-udr__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/** Foydalanuvchi ro‘yxatidagi qatorni bosganda ochiladigan o‘ng panel: ma’lumot, do‘kon a’zoligi va tezkor amallar. */
export function UserDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const navigate = useNavigate();
  const detail = useAdminUserByNumber(user.accountNumber);
  const [action, setAction] = useState<UserAction | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !action) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, action]);

  const d = detail.data;
  const status = USER_STATUS[(d?.status ?? user.status) as keyof typeof USER_STATUS];
  const name = accountName(d ?? user);
  const roles = d?.roles ?? user.roles;
  const isAdmin = roles.includes('ADMIN');
  const restricted = (d?.status ?? user.status) === 'SUSPENDED' || (d?.status ?? user.status) === 'BLOCKED';
  const deleted = (d?.status ?? user.status) === 'DELETED';
  const phone = d?.phone ?? user.phone;
  const email = d?.email ?? user.email;
  const lastLogin = d?.lastLoginAt ?? user.lastLoginAt ?? null;
  const memberships = d?.shopMemberships ?? user.shopMemberships ?? [];

  return (
    <>
      <div className="gm-udr__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="gm-udr" role="dialog" aria-modal="true" aria-label={t('Foydalanuvchi: {name}', { name })}>
        <header className="gm-udr__head">
          <UserAvatar name={name} seed={user.id} size="lg" src={d?.avatar ?? user.avatar} />
          <div className="gm-udr__who">
            <h2>{name}</h2>
            <div className="gm-udr__badges">
              {status && <Badge tone={status.tone}>{status.label}</Badge>}
              {roles.includes('CUSTOMER') && <Badge tone="primary">{t('Mijoz')}</Badge>}
              {roles.includes('SHOP') && <Badge tone="primary">{t('Do‘kon')}</Badge>}
            </div>
            <p><Phone size={13} aria-hidden="true" /> {phone}</p>
            {email && <p><Mail size={13} aria-hidden="true" /> {email}</p>}
            <p className="gm-udr__id">ID {user.accountNumber}</p>
          </div>
          <button type="button" className="gm-udr__close" onClick={onClose} aria-label={t('Yopish')}>
            <X size={18} />
          </button>
        </header>

        <div className="gm-udr__body">
          {detail.isError && <Alert tone="danger">{getErrorMessage(detail.error)}</Alert>}

          <section className="gm-udr__card">
            <h3>{t('Profil ma’lumotlari')}</h3>
            <Info label={t('To‘liq ism')}>{name}</Info>
            <Info label={t('Telefon')}>{phone} <small>({(d?.phoneVerifiedAt ?? user.phoneVerifiedAt) ? t('tasdiqlangan') : t('tasdiqlanmagan')})</small></Info>
            <Info label={t('Email')}>{email ?? '—'}</Info>
            <Info label="ID">{user.accountNumber}</Info>
            <Info label={t('Ro‘yxatdan o‘tgan')}>{formatDateTime(user.createdAt)} <small>({formatRelativeTime(user.createdAt)})</small></Info>
            <Info label={t('Oxirgi kirish')}>{lastLogin ? <>{formatDateTime(lastLogin)} <small>({formatRelativeTime(lastLogin)})</small></> : t('Hali kirmagan')}</Info>
            {d?.lastSession && <Info label={t('Oxirgi qurilma')}>{`${describeDevice(d.lastSession.userAgent).browser}, ${describeDevice(d.lastSession.userAgent).os}`}{d.lastSession.panel ? ` · ${d.lastSession.panel}` : ''}</Info>}
            {d && <Info label={t('Faol qurilmalar')}>{d.stats.activeDevices}</Info>}
            {d?.account && (
              <>
                <Info label={t('Kirish usullari')}>{[d.account.hasPassword && t('Parol'), d.account.googleLinked && 'Google'].filter(Boolean).join(' · ') || '—'}</Info>
                {d.account.googleEmail && <Info label={t('Google email')}>{d.account.googleEmail}</Info>}
              </>
            )}
            {d && <Info label={t('Ikki bosqichli himoya')}>{d.twoFactorEnabled === false ? t('O‘chirilgan') : t('Yoqilgan')}</Info>}
            {d?.status === 'DELETED' && <Info label={t('O‘chirilgan sana')}>{d.deletedAt ? formatDateTime(d.deletedAt) : '—'}</Info>}
          </section>

          {memberships.length > 0 && (
            <section className="gm-udr__card">
              <h3>{t('Do‘kon a’zoligi')}</h3>
              {memberships.map((item) => (
                <Info key={item.shopId} label={t(MEMBER_ROLE[item.memberRole] ?? item.memberRole)}>
                  <Store size={13} aria-hidden="true" /> {item.shop.name}
                </Info>
              ))}
            </section>
          )}

          <section className="gm-udr__card">
            <h3>{t('Amallar')}</h3>
            <div className="gm-udr__actions">
              <Button variant="secondary" onClick={() => navigate(`/admin/foydalanuvchilar/${user.accountNumber}`)}><ExternalLink size={16} aria-hidden="true" /> {t('Profilni ko‘rish')}</Button>
              {!isAdmin && !deleted && (restricted ? (
                <Button variant="secondary" onClick={() => setAction('ACTIVATE')}><UserCheck size={16} aria-hidden="true" /> {t('Faollashtirish')}</Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setAction('SUSPEND')}><Snowflake size={16} aria-hidden="true" /> {t('Muzlatish')}</Button>
                  <Button variant="secondary" className="gm-udr__danger" onClick={() => setAction('BLOCK')}><Ban size={16} aria-hidden="true" /> {t('Bloklash')}</Button>
                </>
              ))}
              {!isAdmin && !deleted && <Button variant="secondary" className="gm-udr__danger" onClick={() => setAction('DELETE')}><Trash2 size={16} aria-hidden="true" /> {t('O‘chirish')}</Button>}
            </div>
          </section>
        </div>
      </aside>
      {action && <UserActionDialog user={user} action={action} onClose={() => setAction(null)} onDeleted={() => { setAction(null); onClose(); }} />}
    </>
  );
}
