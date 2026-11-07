import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Clock, KeyRound, LogOut, Mail, Phone, Settings } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/format';
import { LogoutDialog } from '@/features/auth/components/LogoutDialog';
import { AvatarEditor } from '@/features/profile/AvatarEditor';
import { ChangePasswordDialog } from '@/features/admin/profile/ChangePasswordDialog';
import { NameForm } from '@/features/admin/profile/NameForm';
import { useMe } from '@/features/session/hooks/useMe';
import '@/pages/admin/AdminProfilePage.css';
import { t } from '@/i18n';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gm-aprof__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/** Mijoz profili: rasm, ism, telefon, email va parol. Til, qurilmalar, himoya va hujjatlar — «Sozlamalar»da. */
export function CustomerProfilePage() {
  const navigate = useNavigate();
  const me = useMe();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  if (me.isLoading) return <PageLoader label={t('Profil yuklanmoqda…')} />;
  if (me.isError || !me.data) return <Alert tone="danger">{getErrorMessage(me.error)}</Alert>;

  const user = me.data;
  const name = accountName(user);

  return (
    <div className="gm-aprof">
      <section className="gm-aprof__hero">
        <div className="gm-aprof__cover" aria-hidden="true" />
        <div className="gm-aprof__who">
          <span className="gm-aprof__avatar">
            <AvatarEditor name={name} seed={user.id} size="lg" src={user.avatar} canEdit={user.canSetAvatar !== false} />
          </span>
          <div className="gm-aprof__id">
            <h1>{name}</h1>
            <div className="gm-aprof__badges">
              <Badge tone="primary">{t('Mijoz')}</Badge>
              <span className="gm-aprof__num">ID {user.accountNumber}</span>
            </div>
            <p>
              {user.phone && (
                <span><Phone size={14} aria-hidden="true" /> {user.phone}{user.phoneVerifiedAt && <BadgeCheck size={14} className="gm-aprof__ok" aria-label={t('Tasdiqlangan')} />}</span>
              )}
              {user.email && <span><Mail size={14} aria-hidden="true" /> {user.email}</span>}
              {user.createdAt && <span><Clock size={14} aria-hidden="true" /> {t('Qo‘shilgan: {date}', { date: formatDate(user.createdAt) })}</span>}
            </p>
          </div>
          <div className="gm-aprof__quick">
            <Button variant="secondary" onClick={() => navigate('/sozlamalar')}><Settings size={16} aria-hidden="true" /> {t('Sozlamalar')}</Button>
            <Button variant="ghost" className="gm-btn-danger-text" onClick={() => setLogoutOpen(true)}><LogOut size={16} aria-hidden="true" /> {t('Chiqish')}</Button>
          </div>
        </div>
      </section>

      <div className="gm-aprof__grid">
        <section className="gm-aprof__card">
          <h2>{t('Shaxsiy ma’lumotlar')}</h2>
          <NameForm firstName={user.firstName} lastName={user.lastName} />
          <Row label={t('Telefon (login)')}>
            {user.phone ?? '—'} {user.phone && (user.phoneVerifiedAt ? <Badge tone="success">{t('Tasdiqlangan')}</Badge> : <Badge tone="warning">{t('Tasdiqlanmagan')}</Badge>)}
          </Row>
          <Row label="Email">{user.email ?? '—'}</Row>
          <Row label="ID">{user.accountNumber}</Row>
        </section>
        <section className="gm-aprof__card">
          <h2>{t('Parol')}</h2>
          <Row label={t('Kirish usullari')}>{[user.hasPassword && t('Parol'), user.googleLinked && 'Google'].filter(Boolean).join(' · ') || '—'}</Row>
          <p className="gm-aprof__muted">{t('Parolni almashtirganda boshqa qurilmalar tizimdan chiqariladi.')}</p>
          <Button onClick={() => setPasswordOpen(true)} disabled={!user.hasPassword}><KeyRound size={16} aria-hidden="true" /> {t('Parolni almashtirish')}</Button>
        </section>
      </div>

      {passwordOpen && <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />}
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
