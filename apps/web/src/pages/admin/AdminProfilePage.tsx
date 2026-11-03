import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, BadgeCheck, Check, Clock, KeyRound, LogIn, LogOut, Mail, MonitorSmartphone, Phone, Settings, ShieldCheck, UserPlus, UserRound, X } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate, formatDateTime, formatNumber, formatRelativeTime } from '@/lib/utils';
import { DeviceList } from '@/features/auth/components/DeviceList';
import { LogoutDialog } from '@/features/auth/components/LogoutDialog';
import { AvatarEditor } from '@/features/profile/AvatarEditor';
import { CodeEmailSettings } from '@/features/session/components/CodeEmailSettings';
import { TwoFactorSettings } from '@/features/session/components/TwoFactorSettings';
import { actionInfo } from '@/features/admin/audit-labels';
import { ChangePasswordDialog } from '@/features/admin/profile/ChangePasswordDialog';
import { NameForm } from '@/features/admin/profile/NameForm';
import { useAdminMyProfile } from '@/features/admin/hooks/useAdmin';
import { ADMIN_PERMISSION_OPTIONS } from '@/features/admin/permissions';
import { ADMIN_STATUS } from '@/features/admin/admins/admins-ui';
import './AdminProfilePage.css';
import { t } from '@/i18n';

