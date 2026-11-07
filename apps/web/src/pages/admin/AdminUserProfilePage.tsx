import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, KeyRound, Ban, CheckCircle2, Snowflake, Trash2, ArrowLeft, CalendarClock, Mail, Phone, Smartphone, Store } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { AvatarEditor } from '@/features/profile/AvatarEditor';
import { Switch } from '@/components/ui/Switch';
import { useAdminUserByNumber, useSetUserTwoFactor } from '@/features/admin/hooks/useAdmin';
import { accountPath } from '@/features/admin/account-path';
import { actionInfo } from '@/features/admin/audit-labels';
import { useMe } from '@/features/session/hooks/useMe';
import { UserActionDialog } from '@/features/admin/components/UserActionDialog';
import { PasswordResetDialog } from '@/features/admin/components/PasswordResetDialog';
import type { UserAction } from '@/features/admin/user-actions';
import type { AdminUser } from '@/features/admin/types';
import { AdminAccountProfile } from './AdminAccountProfile';
import './AdminUserProfilePage.css';
import { t } from '@/i18n';

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: t('Akkaunt faol'), tone: 'success' },
  PENDING: { label: t('Telefon tasdiqlanmagan'), tone: 'neutral' },
  SUSPENDED: { label: t('Akkaunt muzlatilgan'), tone: 'warning' },
  BLOCKED: { label: t('Akkaunt bloklangan'), tone: 'danger' },
  DELETED: { label: t('O‘chirilgan'), tone: 'neutral' },
};
const ROLE: Record<string, string> = { CUSTOMER: t('Mijoz'), SHOP: t('Do‘kon'), ADMIN: t('Admin') };

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="gm-uprofile__field">
      <span className="gm-uprofile__field-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <small>{label}</small>
        <span>{children}</span>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number | string; label: string }) {
  return (
    <div className="gm-uprofile__stat">
      {icon}
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

export function AdminUserProfilePage() {
  const { id } = useParams();
  const me = useMe();
  const [action, setAction] = useState<UserAction | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [loginCopied, setLoginCopied] = useState(false);
  const navigate = useNavigate();
  const setTwoFactor = useSetUserTwoFactor();
  const number = id && /^\d{1,9}$/.test(id) ? Number(id) : null;
  const user = useAdminUserByNumber(number);

  // O‘z akkaunti bo‘lsa — shaxsiy profil bo‘limiga.
  if (number !== null && me.data?.accountNumber === number) return <Navigate to="/sozlamalar" replace />;

  const data = user.data;
  const isAdminAccount = !!data?.roles.includes('ADMIN');
  const status = data ? (STATUS[data.status] ?? { label: data.status, tone: 'neutral' as BadgeTone }) : null;

  return (
    <div className="gm-uprofile">
      <Link to={isAdminAccount ? '/admin/adminlar' : '/admin/foydalanuvchilar'} className="gm-uprofile__back">
        <ArrowLeft size={16} />{' '}{isAdminAccount ? t('Adminlar') : t('Foydalanuvchilar')}</Link>
      {user.isLoading && <PageLoader />}
      {user.isError && <Alert tone="danger">{getErrorMessage(user.error)}</Alert>}
      {number === null && <EmptyState title={t('Foydalanuvchi topilmadi')} description={t('Havola noto‘g‘ri: foydalanuvchi ID raqami bo‘lishi kerak.')} action={<Link to="/admin/foydalanuvchilar" className="gm-button gm-button--secondary gm-button--md">{t('Foydalanuvchilar ro‘yxati')}</Link>} />}
      {data && isAdminAccount && (
        <AdminAccountProfile data={data} viewerId={me.data?.id} viewerIsSuper={!!me.data?.isSuperAdmin} viewerNumber={me.data?.accountNumber} onDelete={() => setAction('DELETE')} />
      )}
      {data && status && !isAdminAccount && (
        <>
          <header className="gm-uprofile__hero">
            <AvatarEditor name={accountName(data)} seed={data.id} size="lg" src={data.avatar} targetUserId={data.id} canEdit={data.status !== 'DELETED'} />
            <div className="gm-uprofile__who">
              <h1>{accountName(data)}</h1>
              <p>
                ID {data.accountNumber}
              </p>
              <div className="gm-uprofile__badges">
                {data.roles.map((role) => (
                  <Badge key={role} tone="primary">
                    {ROLE[role] ?? role}
                  </Badge>
                ))}
                <Badge tone={status.tone}>{status.label}</Badge>
                {data.status === 'DELETED' && (
                  <Badge tone={data.registrationBlocked ? 'danger' : 'success'}>{data.registrationBlocked ? t('Qayta ro‘yxatdan o‘tish bloklangan') : t('Qayta ro‘yxatdan o‘tish mumkin')}</Badge>
                )}
              </div>
            </div>
            <div className="gm-uprofile__actions">
              {data.status === 'DELETED' && !data.roles.includes('ADMIN') && (
                <Button
                  size="sm"
                  variant={data.registrationBlocked ? 'secondary' : 'ghost'}
                  className={data.registrationBlocked ? undefined : 'gm-btn-danger-text'}
                  onClick={() => setAction(data.registrationBlocked ? 'ALLOW_REGISTRATION' : 'BLOCK_REGISTRATION')}
                >
                  <Ban size={16} /> {data.registrationBlocked ? t('Ro‘yxatdan o‘tishga ruxsat berish') : t('Qayta ro‘yxatdan o‘tishni bloklash')}
                </Button>
              )}
              {data.roles.includes('ADMIN') && data.status !== 'DELETED' && data.id !== me.data?.id && !!me.data?.isSuperAdmin && (
                <Button size="sm" variant="ghost" className="gm-btn-danger-text" onClick={() => setAction('DELETE')}>
                  <Trash2 size={16} />{' '}{t('Adminni o‘chirish')}</Button>
              )}
              {!data.roles.includes('ADMIN') && data.status !== 'DELETED' && (
                <>
                  {data.status === 'SUSPENDED' || data.status === 'BLOCKED' ? (
                    <Button size="sm" onClick={() => setAction('ACTIVATE')}>
                      <CheckCircle2 size={16} />{' '}{t('Faollashtirish')}</Button>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" className="gm-btn-tone gm-btn-tone--warn" onClick={() => setAction('SUSPEND')}>
                        <Snowflake size={16} />{' '}{t('Muzlatish')}</Button>
                      <Button size="sm" variant="secondary" className="gm-btn-tone gm-btn-tone--danger" onClick={() => setAction('BLOCK')}>
                        <Ban size={16} />{' '}{t('Bloklash')}</Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="gm-btn-danger-text" onClick={() => setAction('DELETE')}>
                    <Trash2 size={16} />{' '}{t('O‘chirish')}</Button>
                </>
              )}
              <Link to={`/admin/audit?actor=${data.accountNumber}`}>
                <Button size="sm" variant="secondary">{t('Audit jurnali')}</Button>
              </Link>
            </div>
          </header>

          {!!me.data?.isSuperAdmin && data.status !== 'DELETED' && (
            <section className="gm-uprofile__card" aria-label={t('Kirishda tasdiqlash kodi')}>
              <h2>{t('Kirishda tasdiqlash kodi (OTP)')}</h2>
              <p className="gm-twofa__text">
                {data.twoFactorEnabled !== false
                  ? t('Bu akkaunt kirganda telefonga tasdiqlash kodi yuboriladi.')
                  : t('Bu akkauntga faqat login va parol bilan kiriladi, kod yuborilmaydi.')}
              </p>
              {setTwoFactor.isError && <Alert tone="danger">{getErrorMessage(setTwoFactor.error)}</Alert>}
              <Switch
                label={data.twoFactorEnabled !== false ? t('Kirishda kod so‘ralsin') : t('Kirishda kod so‘ralmaydi')}
                checked={data.twoFactorEnabled !== false}
                disabled={setTwoFactor.isPending}
                onChange={(enabled) => setTwoFactor.mutate({ id: data.id, enabled })}
              />
            </section>
          )}

          <section className="gm-uprofile__stats" aria-label={t('Statistika')}>
            <Stat icon={<Smartphone size={18} />} value={data.stats.activeDevices} label={t('Faol qurilmalar')} />
          </section>

          <div className="gm-uprofile__grid">
            <section className="gm-uprofile__card">
              <h2>{t('Aloqa va akkaunt')}</h2>
              <Field icon={<Phone size={16} />} label={t('Telefon')}>
                {data.phone}
                {data.phoneVerifiedAt ? t(' · tasdiqlangan') : t(' · tasdiqlanmagan')}
              </Field>
              <Field icon={<KeyRound size={16} />} label={t('Kirish ma’lumotlari')}>
                <span className="gm-cred">
                  <span className="gm-cred__row">
                    <span className="gm-cred__key">{t('Login')}</span>
                    <strong className="gm-cred__value">{data.phone}</strong>
                    <span className="gm-cred__tools">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gm-btn-chip"
                        onClick={() => {
                          void navigator.clipboard?.writeText(data.phone);
                          setLoginCopied(true);
                          window.setTimeout(() => setLoginCopied(false), 1500);
                        }}
                      >
                        {loginCopied ? <Check size={15} /> : <Copy size={15} />} {loginCopied ? t('Nusxalandi') : t('Nusxalash')}
                      </Button>
                    </span>
                  </span>
                  <span className="gm-cred__row">
                    <span className="gm-cred__key">{t('Parol')}</span>
                    <span className="gm-cred__value">
                      <strong className="gm-cred__dots">••••••••••</strong>
                    </span>
                    {!data.roles.includes('ADMIN') && data.status !== 'DELETED' && (
                      <span className="gm-cred__tools">
                        <Button size="sm" className="gm-btn-chip gm-btn-chip--accent" onClick={() => setPasswordOpen(true)}>
                          <KeyRound size={15} />{' '}{t('Yangi parol belgilash')}</Button>
                      </span>
                    )}
                  </span>
                  <small className="gm-cred__note">{t('Parol faqat xeshlangan (qaytarib bo‘lmaydigan) ko‘rinishda saqlanadi — uni hech kim, jumladan administrator ham ko‘ra olmaydi. Faqat yangisini belgilash mumkin; bunda foydalanuvchi barcha qurilmalardan chiqariladi.')}</small>
                </span>
              </Field>
              <Field icon={<Mail size={16} />} label={t('Email')}>
                {data.email ?? '—'}
              </Field>
              <Field icon={<CalendarClock size={16} />} label={t('Ro‘yxatdan o‘tgan')}>
                {formatDateTime(data.createdAt)}
              </Field>
              <Field icon={<CalendarClock size={16} />} label={t('Oxirgi kirish')}>
                {data.lastLoginAt ? `${formatDateTime(data.lastLoginAt)} · ${formatRelativeTime(data.lastLoginAt)}` : '—'}
              </Field>
              {data.lastSession && (
                <Field icon={<Smartphone size={16} />} label={t('Oxirgi qurilma')}>
                  {data.lastSession.panel && t('{panel} paneli · ', { panel: data.lastSession.panel })}
                  {data.lastSession.ipAddress ?? t('IP noma’lum')}
                  {data.lastSession.userAgent && <small className="gm-uprofile__ua">{data.lastSession.userAgent}</small>}
                </Field>
              )}
            </section>

            {!isAdminAccount && data.shopMemberships.length > 0 && (
              <section className="gm-uprofile__card">
                <h2>{t('Do‘kon a’zoligi')}</h2>
                {data.shopMemberships.map((item) => (
                  <Field key={item.shopId} icon={<Store size={16} />} label={item.memberRole === 'OWNER' ? t('Ega') : item.memberRole === 'MANAGER' ? t('Menejer') : t('Xodim')}>
                    {item.shop.name} · {item.shop.status}
                  </Field>
                ))}
                <Link to="/admin/dokonlar" className="gm-uprofile__link">{t('Do‘konlar →')}</Link>
              </section>
            )}
          </div>

          <section className="gm-uprofile__card">
            <h2>{t('So‘nggi faollik')}</h2>
            {data.recentActivity.length === 0 ? (
              <EmptyState title={t('Faollik yo‘q')} />
            ) : (
              <ul className="gm-uprofile__activity">
                {data.recentActivity.map((entry) => {
                  const info = actionInfo(entry.action);
                  return (
                    <li key={entry.id}>
                      <Badge tone={info.tone}>{info.label}</Badge>
                      {entry.actor && entry.actor.accountNumber !== data.accountNumber && (
                        <Link to={accountPath(entry.actor.accountNumber, me.data?.accountNumber)} className="gm-uprofile__link">{t('bajaruvchi profili')}</Link>
                      )}
                      {entry.reason && <span className="gm-uprofile__reason">{t('Sabab:')}{' '}{entry.reason}</span>}
                      <time>{formatDateTime(entry.createdAt)}</time>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
      {data && passwordOpen && <PasswordResetDialog userId={data.id} name={accountName(data)} phone={data.phone} onClose={() => setPasswordOpen(false)} />}
      {data && action && <UserActionDialog
          user={data as AdminUser}
          action={action}
          onClose={() => setAction(null)}
          // O‘chirilgach profil yopiladi; akkaunt «O‘chirilgan» ro‘yxatida qoladi.
          onDeleted={() => navigate('/admin/foydalanuvchilar?status=DELETED', { replace: true })}
        />}
    </div>
  );
}
