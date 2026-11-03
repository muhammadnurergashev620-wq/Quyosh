import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Check, Copy, History, KeyRound, ListChecks, Mail, MessageSquareLock, Monitor, Phone, ShieldAlert, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { accountName } from '@/lib/account-name';
import { describeDevice } from '@/lib/user-agent';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import { AvatarEditor } from '@/features/profile/AvatarEditor';
import { AdminAvatarPermission } from '@/features/admin/components/AdminAvatarPermission';
import { AdminPermissionsDialog } from '@/features/admin/components/AdminPermissionsDialog';
import { PasswordResetDialog } from '@/features/admin/components/PasswordResetDialog';
import { accountPath } from '@/features/admin/account-path';
import { actionInfo } from '@/features/admin/audit-labels';
import { useAdminAccounts, useSetUserTwoFactor } from '@/features/admin/hooks/useAdmin';
import { PERMISSION_LABEL } from '@/features/admin/permissions';
import type { useAdminUserByNumber } from '@/features/admin/hooks/useAdmin';
import './AdminAccountProfile.css';
import { t } from '@/i18n';

type Detail = NonNullable<ReturnType<typeof useAdminUserByNumber>['data']>;

const PANEL: Record<string, string> = { CUSTOMER: t('Mijoz paneli'), MASTER: t('Usta paneli'), ADMIN: t('Admin paneli') };

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: t('Faol'), tone: 'success' },
  PENDING: { label: t('Tasdiqlanmagan'), tone: 'neutral' },
  SUSPENDED: { label: t('Muzlatilgan'), tone: 'warning' },
  BLOCKED: { label: t('Bloklangan'), tone: 'danger' },
  DELETED: { label: t('O‘chirilgan'), tone: 'neutral' },
};

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="gm-acc__row">
      <span className="gm-acc__row-icon" aria-hidden="true">{icon}</span>
      <div>
        <small>{label}</small>
        <span>{children}</span>
      </div>
    </div>
  );
}