type Tab = 'info' | 'security' | 'permissions' | 'activity' | 'devices';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gm-aprof__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/** Superadmin va admin uchun shaxsiy profil: rasm, ma’lumotlar, xavfsizlik, huquqlar, faoliyat va qurilmalar. */
export function AdminProfilePage() {
  const navigate = useNavigate();
  const profile = useAdminMyProfile();
  const [tab, setTab] = useState<Tab>('info');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  if (profile.isLoading) return <PageLoader label={t('Profil yuklanmoqda…')} />;
  if (profile.isError || !profile.data) return <Alert tone="danger">{getErrorMessage(profile.error)}</Alert>;

  const { user, stats, activity } = profile.data;
  const name = accountName(user);
  const status = ADMIN_STATUS[user.status] ?? { label: user.status, tone: 'neutral' as const };
  const permissions = new Set(user.adminPermissions);
  const canEditPhoto = user.isSuperAdmin || user.adminAvatarAllowed;
  const tabs: Array<[Tab, string, React.ReactNode]> = [
    ['info', t('Umumiy'), <UserRound key="i" size={16} />],
    ['security', t('Xavfsizlik'), <ShieldCheck key="s" size={16} />],
    ['permissions', t('Huquqlar'), <BadgeCheck key="p" size={16} />],
    ['activity', t('Faoliyat'), <Activity key="a" size={16} />],
    ['devices', t('Qurilmalar'), <MonitorSmartphone key="d" size={16} />],
  ];

  return (
    <div className="gm-aprof">
      <section className="gm-aprof__hero">
        <div className="gm-aprof__cover" aria-hidden="true" />
        <div className="gm-aprof__who">
          <span className="gm-aprof__avatar">
            <AvatarEditor name={name} seed={user.id} size="lg" src={user.avatar} canEdit={canEditPhoto} lockedHint={t('Profil rasmini faqat superadmin qo‘ya oladi')} />
          </span>
          <div className="gm-aprof__id">
            <h1>{name}</h1>
            <div className="gm-aprof__badges">
              <Badge tone="primary">{user.isSuperAdmin ? t('Superadmin') : t('Admin')}</Badge>
              <Badge tone={status.tone}>{status.label}</Badge>
              {user.canCreateAdmins && !user.isSuperAdmin && <Badge tone="warning">{t('Admin yarata oladi')}</Badge>}
              <span className="gm-aprof__num">ID {user.accountNumber}</span>
            </div>
            <p>
              <span><Phone size={14} aria-hidden="true" /> {user.phone}{user.phoneVerifiedAt && <BadgeCheck size={14} className="gm-aprof__ok" aria-label={t('Tasdiqlangan')} />}</span>
              {user.email && <span><Mail size={14} aria-hidden="true" /> {user.email}</span>}
              <span><Clock size={14} aria-hidden="true" /> {t('Qo‘shilgan: {date}', { date: formatDate(user.createdAt) })}</span>
            </p>
            {!canEditPhoto && <small className="gm-aprof__hint">{t('Profil rasmini faqat superadmin qo‘yib beradi yoki ruxsat beradi.')}</small>}
          </div>
          <div className="gm-aprof__quick">
            <Button variant="secondary" onClick={() => navigate('/sozlamalar')}><Settings size={16} aria-hidden="true" /> {t('Sozlamalar')}</Button>
            <Button variant="ghost" className="gm-btn-danger-text" onClick={() => setLogoutOpen(true)}><LogOut size={16} aria-hidden="true" /> {t('Chiqish')}</Button>
          </div>
        </div>
        <div className="gm-aprof__stats">
          <div><span className="gm-aprof__sico gm-aprof__sico--blue"><Activity size={20} /></span><strong>{formatNumber(stats.actions30d)}</strong><small>{t('Amallar (30 kun)')}</small><em>{t('Jami: {count}', { count: formatNumber(stats.actionsTotal) })}</em></div>
          <div><span className="gm-aprof__sico gm-aprof__sico--green"><LogIn size={20} /></span><strong>{formatNumber(stats.logins30d)}</strong><small>{t('Kirishlar (30 kun)')}</small><em>{user.lastLoginAt ? t('Oxirgi: {when}', { when: formatRelativeTime(user.lastLoginAt) }) : t('Hali kirmagan')}</em></div>
          <div><span className="gm-aprof__sico gm-aprof__sico--violet"><MonitorSmartphone size={20} /></span><strong>{formatNumber(stats.activeDevices)}</strong><small>{t('Faol qurilmalar')}</small><em>{user.twoFactorEnabled ? t('Ikki bosqichli himoya yoqilgan') : t('Himoya o‘chirilgan')}</em></div>
          <div><span className="gm-aprof__sico gm-aprof__sico--amber">{user.isSuperAdmin || user.canCreateAdmins ? <UserPlus size={20} /> : <BadgeCheck size={20} />}</span><strong>{user.isSuperAdmin || user.canCreateAdmins ? formatNumber(stats.adminsCreated) : formatNumber(user.adminPermissions.length)}</strong><small>{user.isSuperAdmin || user.canCreateAdmins ? t('Yaratgan adminlar') : t('Ruxsat berilgan bo‘limlar')}</small><em>{user.isSuperAdmin ? t('Barcha bo‘limlar') : `${user.adminPermissions.length} / ${ADMIN_PERMISSION_OPTIONS.length}`}</em></div>
        </div>
      </section>

      <div className="gm-aprof__tabs" role="tablist">
        {tabs.map(([value, label, icon]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={cx(tab === value && 'is-on')} onClick={() => setTab(value)}>{icon} {label}</button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="gm-aprof__grid">
          <section className="gm-aprof__card">
            <h2>{t('Shaxsiy ma’lumotlar')}</h2>
            <NameForm firstName={user.firstName} lastName={user.lastName} />
            <Row label={t('Telefon (login)')}>{user.phone} {user.phoneVerifiedAt ? <Badge tone="success">{t('Tasdiqlangan')}</Badge> : <Badge tone="warning">{t('Tasdiqlanmagan')}</Badge>}</Row>
            <Row label="Email">{user.email ?? '—'}</Row>
            <Row label="ID">{user.accountNumber}</Row>
          </section>
          <section className="gm-aprof__card">
            <h2>{t('Akkaunt')}</h2>
            <Row label={t('Rol')}>{user.isSuperAdmin ? t('Superadmin') : t('Admin')}</Row>
            <Row label={t('Holat')}><Badge tone={status.tone}>{status.label}</Badge></Row>
            <Row label={t('Ro‘yxatdan o‘tgan')}>{formatDateTime(user.createdAt)} <small>({formatRelativeTime(user.createdAt)})</small></Row>
            <Row label={t('Oxirgi kirish')}>{user.lastLoginAt ? <>{formatDateTime(user.lastLoginAt)} <small>({formatRelativeTime(user.lastLoginAt)})</small></> : t('Hali kirmagan')}</Row>
            {stats.firstActionAt && <Row label={t('Birinchi amal')}>{formatDate(stats.firstActionAt)}</Row>}
            <Row label={t('Yaratgan admin')}>{user.createdBy ? `${accountName(user.createdBy)} (ID ${user.createdBy.accountNumber})` : t('Tizim (asosiy akkaunt)')}</Row>
            <Row label={t('Kirish usullari')}>{[user.hasPassword && t('Parol'), user.googleLinked && 'Google'].filter(Boolean).join(' · ') || '—'}</Row>
            {user.googleEmail && <Row label="Google email">{user.googleEmail}</Row>}
          </section>
        </div>
      )}

      {tab === 'security' && (
        <div className="gm-aprof__grid">
          <section className="gm-aprof__card">
            <h2>{t('Parol')}</h2>
            <Row label={t('Oxirgi o‘zgarish')}>{stats.passwordChangedAt ? <>{formatDateTime(stats.passwordChangedAt)} <small>({formatRelativeTime(stats.passwordChangedAt)})</small></> : t('Hech qachon almashtirilmagan')}</Row>
            <p className="gm-aprof__muted">{t('Parolni kamida 3 oyda bir marta almashtiring. Almashtirganda boshqa qurilmalar tizimdan chiqariladi.')}</p>
            <Button onClick={() => setPasswordOpen(true)} disabled={!user.hasPassword}><KeyRound size={16} aria-hidden="true" /> {t('Parolni almashtirish')}</Button>
          </section>
          <section className="gm-aprof__card">
            <h2>{t('Ikki bosqichli himoya')}</h2>
            <TwoFactorSettings />
          </section>
          <section className="gm-aprof__card gm-aprof__card--wide">
            <h2>{t('Tasdiqlash kodlari emaili')}</h2>
            <CodeEmailSettings />
          </section>
        </div>
      )}

      {tab === 'permissions' && (
        <section className="gm-aprof__card">
          <h2>{t('Bo‘limlarga ruxsat')}</h2>
          {user.isSuperAdmin && <Alert tone="info">{t('Superadmin barcha bo‘limlarga to‘liq ruxsatga ega.')}</Alert>}
          <div className="gm-aprof__perms">
            {ADMIN_PERMISSION_OPTIONS.map((option) => {
              const allowed = user.isSuperAdmin || permissions.has(option.value);
              return (
                <div key={option.value} className={cx('gm-aprof__perm', allowed && 'is-on')}>
                  <span>{allowed ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}</span>
                  <div>
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </div>
                </div>
              );
            })}
          </div>
          {user.canCreateAdmins && !user.isSuperAdmin && (
            <>
              <h3>{t('Bera oladigan huquqlar')}</h3>
              <div className="gm-aprof__chips">
                {user.grantablePermissions.map((key) => <span key={key}>{ADMIN_PERMISSION_OPTIONS.find((option) => option.value === key)?.label ?? key}</span>)}
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'activity' && (
        <section className="gm-aprof__card">
          <div className="gm-aprof__cardhead">
            <h2>{t('So‘nggi amallar')}</h2>
            {(user.isSuperAdmin || permissions.has('AUDIT')) && <Link to={`/admin/audit?actor=${user.accountNumber}`}><Button size="sm" variant="secondary">{t('Audit jurnalida ko‘rish')}</Button></Link>}
          </div>
          {activity.length === 0 && <p className="gm-aprof__muted">{t('Hali amal bajarmagansiz.')}</p>}
          <ol className="gm-aprof__timeline">
            {activity.map((entry) => {
              const info = actionInfo(entry.action);
              return (
                <li key={entry.id}>
                  <i className={`is-${info.tone}`} aria-hidden="true" />
                  <div>
                    <strong>{info.label}</strong>
                    {entry.reason && <small>{entry.reason}</small>}
                    <small>{formatDateTime(entry.createdAt)} · {formatRelativeTime(entry.createdAt)}{entry.ipAddress ? ` · ${entry.ipAddress}` : ''}</small>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {tab === 'devices' && (
        <section className="gm-aprof__card">
          <h2>{t('Faol qurilmalar')}</h2>
          <DeviceList />
        </section>
      )}

      {passwordOpen && <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />}
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
