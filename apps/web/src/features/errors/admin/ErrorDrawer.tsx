import { useEffect } from 'react';
import { Check, Copy, RotateCcw, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/common/UserAvatar';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import { describeDevice } from '@/lib/user-agent';
import { useErrorGroupDetail, useResolveErrors } from '../hooks';
import { KIND_LABEL, PANEL_LABEL, PLATFORM_LABEL, statusName, whereOf } from './errors-ui';
import '@/features/admin/users/UserDrawer.css';
import './ErrorDrawer.css';
import { AccountLink } from '@/features/admin/components/AccountLink';
import { t } from '@/i18n';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gm-udr__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function Copyable({ text, label }: { text: string; label: string }) {
  const pushToast = useAppStore((state) => state.pushToast);
  return (
    <button type="button" className="gm-edr__copy" onClick={() => void navigator.clipboard?.writeText(text).then(() => pushToast(t('Nusxa olindi'), 'success'), () => undefined)}>
      <Copy size={13} aria-hidden="true" /> {label}
    </button>
  );
}

/** Xatolar guruhini bosganda ochiladigan o‘ng panel: asosiy ma’lumot, stack trace, takrorlanish, ta’sirlangan foydalanuvchilar va hodisalar. */
export function ErrorDrawer({ fingerprint, onClose }: { fingerprint: string; onClose: () => void }) {
  const detail = useErrorGroupDetail(fingerprint);
  const resolve = useResolveErrors();
  const d = detail.data;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const s = d?.sample;
  const severe = s?.severity === 'ERROR';
  const device = s?.userAgent ? describeDevice(s.userAgent) : null;
  const maxDaily = Math.max(1, ...(d?.daily.map((row) => row.count) ?? [1]));
  const stackLines = s?.stack?.split('\n').slice(0, 40) ?? [];

  return (
    <>
      <div className="gm-udr__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="gm-udr" role="dialog" aria-modal="true" aria-label={t('Xato tafsilotlari')}>
        <header className="gm-edr__head">
          <small>{t('Xato tafsilotlari')}</small>
          <Button variant="ghost" size="sm" iconOnly className="gm-udr__close" onClick={onClose} aria-label={t('Yopish')}><X size={18} /></Button>
        </header>
        <div className="gm-udr__body">
          {detail.isError && <Alert tone="danger">{getErrorMessage(detail.error)}</Alert>}
          {detail.isLoading && <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>}
          {d && s && (
            <>
              <div className="gm-edr__top">
                <span className={cx('gm-edr__code', severe ? 'is-red' : 'is-amber')}>{s.status ?? '—'}</span>
                <Badge tone={severe ? 'danger' : 'warning'}>{severe ? t('Jiddiy') : t('Ogohlantirish')}</Badge>
                <Badge tone={d.resolved ? 'success' : 'danger'}>{d.resolved ? t('Yechilgan') : t('Hal qilinmagan')}</Badge>
              </div>
              <div>
                <h2 className="gm-edr__title">{statusName(s.status, s.kind)}</h2>
                <p className="gm-udr__muted">{s.message}</p>
              </div>

              <section className="gm-udr__card">
                <h3>{t('Asosiy ma’lumotlar')}</h3>
                <Info label={t('Xato kodi')}>{s.status ?? s.code ?? '—'}</Info>
                {s.code && <Info label={t('Ichki kod')}><code>{s.code}</code></Info>}
                <Info label={t('Xato turi')}>{KIND_LABEL[s.kind]}</Info>
                <Info label={t('Endpoint')}><code>{whereOf(s)}</code></Info>
                <Info label={t('Manba')}>{s.source === 'SERVER' ? t('Server') : t('Veb / ilova')}{s.platform ? ` · ${PLATFORM_LABEL[s.platform] ?? s.platform}` : ''}</Info>
                {s.panel && <Info label={t('Panel')}>{PANEL_LABEL[s.panel] ?? s.panel}</Info>}
                <Info label={t('Tavsif')}>{s.message}</Info>
                <div className="gm-udr__row">
                  <span>{t('Bajaruvchi')}</span>
                  <strong className="gm-edr__actor">
                    {s.user ? (
                      <>
                        <UserAvatar name={accountName(s.user)} seed={s.user.id} size="sm" src={s.user.avatar} />
                        <span><AccountLink accountNumber={s.user.accountNumber}>{accountName(s.user)}</AccountLink><small>{s.userRole ? (PANEL_LABEL[s.userRole] ?? s.userRole) : ''} · ID {s.user.accountNumber}</small></span>
                      </>
                    ) : (
                      t('Noma’lum / tizim')
                    )}
                  </strong>
                </div>
                <Info label={t('IP manzil')}>{s.ipAddress ?? '—'}</Info>
                {device && <Info label={t('Qurilma')}>{device.browser} · {device.os}</Info>}
                {s.appVersion && <Info label={t('Ilova versiyasi')}>{s.appVersion}</Info>}
                {s.requestId && <Info label={t('So‘rov ID')}><code>{s.requestId.slice(0, 13)}</code></Info>}
                <Info label={t('Vaqt')}>{formatDateTime(s.createdAt)}</Info>
              </section>

              {s.stack && (
                <section className="gm-udr__card">
                  <div className="gm-edr__stackhead">
                    <h3>{t('Xato matni (stack trace)')}</h3>
                    <Copyable text={s.stack} label={t('Nusxalash')} />
                  </div>
                  <pre className="gm-edr__stack">
                    {stackLines.map((line, index) => (
                      <span key={index}><i>{index + 1}</i>{line}{'\n'}</span>
                    ))}
                  </pre>
                </section>
              )}

              <section className="gm-udr__card">
                <h3>{t('Tegishli endpoint')}</h3>
                <div className="gm-edr__endpoint">
                  <code>{whereOf(s)}</code>
                  <Copyable text={whereOf(s)} label={t('Nusxalash')} />
                </div>
              </section>

              <section className="gm-udr__card">
                <h3>{t('Takrorlanish va foydalanuvchilar')}</h3>
                <div className="gm-edr__stats">
                  <div><small>{t('Takrorlanish')}</small><strong>{d.count}</strong></div>
                  <div><small>{t('Ta’sirlangan foydalanuvchilar')}</small><strong>{d.users} {t('ta')}</strong></div>
                </div>
                <div className="gm-edr__mini" aria-label={t('Oxirgi 7 kun')}>
                  {d.daily.length === 0 && <small className="gm-udr__muted">{t('Oxirgi 7 kunda takrorlanmagan.')}</small>}
                  {d.daily.map((row) => (
                    <span key={row.day} title={`${formatDate(row.day)}: ${row.count}`}>
                      <b style={{ height: `${Math.max(6, (row.count / maxDaily) * 100)}%` }} />
                      <small>{formatDate(row.day).slice(0, 5)}</small>
                    </span>
                  ))}
                </div>
                {d.topUsers.length > 0 && (
                  <div className="gm-edr__users">
                    {d.topUsers.map((row) => row.user && (
                      <div key={row.user.id}>
                        <UserAvatar name={accountName(row.user)} seed={row.user.id} size="sm" src={row.user.avatar} />
                        <AccountLink accountNumber={row.user.accountNumber}>{accountName(row.user)}</AccountLink>
                        <em>{row.count} {t('marta')}</em>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="gm-udr__card">
                <h3>{t('Vaqt bo‘yicha hodisalar')}</h3>
                <div className="gm-edr__timeline">
                  <div><i /><span><strong>{t('Birinchi marta yuz berdi')}</strong><small>{formatDateTime(d.firstSeenAt)}</small></span></div>
                  {d.recent.slice().reverse().slice(-6).map((row) => (
                    <div key={row.id}>
                      <i className="is-small" />
                      <span><strong>{t('Xato takrorlandi')}{row.user ? ` · ${accountName(row.user)}` : ''}</strong><small>{formatDateTime(row.createdAt)}{row.ipAddress ? ` · ${row.ipAddress}` : ''}</small></span>
                    </div>
                  ))}
                  <div><i className="is-blue" /><span><strong>{t('Oxirgi marta')}</strong><small>{formatDateTime(d.lastSeenAt)} · {formatRelativeTime(d.lastSeenAt)}</small></span></div>
                  {d.resolved && d.resolvedAt && <div><i className="is-green" /><span><strong>{t('Hal qilindi deb belgilandi')}</strong><small>{formatDateTime(d.resolvedAt)}</small></span></div>}
                </div>
              </section>

              <section className="gm-udr__card">
                <h3>{t('Amallar')}</h3>
                {d.resolved ? (
                  <Button variant="secondary" fullWidth loading={resolve.isPending} onClick={() => resolve.mutate({ fingerprint, value: false })}><RotateCcw size={16} aria-hidden="true" /> {t('Qayta ochish')}</Button>
                ) : (
                  <Button fullWidth loading={resolve.isPending} onClick={() => resolve.mutate({ fingerprint, value: true })}><Check size={16} aria-hidden="true" /> {t('Hal qilindi deb belgilash')}</Button>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
