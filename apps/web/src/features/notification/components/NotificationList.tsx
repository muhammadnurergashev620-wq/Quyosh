import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { dayKey, dayLabel } from '@/lib/tashkent-time';
import { useAuthStore } from '@/store/auth.store';
import { env } from '@/lib/env';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';
import { useMarkAllAsRead, useMarkAsRead, useNotifications } from '../hooks/useNotifications';
import { notificationMeta, notificationText } from '../notification-meta';
import type { AppNotification } from '../types';
import './NotificationList.css';
import { t } from '@/i18n';

type Filter = 'all' | 'unread';

export function NotificationList() {
  const navigate = useNavigate();
  const preferredRole = useAuthStore((state) => state.preferredRole);
  const base = (env.appRole ?? preferredRole) === 'SHOP' ? '/dokon' : '/mijoz';
  const admin = (env.appRole ?? preferredRole) === 'ADMIN';
  const notifications = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const [filter, setFilter] = useState<Filter>('all');

  const all = useMemo(() => notifications.data?.items ?? [], [notifications.data]);
  const unreadCount = all.filter((item) => item.status !== 'READ').length;
  const visible = useMemo(() => (filter === 'unread' ? all.filter((item) => item.status !== 'READ') : all), [all, filter]);

  const groups = useMemo(() => {
    const result: Array<{ key: string; label: string; items: AppNotification[] }> = [];
    for (const item of visible) {
      const key = dayKey(item.createdAt);
      const last = result[result.length - 1];
      if (last?.key === key) last.items.push(item);
      else result.push({ key, label: dayLabel(item.createdAt), items: [item] });
    }
    return result;
  }, [visible]);

  function open(item: AppNotification) {
    if (item.status !== 'READ') markAsRead.mutate(item.id);
    const { to } = notificationMeta(item, base, admin);
    if (to) navigate(to);
  }

  if (notifications.isLoading) {
    return (
      <div className="gm-notify__skeletons" aria-busy="true">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="gm-notify__skeleton" />
        ))}
      </div>
    );
  }
  if (notifications.isError) return <Alert tone="danger">{getErrorMessage(notifications.error)}</Alert>;

  return (
    <div className="gm-notify">
      <div className="gm-notify__bar">
        <div className="gm-notify__tabs" role="tablist" aria-label={t('Filtr')}>
          <button type="button" role="tab" aria-selected={filter === 'all'} className={cx('gm-notify__tab', filter === 'all' && 'gm-notify__tab--active')} onClick={() => setFilter('all')}>{t('Hammasi')}</button>
          <button type="button" role="tab" aria-selected={filter === 'unread'} className={cx('gm-notify__tab', filter === 'unread' && 'gm-notify__tab--active')} onClick={() => setFilter('unread')}>{t('O‘qilmagan')}{unreadCount > 0 && <span className="gm-notify__count">{unreadCount}</span>}
          </button>
        </div>
        <Button size="sm" variant="secondary" aria-label={t('Hammasini o‘qilgan deb belgilash')} className="gm-notify__markall-btn" disabled={unreadCount === 0} loading={markAllAsRead.isPending} onClick={() => markAllAsRead.mutate()}>
          <CheckCheck size={16} /> <span className="gm-notify__markall">{t('Hammasini o‘qilgan deb belgilash')}</span>
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<BellOff size={28} />}
          title={filter === 'unread' ? t('Hammasi o‘qilgan') : t('Bildirishnomalar yo‘q')}
          description={filter === 'unread' ? t('Yangi bildirishnomalar shu yerda paydo bo‘ladi.') : t('So‘rov, taklif, montaj va chat xabarlari shu yerda ko‘rinadi.')}
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} className="gm-notify__group" aria-label={group.label}>
            <h2 className="gm-notify__day">{group.label}</h2>
            <ul className="gm-notify__list">
              {group.items.map((item) => {
                const meta = notificationMeta(item, base, admin);
                const text = notificationText(item, base);
                const Icon = meta.icon;
                const unread = item.status !== 'READ';
                return (
                  <li key={item.id}>
                    <button type="button" className={cx('gm-notify__item', unread && 'gm-notify__item--unread')} onClick={() => open(item)}>
                      <span className={cx('gm-notify__icon', `gm-notify__icon--${meta.tone}`)} aria-hidden="true">
                        <Icon size={20} strokeWidth={1.9} />
                      </span>
                      <span className="gm-notify__body">
                        <strong>{text.title}</strong>
                        <span>{text.body}</span>
                        <small>{formatRelativeTime(item.createdAt)}</small>
                      </span>
                      {unread && <span className="gm-notify__dot" aria-label={t('O‘qilmagan')} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