/** Superadmin ko‘radigan admin akkaunti profili: faqat adminga tegishli ma’lumotlar. */
export function AdminAccountProfile({
  data,
  viewerId,
  viewerIsSuper,
  viewerNumber,
  onDelete,
}: {
  data: Detail;
  viewerId?: string;
  viewerIsSuper: boolean;
  viewerNumber?: number;
  onDelete: () => void;
}) {
  const setTwoFactor = useSetUserTwoFactor();
  const accounts = useAdminAccounts(viewerIsSuper);
  const account = accounts.data?.items.find((item) => item.id === data.id);
  const [copied, setCopied] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const status = STATUS[data.status] ?? { label: data.status, tone: 'neutral' as BadgeTone };
  const name = accountName(data);
  const isSuper = !!account?.isSuperAdmin;
  const canManage = viewerIsSuper && data.status !== 'DELETED' && data.id !== viewerId;
  const otpOn = data.twoFactorEnabled !== false;
  const device = data.lastSession ? describeDevice(data.lastSession.userAgent) : null;

  return (
    <div className="gm-acc">
      <header className="gm-acc__hero">
        <AvatarEditor name={name} seed={data.id} size="lg" src={data.avatar} targetUserId={data.id !== viewerId ? data.id : undefined} canEdit={viewerIsSuper || (data.id === viewerId && !!data.adminAvatarAllowed)} lockedHint={t('Admin profil rasmini faqat superadmin qo‘ya oladi')} />
        <div className="gm-acc__who">
          <h1>{name}</h1>
          <div className="gm-acc__badges">
            <Badge tone="primary">{account ? (isSuper ? t('Superadmin') : t('Admin')) : t('Admin')}</Badge>
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="gm-acc__id">ID {data.accountNumber}</span>
          </div>
        </div>
        <div className="gm-acc__actions">
          <Link to={`/admin/audit?actor=${data.accountNumber}`}>
            <Button size="sm" variant="secondary"><History size={15} aria-hidden="true" />{' '}{t('Audit jurnali')}</Button>
          </Link>
          {canManage && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setPasswordOpen(true)}><KeyRound size={15} aria-hidden="true" />{' '}{t('Yangi parol')}</Button>
              <Button size="sm" variant="ghost" className="gm-btn-danger-text" onClick={onDelete}><Trash2 size={15} aria-hidden="true" />{' '}{t('Adminni o‘chirish')}</Button>
            </>
          )}
        </div>
      </header>

      {viewerIsSuper && !isSuper && data.id !== viewerId && <AdminAvatarPermission adminId={data.id} allowed={!!data.adminAvatarAllowed} className="gm-acc__card gm-adm__twofa" />}

      <section className="gm-acc__quick" aria-label={t('Qisqacha')}>
        <div><Smartphone size={18} aria-hidden="true" /><strong>{data.stats.activeDevices}</strong><small>{t('Faol qurilmalar')}</small></div>
        <div><CalendarClock size={18} aria-hidden="true" /><strong>{data.lastLoginAt ? formatRelativeTime(data.lastLoginAt) : '—'}</strong><small>{t('Oxirgi kirish')}</small></div>
        <div><CalendarClock size={18} aria-hidden="true" /><strong>{formatDateTime(data.createdAt)}</strong><small>{t('Qo‘shilgan')}</small></div>
      </section>

      <div className="gm-acc__grid">
        <section className="gm-acc__card">
          <h2>{t('Akkaunt ma’lumotlari')}</h2>
          <Row icon={<Phone size={16} />} label={t('Telefon (login)')}>
            <span className="gm-acc__copy">
              <strong>{data.phone}</strong>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(data.phone);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {copied ? t('Nusxalandi') : t('Nusxalash')}
              </button>
            </span>
            <em>{data.phoneVerifiedAt ? t('Tasdiqlangan') : t('Tasdiqlanmagan')}</em>
          </Row>
          <Row icon={<Mail size={16} />} label={t('Email')}>{data.email ?? '—'}</Row>
          <Row icon={<KeyRound size={16} />} label={t('Parol')}>
            <strong className="gm-acc__dots">••••••••••</strong>
            <em>{t('Parol xeshlangan holda saqlanadi, uni hech kim ko‘ra olmaydi. Faqat yangisini belgilash mumkin.')}</em>
          </Row>
        </section>

        <section className="gm-acc__card gm-sec">
          <div className="gm-sec__head">
            <h2>{t('Xavfsizlik')}</h2>
            <span className={otpOn ? 'gm-sec__state gm-sec__state--on' : 'gm-sec__state gm-sec__state--off'}>
              {otpOn ? <ShieldCheck size={14} aria-hidden="true" /> : <ShieldAlert size={14} aria-hidden="true" />}
              {otpOn ? t('Ikki bosqichli himoya yoqilgan') : t('Faqat parol bilan himoyalangan')}
            </span>
          </div>

          {viewerIsSuper && data.status !== 'DELETED' && (
            <div className={otpOn ? 'gm-sec__otp gm-sec__otp--on' : 'gm-sec__otp'}>
              <span className="gm-sec__otp-icon" aria-hidden="true"><MessageSquareLock size={20} /></span>
              <div className="gm-sec__otp-text">
                <strong>{t('Kirishda tasdiqlash kodi (OTP)')}</strong>
                <span>{otpOn ? t('Kirganda telefonga kod yuboriladi.') : t('Faqat login va parol bilan kiriladi.')}</span>
              </div>
              <Switch
                label={otpOn ? t('Yoqilgan') : t('O‘chirilgan')}
                checked={otpOn}
                disabled={setTwoFactor.isPending}
                onChange={(enabled) => setTwoFactor.mutate({ id: data.id, enabled })}
              />
            </div>
          )}

          <div className="gm-sec__device">
            <span className="gm-sec__label">{t('Oxirgi qurilma')}</span>
            {data.lastSession ? (
              <div className="gm-sec__device-body">
                <span className="gm-sec__device-icon" aria-hidden="true">
                  {device?.kind === 'mobile' || device?.kind === 'tablet' ? <Smartphone size={20} /> : <Monitor size={20} />}
                </span>
                <div>
                  <strong>{device ? `${device.browser} · ${device.os}` : '—'}</strong>
                  <dl>
                    <div><dt>IP</dt><dd>{data.lastSession.ipAddress ?? t('IP noma’lum')}</dd></div>
                    {data.lastSession.panel && <div><dt>{t('Panel')}</dt><dd>{PANEL[data.lastSession.panel] ?? data.lastSession.panel}</dd></div>}
                    <div><dt>{t('Faollik')}</dt><dd>{formatRelativeTime(data.lastSession.lastSeenAt)}</dd></div>
                  </dl>
                </div>
              </div>
            ) : (
              <p className="gm-acc__muted">{t('Hali kirmagan')}</p>
            )}
          </div>
        </section>
      </div>

      <section className="gm-acc__card">
        <div className="gm-acc__card-head">
          <h2>{t('Ruxsat berilgan bo‘limlar')}</h2>
          {viewerIsSuper && account && !isSuper && data.id !== viewerId && (
            <Button size="sm" variant="secondary" onClick={() => setPermissionsOpen(true)}><ListChecks size={15} aria-hidden="true" />{' '}{t('Huquqlar')}</Button>
          )}
        </div>
        <div className="gm-acc__perms">
          {!account ? (
            <span className="gm-acc__muted">—</span>
          ) : isSuper ? (
            <Badge tone="primary"><ShieldCheck size={13} aria-hidden="true" /> {t('Barcha bo‘limlar')}</Badge>
          ) : (account.adminPermissions ?? []).length > 0 ? (
            (account.adminPermissions ?? []).map((key) => <Badge key={key} tone="neutral">{PERMISSION_LABEL[key] ?? key}</Badge>)
          ) : (
            <Badge tone="warning">{t('Hech qaysi')}</Badge>
          )}
        </div>
      </section>

      <section className="gm-acc__card">
        <h2>{t('So‘nggi faollik')}</h2>
        {data.recentActivity.length === 0 ? (
          <EmptyState title={t('Faollik yo‘q')} />
        ) : (
          <ul className="gm-acc__timeline">
            {data.recentActivity.map((entry) => {
              const info = actionInfo(entry.action);
              return (
                <li key={entry.id}>
                  <Badge tone={info.tone}>{info.label}</Badge>
                  {entry.reason && <span className="gm-acc__reason">{entry.reason}</span>}
                  {entry.actor && entry.actor.accountNumber !== data.accountNumber && (
                    <Link to={accountPath(entry.actor.accountNumber, viewerNumber)} className="gm-acc__by">{t('bajaruvchi profili')}</Link>
                  )}
                  <time>{formatDateTime(entry.createdAt)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {passwordOpen && <PasswordResetDialog userId={data.id} name={name} phone={data.phone} onClose={() => setPasswordOpen(false)} />}
      {permissionsOpen && account && <AdminPermissionsDialog admin={account} onClose={() => setPermissionsOpen(false)} />}
    </div>
  );
}
