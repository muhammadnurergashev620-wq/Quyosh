import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Check, ExternalLink, KeyRound, ListChecks, Mail, Phone, ShieldCheck, ShieldOff, Snowflake, Trash2, UserCheck, UserPlus, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Alert } from '@/components/ui/Alert';
import { UserAvatar } from '@/components/common/UserAvatar';
import { AdminAvatarPermission } from '@/features/admin/components/AdminAvatarPermission';
import { useAdminAccountDetails } from '@/features/admin/hooks/useAdmin';
import { actionInfo } from '@/features/admin/audit-labels';
import { ADMIN_PERMISSION_OPTIONS } from '@/features/admin/permissions';
import type { AdminAccount } from '@/features/admin/types';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { describeDevice } from '@/lib/user-agent';
import { ADMIN_STATUS } from './admins-ui';
import '@/features/admin/users/UserDrawer.css';
import './AdminDrawer.css';
import { t } from '@/i18n';

export type AdminDrawerAction = 'permissions' | 'delegation' | 'password' | 'super' | 'ACTIVATE' | 'SUSPEND' | 'BLOCK' | 'DELETE';
type Tab = 'info' | 'permissions' | 'activity' | 'sessions';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gm-udr__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/** Admin qatorini bosganda ochiladigan o‘ng panel: ma’lumot, huquqlar, faoliyat tarixi, sessiyalar va boshqaruv amallari. */
export function AdminDrawer({
  admin,
  isSuper,
  twoFactorBusy,
  superBusy,
  onClose,
  onAction,
  onTwoFactor,
}: {
  admin: AdminAccount;
  isSuper: boolean;
  twoFactorBusy: boolean;
  superBusy: boolean;
  onClose: () => void;
  onAction: (action: AdminDrawerAction) => void;
  onTwoFactor: (enabled: boolean) => void;
}) {
  const navigate = useNavigate();
  const details = useAdminAccountDetails(admin.id);
  const [tab, setTab] = useState<Tab>('info');
  useEffect(() => setTab('info'), [admin.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const d = details.data;
  const name = accountName(admin);
  const status = ADMIN_STATUS[admin.status] ?? { label: admin.status, tone: 'neutral' as const };
  const restricted = admin.status === 'SUSPENDED' || admin.status === 'BLOCKED';
  const mfa = admin.twoFactorEnabled !== false;
  const permissions = new Set(admin.adminPermissions ?? []);
  const activeSessions = d?.sessions.filter((session) => session.status === 'ACTIVE') ?? [];

  return (
    <>
      <div className="gm-udr__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="gm-udr" role="dialog" aria-modal="true" aria-label={t('Admin: {name}', { name })}>
        <header className="gm-udr__head">
          <UserAvatar name={name} seed={admin.id} size="lg" src={admin.avatar} />
          <div className="gm-udr__who">
            <h2>{name}</h2>
            <div className="gm-udr__badges">
              <Badge tone={admin.isSuperAdmin ? 'primary' : 'neutral'}>{admin.isSuperAdmin ? t('Superadmin') : t('Admin')}</Badge>
              <Badge tone={status.tone}>{status.label}</Badge>
              {admin.isSelf && <Badge tone="success">{t('Siz')}</Badge>}
            </div>
            <p><Phone size={13} aria-hidden="true" /> {admin.login ? `${admin.login}${admin.phone ? ` · ${admin.phone}` : ''}` : admin.phone}</p>
            {admin.email && <p><Mail size={13} aria-hidden="true" /> {admin.email}</p>}
            <p className="gm-udr__id">ID {admin.accountNumber}</p>
            <p>{t('Ro‘yxatdan o‘tgan: {date}', { date: formatDate(admin.createdAt) })} <small>({formatRelativeTime(admin.createdAt)})</small></p>
          </div>
          <button type="button" className="gm-udr__close" onClick={onClose} aria-label={t('Yopish')}>
            <X size={18} />
          </button>
        </header>

        <div className="gm-udr__tabs" role="tablist">
          {([['info', t('Asosiy ma’lumotlar')], ['permissions', t('Huquqlar')], ['activity', t('Faoliyat tarixi')], ['sessions', t('Sessiyalar')]] as Array<[Tab, string]>).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} className={cx(tab === value && 'is-on')} onClick={() => setTab(value)}>{label}</button>
          ))}
        </div>

        <div className="gm-udr__body">
          {details.isError && <Alert tone="danger">{getErrorMessage(details.error)}</Alert>}

          {tab === 'info' && (
            <>
              <section className="gm-udr__card">
                <h3>{t('Rol va bo‘lim')}</h3>
                <Info label={t('Rol')}><Badge tone={admin.isSuperAdmin ? 'primary' : 'neutral'}>{admin.isSuperAdmin ? t('Superadmin') : t('Admin')}</Badge></Info>
                <div className="gm-udr__row gm-adr__perms">
                  <span>{t('Bo‘limlar')}</span>
                  <div className="gm-udr__chips">
                    {admin.isSuperAdmin ? (
                      <span>{t('Barcha bo‘limlar')}</span>
                    ) : permissions.size ? (
                      ADMIN_PERMISSION_OPTIONS.filter((option) => permissions.has(option.value)).map((option) => <span key={option.value}>{option.label}</span>)
                    ) : (
                      <span className="is-warn">{t('Hech qaysi')}</span>
                    )}
                  </div>
                </div>
                {admin.canCreateAdmins && <Info label={t('Admin yaratish vakolati')}><Badge tone="warning">{t('Bor')}</Badge></Info>}
                {d?.createdBy && <Info label={t('Yaratgan')}>{accountName(d.createdBy)} <small>(ID {d.createdBy.accountNumber})</small></Info>}
              </section>

              <section className="gm-udr__card">
                <h3>{t('Xavfsizlik')}</h3>
                <div className="gm-udr__row">
                  <span>{t('Ikki bosqichli himoya (MFA)')}</span>
                  <strong className="gm-adr__mfa">
                    <Badge tone={mfa ? 'success' : 'neutral'}>{mfa ? t('Yoqilgan') : t('O‘chirilgan')}</Badge>
                  </strong>
                </div>
                {isSuper && (
                  <div className="gm-adr__switch">
                    <Switch label={mfa ? t('Kirishda kod so‘ralsin') : t('Kirishda kod so‘ralmaydi')} checked={mfa} disabled={twoFactorBusy} onChange={onTwoFactor} />
                  </div>
                )}
                <Info label={t('Oxirgi kirish')}>{admin.lastLoginAt ? <>{formatDateTime(admin.lastLoginAt)} <small>({formatRelativeTime(admin.lastLoginAt)})</small></> : t('Hali kirmagan')}</Info>
                <Info label={t('Oxirgi parol yangilanishi')}>{d ? (d.passwordResetAt ? formatDateTime(d.passwordResetAt) : t('Yangilanmagan')) : '…'}</Info>
                <Info label={t('Faol sessiyalar')}>{t('{count} ta qurilma', { count: admin.activeDevices ?? 0 })}</Info>
                <Info label={t('Oxirgi 30 kunda amallar')}>{d ? d.actions30d : '…'}</Info>
                <Info label={t('Telefon')}>{admin.phoneVerifiedAt ? t('Tasdiqlangan') : t('Tasdiqlanmagan')}</Info>
              </section>

              {isSuper && !admin.isSuperAdmin && <AdminAvatarPermission adminId={admin.id} allowed={!!admin.adminAvatarAllowed} className="gm-udr__card gm-adr__avatar" />}

              {!admin.isSelf && (
                <section className="gm-udr__card">
                  <h3>{t('Amallar')}</h3>
                  <div className="gm-udr__actions">
                    <Button variant="secondary" onClick={() => navigate(`/admin/foydalanuvchilar/${admin.accountNumber}`)}><ExternalLink size={16} aria-hidden="true" /> {t('Profilni ko‘rish')}</Button>
                    {isSuper && <Button variant="secondary" onClick={() => onAction('password')}><KeyRound size={16} aria-hidden="true" /> {t('Yangi parol')}</Button>}
                    {isSuper && (
                      <Button variant="secondary" loading={superBusy} onClick={() => onAction('super')}>
                        {admin.isSuperAdmin ? <ShieldOff size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
                        {admin.isSuperAdmin ? t('Oddiy admin qilish') : t('Superadmin qilish')}
                      </Button>
                    )}
                    {isSuper && (restricted ? (
                      <Button variant="secondary" onClick={() => onAction('ACTIVATE')}><UserCheck size={16} aria-hidden="true" /> {t('Faollashtirish')}</Button>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => onAction('SUSPEND')}><Snowflake size={16} aria-hidden="true" /> {t('Muzlatish')}</Button>
                        <Button variant="secondary" className="gm-udr__danger" onClick={() => onAction('BLOCK')}><Ban size={16} aria-hidden="true" /> {t('Bloklash')}</Button>
                      </>
                    ))}
                    {isSuper && <Button variant="secondary" className="gm-udr__danger" onClick={() => onAction('DELETE')}><Trash2 size={16} aria-hidden="true" /> {t('O‘chirish')}</Button>}
                  </div>
                  <Alert tone="info">{t('Superadmin huquqlari faqat maxsus tasdiqlash orqali o‘zgartiriladi. Barcha amallar audit jurnalida qayd etiladi.')}</Alert>
                </section>
              )}
            </>
          )}

          {tab === 'permissions' && (
            <section className="gm-udr__card">
              <h3>{t('Bo‘limlarga ruxsat')}</h3>
              {admin.isSuperAdmin && <p className="gm-udr__muted">{t('Superadmin barcha bo‘limlarga to‘liq ruxsatga ega.')}</p>}
              {ADMIN_PERMISSION_OPTIONS.map((option) => {
                const allowed = admin.isSuperAdmin || permissions.has(option.value);
                return (
                  <div key={option.value} className={cx('gm-adr__perm', allowed && 'is-on')}>
                    <span className="gm-adr__tick">{allowed ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}</span>
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </span>
                  </div>
                );
              })}
              {admin.canCreateAdmins && (
                <>
                  <h3 className="gm-adr__sub">{t('Bera oladigan huquqlar')}</h3>
                  <div className="gm-udr__chips">
                    {(admin.grantablePermissions ?? []).map((key) => <span key={key}>{ADMIN_PERMISSION_OPTIONS.find((option) => option.value === key)?.label ?? key}</span>)}
                  </div>
                </>
              )}
              {!admin.isSelf && (
                <div className="gm-udr__actions">
                  {!admin.isSuperAdmin && <Button onClick={() => onAction('permissions')}><ListChecks size={16} aria-hidden="true" /> {t('Huquqlarni o‘zgartirish')}</Button>}
                  {isSuper && !admin.isSuperAdmin && <Button variant="secondary" onClick={() => onAction('delegation')}><UserPlus size={16} aria-hidden="true" /> {t('Admin yaratish vakolati')}</Button>}
                </div>
              )}
            </section>
          )}

          {tab === 'activity' && (
            <section className="gm-udr__card">
              <h3>{t('So‘nggi amallar')}</h3>
              {details.isLoading && <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>}
              {d && d.activity.length === 0 && <p className="gm-udr__muted">{t('Hali amal bajarmagan.')}</p>}
              {d?.activity.map((entry) => {
                const info = actionInfo(entry.action);
                return (
                  <div key={entry.id} className="gm-udr__sub">
                    <span>
                      <strong>{info.label}</strong>
                      {entry.reason && <small>{entry.reason}</small>}
                      <small>{formatDateTime(entry.createdAt)} · {formatRelativeTime(entry.createdAt)}</small>
                    </span>
                    <Badge tone={info.tone}>{info.group === 'auth' ? t('Kirish') : t('Amal')}</Badge>
                  </div>
                );
              })}
              {d && <Button fullWidth variant="secondary" onClick={() => navigate(`/admin/audit?actor=${admin.accountNumber}`)}>{t('Audit jurnalida ko‘rish')}</Button>}
            </section>
          )}

          {tab === 'sessions' && (
            <section className="gm-udr__card">
              <h3>{t('Qurilma sessiyalari')} {d && <small>({t('faol: {count}', { count: activeSessions.length })})</small>}</h3>
              {details.isLoading && <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>}
              {d && d.sessions.length === 0 && <p className="gm-udr__muted">{t('Sessiya yo‘q.')}</p>}
              {d?.sessions.map((session) => {
                const device = describeDevice(session.userAgent);
                return (
                  <div key={session.id} className="gm-udr__sub">
                    <span>
                      <strong>{device.browser} · {device.os}</strong>
                      <small>{[session.panel, session.ipAddress].filter(Boolean).join(' · ') || '—'}</small>
                      <small>{t('Oxirgi faollik')}: {formatRelativeTime(session.lastSeenAt)}</small>
                    </span>
                    <Badge tone={session.status === 'ACTIVE' ? 'success' : 'neutral'}>{session.status === 'ACTIVE' ? t('Faol') : t('Tugagan')}</Badge>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
