import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ExternalLink, MailOpen, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { actionInfo } from '@/features/admin/audit-labels';
import { adminAuditPath } from '../notification-meta';
import { useAdminNotificationActions, useAdminNotificationDetail } from '../hooks/useAdminNotifications';
import { CATEGORY, PRIORITY, ROLE_LABEL, notificationTitle } from './notify-ui';
import '@/features/admin/users/UserDrawer.css';
import './AdminNotificationDrawer.css';
import { t } from '@/i18n';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gm-udr__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/** Bildirishnomani bosganda ochiladigan o‘ng panel: matn, bog‘liq obyekt (buyurtma yoki foydalanuvchi), audit izlari va amallar. */
export function AdminNotificationDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const detail = useAdminNotificationDetail(id);
  const { markRead, markUnread } = useAdminNotificationActions();
  const d = detail.data;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Ochilganda o‘qilgan deb belgilanadi.
  useEffect(() => {
    if (d && !d.read) markRead.mutate([d.id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id]);

  const category = d ? CATEGORY[d.category] : null;
  const priority = d ? PRIORITY[d.priority] : null;
  const target = d ? (d.order ? `/admin/buyurtmalar/${d.order.id}` : d.targetUser ? `/admin/foydalanuvchilar/${d.targetUser.accountNumber}` : d.action ? adminAuditPath(d.action, d.path) : d.path) : null;
  const info = d?.action ? actionInfo(d.action) : null;

  return (
    <>
      <div className="gm-udr__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="gm-udr" role="dialog" aria-modal="true" aria-label={t('Bildirishnoma tafsilotlari')}>
        <header className="gm-ndr__head">
          <div>
            <small>{t('Bildirishnoma tafsilotlari')}</small>
            {d && category && (
              <div className="gm-ndr__title">
                <span className={cx('gm-ndr__icon', `gm-nt--${category.tone}`)}>{category.icon}</span>
                <div>
                  <h2>{notificationTitle(d)}</h2>
                  <p>
                    <Badge tone={d.read ? 'neutral' : 'success'}>{d.read ? t('O‘qilgan') : t('O‘qilmagan')}</Badge> · {formatDateTime(d.createdAt)}
                  </p>
                </div>
              </div>
            )}
          </div>
          <button type="button" className="gm-udr__close" onClick={onClose} aria-label={t('Yopish')}><X size={18} /></button>
        </header>

        <div className="gm-udr__body">
          {detail.isError && <Alert tone="danger">{getErrorMessage(detail.error)}</Alert>}
          {detail.isLoading && <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>}
          {d && category && priority && (
            <>
              <section className="gm-udr__card">
                <p className="gm-ndr__body">{d.body}</p>
                <Info label={t('Kategoriya')}><span className={cx('gm-ndr__cat', `gm-nt--${category.tone}`)}>{category.icon} {category.label}</span></Info>
                <Info label={t('Daraja')}><Badge tone={priority.tone}>{priority.label}</Badge></Info>
                {info && <Info label={t('Amal')}>{info.label}</Info>}
                {d.audit?.actor && <Info label={t('Foydalanuvchi')}>{accountName(d.audit.actor)} <small>({ROLE_LABEL[d.audit.actor.role] ?? d.audit.actor.role} · ID {d.audit.actor.accountNumber})</small></Info>}
                {d.audit?.reason && <Info label={t('Sabab')}>{d.audit.reason}</Info>}
                {d.audit?.ipAddress && <Info label={t('IP manzil')}>{d.audit.ipAddress}</Info>}
                <Info label={t('Yuborilgan kanal')}>{d.channel === 'IN_APP' ? t('Ilova ichida') : d.channel}</Info>
              </section>

              {d.targetUser && (
                <section className="gm-udr__card">
                  <h3>{t('Bog‘liq obyekt')}</h3>
                  {d.targetUser && (
                    <div className="gm-ndr__object">
                      <span className="gm-ndr__oicon gm-nt--blue">{CATEGORY.USER.icon}</span>
                      <div>
                        <strong>{accountName(d.targetUser)}</strong>
                        <small>{ROLE_LABEL[d.targetUser.role] ?? d.targetUser.role} · ID {d.targetUser.accountNumber}</small>
                        <small>{d.targetUser.phone}</small>
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section className="gm-udr__card">
                <h3>{t('Audit izlari')}</h3>
                {d.events.map((event, index) => (
                  <div key={`${event.kind}-${index}`} className={cx('gm-ndr__event', `gm-ndr__event--${event.kind}`)}>
                    <i aria-hidden="true" />
                    <span>
                      <strong>{event.kind === 'audit' ? (actionInfo(event.label).label) : event.kind === 'created' ? t('Bildirishnoma yaratildi') : event.kind === 'sent' ? t('Yuborildi') : t('O‘qilgan deb belgilandi')}</strong>
                      <small>{formatDateTime(event.at)} · {formatRelativeTime(event.at)}</small>
                    </span>
                  </div>
                ))}
                {d.error && <Alert tone="danger">{d.error}</Alert>}
              </section>

              <section className="gm-udr__card">
                <h3>{t('Amallar')}</h3>
                <div className="gm-ndr__actions">
                  {target && <Button onClick={() => navigate(target)}><ExternalLink size={16} aria-hidden="true" /> {t('Bog‘langan obyektni ochish')}</Button>}
                  {d.read ? (
                    <Button variant="secondary" loading={markUnread.isPending} onClick={() => markUnread.mutate(d.id)}><MailOpen size={16} aria-hidden="true" /> {t('O‘qilmagan deb belgilash')}</Button>
                  ) : (
                    <Button variant="secondary" loading={markRead.isPending} onClick={() => markRead.mutate([d.id])}><Check size={16} aria-hidden="true" /> {t('O‘qilgan deb belgilash')}</Button>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
