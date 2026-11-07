import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, ExternalLink, History, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useAuditRelated } from '@/features/admin/hooks/useAdmin';
import { DOCUMENT_LABEL, FIELD_LABEL, GROUP_INFO, TARGET_LABEL, actionInfo, formatValue } from '@/features/admin/audit-labels';
import type { AuditLog } from '@/features/admin/types';
import { accountName } from '@/lib/account-name';
import { cx } from '@/lib/utils';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { describeDevice } from '@/lib/user-agent';
import { OUTCOME, ROLE_NAME, auditSentence, changesOf, targetPath } from './audit-ui';
import '@/features/admin/users/UserDrawer.css';
import './AuditDrawer.css';
import { t } from '@/i18n';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gm-udr__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/** Audit yozuvini bosganda ochiladigan o‘ng panel: asosiy ma’lumot, o‘zgarishlar, obyekt, qurilma va bog‘liq yozuvlar. */
export function AuditDrawer({ log, onClose, onFilterActor }: { log: AuditLog; onClose: () => void; onFilterActor: (accountNumber: number) => void }) {
  const navigate = useNavigate();
  const related = useAuditRelated(log.id);
  const [raw, setRaw] = useState(false);
  useEffect(() => setRaw(false), [log.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const info = actionInfo(log.action);
  const outcome = OUTCOME[log.outcome ?? 'SUCCESS'];
  const changes = changesOf(log);
  const actorUser = log.actor ?? (!log.actorId && info.group === 'auth' ? log.targetUser : null);
  const targetName = log.targetType ? (TARGET_LABEL[log.targetType] ?? log.targetType) : null;
  const docLabel = log.targetDocumentType ? (DOCUMENT_LABEL[log.targetDocumentType] ?? log.targetDocumentType) : null;
  const path = targetPath(log);
  const device = log.device ? describeDevice(log.device) : null;

  return (
    <>
      <div className="gm-udr__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="gm-udr" role="dialog" aria-modal="true" aria-label={t('Hodisa tafsilotlari')}>
        <header className="gm-adrw__head">
          <div>
            <small>{t('Hodisa tafsilotlari')}</small>
            <Badge tone={outcome.tone}>{outcome.label}</Badge>
            <h2>{info.label}</h2>
            <p>{formatDateTime(log.createdAt)} · {formatRelativeTime(log.createdAt)}</p>
          </div>
          <Button variant="ghost" size="sm" iconOnly className="gm-udr__close" onClick={onClose} aria-label={t('Yopish')}><X size={18} /></Button>
        </header>

        <div className="gm-udr__body">
          <section className="gm-udr__card">
            <h3>{t('Asosiy ma’lumotlar')}</h3>
            <Info label={t('Hodisa ID')}>#{log.code ?? log.id.slice(0, 8)}</Info>
            <Info label={t('Amal turi')}><Badge tone={info.tone}>{GROUP_INFO[info.group].label}</Badge></Info>
            <Info label={t('Amal kodi')}><code>{log.action}</code></Info>
            <Info label={t('Tavsif')}>{auditSentence(log)}</Info>
            <Info label={t('Status')}><Badge tone={outcome.tone}>{outcome.label}</Badge></Info>
            <div className="gm-udr__row">
              <span>{t('Bajaruvchi')}</span>
              <strong className="gm-adrw__actor">
                {actorUser ? (
                  <>
                    <UserAvatar name={accountName(actorUser)} seed={actorUser.id} size="sm" />
                    <span>
                      <b>{accountName(actorUser)}</b>
                      <small>{log.actorRole ? ROLE_NAME[log.actorRole] : ''} · ID {actorUser.accountNumber}</small>
                    </span>
                  </>
                ) : (
                  <span><b>{t('Tizim')}</b><small>{t('Avtomatik amal')}</small></span>
                )}
              </strong>
            </div>
            <Info label={t('IP manzil')}>{log.ipAddress ?? '—'}</Info>
            {log.reason && <Info label={t('Sabab')}>{log.reason}</Info>}
          </section>

          {changes.length > 0 && (
            <section className="gm-udr__card">
              <h3>{t('O‘zgarishlar')}</h3>
              {changes.map((change) => (
                <div key={change.key} className="gm-adrw__change">
                  <span>{FIELD_LABEL[change.key] ?? change.key}</span>
                  <b>
                    {change.hasFrom && <em className="is-old">{formatValue(change.key, change.from)}</em>}
                    {change.hasFrom && change.hasTo && ' → '}
                    {change.hasTo && <em className="is-new">{formatValue(change.key, change.to)}</em>}
                  </b>
                </div>
              ))}
            </section>
          )}

          <section className="gm-udr__card">
            <h3>{t('Obyekt ma’lumotlari')}</h3>
            {log.targetUser ? (
              <div className="gm-adrw__target">
                <UserAvatar name={accountName(log.targetUser)} seed={log.targetUser.id} size="md" />
                <span>
                  <strong>{accountName(log.targetUser)}</strong>
                  <small>ID {log.targetUser.accountNumber} · {log.targetUser.phone}</small>
                </span>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/foydalanuvchilar/${log.targetUser!.accountNumber}`)}>{t('Profil')}</Button>
              </div>
            ) : null}
            {targetName && <Info label={t('Obyekt turi')}>{targetName}{docLabel ? ` · ${docLabel}` : ''}</Info>}
            {log.targetId && <Info label={t('Obyekt ID')}><code>{log.targetId.slice(0, 8)}…</code></Info>}
            {!log.targetUser && !targetName && <p className="gm-udr__muted">{t('Bu amal aniq obyektga bog‘lanmagan.')}</p>}
            {path && <Button fullWidth variant="secondary" onClick={() => navigate(path)}><ExternalLink size={15} aria-hidden="true" /> {t('Obyektni ochish')}</Button>}
          </section>

          <section className="gm-udr__card">
            <h3>{t('Qo‘shimcha ma’lumotlar')}</h3>
            {device ? <Info label={t('Qurilma')}>{device.os}</Info> : <Info label={t('Qurilma')}>{log.device ?? '—'}</Info>}
            {device && <Info label={t('Brauzer')}>{device.browser}</Info>}
            {log.requestId && <Info label={t('So‘rov ID')}><code>{log.requestId.slice(0, 13)}</code></Info>}
            {log.device && <Info label={t('Qurilma satri')}><small className="gm-adrw__ua">{log.device}</small></Info>}
            {(log.before != null || log.after != null) && (
              <>
                <button type="button" className="gm-adrw__raw" aria-expanded={raw} onClick={() => setRaw((value) => !value)}>
                  {raw ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {t('Xom ma’lumot (JSON)')}
                </button>
                {raw && <pre className="gm-adrw__json">{JSON.stringify({ oldin: log.before ?? null, keyin: log.after ?? null }, null, 2)}</pre>}
              </>
            )}
          </section>

          <section className="gm-udr__card">
            <h3>{t('Bog‘liq yozuvlar')}</h3>
            {related.isLoading && <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>}
            {related.data && related.data.items.length === 0 && <p className="gm-udr__muted">{t('Bog‘liq yozuvlar topilmadi.')}</p>}
            {related.data?.items.map((item) => {
              const itemInfo = actionInfo(item.action);
              return (
                <div key={item.id} className="gm-udr__sub">
                  <span>
                    <strong>{itemInfo.label}</strong>
                    <small>#{item.code} · {item.actor ? accountName(item.actor) : t('Tizim')}</small>
                    <small>{formatDateTime(item.createdAt)}</small>
                  </span>
                  <Badge tone={itemInfo.tone}>{GROUP_INFO[itemInfo.group].label}</Badge>
                </div>
              );
            })}
            {actorUser && (
              <Button fullWidth variant="secondary" className={cx('gm-adrw__all')} onClick={() => { onFilterActor(actorUser.accountNumber); onClose(); }}>
                <History size={15} aria-hidden="true" /> {t('Shu bajaruvchining barcha amallari')}
              </Button>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
