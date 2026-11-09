import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorState } from '@/components/ui/ErrorState';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BellOff, CheckCheck, ListChecks, X } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { toast } from '@/lib/toast';
import { t } from '@/i18n';
import { useMarkAllAsRead, useNotifications } from '../hooks/useNotifications';
import { useNotificationTarget } from '../hooks/useNotificationTarget';
import { FILTERS, groupByDate, matchesFilter } from '../notification-ui';
import type { NotificationFilter } from '../notification-ui';
import { notificationService } from '../services/notification.service';
import { NotificationRow } from './NotificationRow';
import './NotificationList.css';

/** «Bildirishnomalar» sahifasi: yorliqlar (Hammasi · O‘qilmagan · Takliflar · Montaj · Tizim), sana guruhlari, ommaviy belgilash. */
export function NotificationList() {
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const markAll = useMarkAllAsRead();
  const { base, admin, open, markRead } = useNotificationTarget();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const all = useMemo(() => notifications.data?.items ?? [], [notifications.data]);
  const unreadCount = all.filter((item) => item.status !== 'READ').length;
  const visible = useMemo(() => all.filter((item) => matchesFilter(item, filter)), [all, filter]);
  const groups = useMemo(() => groupByDate(visible), [visible]);
  const counts = useMemo(() => {
    const map: Partial<Record<NotificationFilter, number>> = {};
    for (const f of FILTERS) if (f.value !== 'all') map[f.value] = all.filter((item) => item.status !== 'READ' && matchesFilter(item, f.value)).length;
    return map;
  }, [all]);

  const selectableIds = visible.filter((item) => item.status !== 'READ').map((item) => item.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function markSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkPending(true);
    const results = await Promise.allSettled(ids.map((id) => notificationService.markAsRead(id)));
    setBulkPending(false);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) toast.error(t('{count} ta bildirishnomani belgilab bo‘lmadi', { count: failed }));
    else toast.success(t('{count} ta bildirishnoma o‘qilgan deb belgilandi', { count: ids.length }));
    stopSelecting();
  }

  if (notifications.isLoading) {
    return (
      <div className="gm-notify__skeletons" aria-busy="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="gm-notify__skeleton">
            <Skeleton className="gm-notify__skeleton-icon" />
            <div><Skeleton className="gm-notify__skeleton-line" /><Skeleton className="gm-notify__skeleton-line gm-notify__skeleton-line--short" /></div>
          </div>
        ))}
      </div>
    );
  }
  if (notifications.isError) return <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />;

  return (
    <div className="gm-notify">
      <div className="gm-notify__bar">
        <Tabs
          label={t('Filtr')}
          value={filter}
          onChange={(value) => { setFilter(value); setSelected(new Set()); }}
          items={FILTERS.map((item) => ({ value: item.value, label: item.label(), count: item.value === 'all' ? undefined : counts[item.value] || undefined }))}
        />
        <div className="gm-notify__actions">
          {selecting ? (
            <>
              <Checkbox inline labelClassName="gm-notify__selectall" label={<span>{t('Hammasini tanlash')}</span>} checked={allSelected} disabled={selectableIds.length === 0} onChange={() => setSelected(allSelected ? new Set() : new Set(selectableIds))} />
              <Button size="sm" leftIcon={<CheckCheck />} disabled={selected.size === 0} loading={bulkPending} onClick={() => void markSelected()}>
                {t('O‘qilgan qilish')}{selected.size > 0 ? ` (${selected.size})` : ''}
              </Button>
              <Button size="sm" variant="ghost" iconOnly aria-label={t('Bekor qilish')} onClick={stopSelecting}><X /></Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" leftIcon={<ListChecks />} disabled={unreadCount === 0} onClick={() => setSelecting(true)}>{t('Tanlash')}</Button>
              <Button size="sm" variant="secondary" leftIcon={<CheckCheck />} disabled={unreadCount === 0} loading={markAll.isPending} onClick={() => markAll.mutate()}>
                {t('Hammasini o‘qilgan deb belgilash')}
              </Button>
            </>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="gm-notify__empty">
          <EmptyState
            icon={<BellOff size={28} />}
            title={filter === 'unread' ? t('Hammasi o‘qilgan') : t('Bildirishnomalar yo‘q')}
            description={filter === 'unread' ? t('Yangi bildirishnomalar shu yerda paydo bo‘ladi.') : t('So‘rov, taklif, montaj va chat xabarlari shu yerda ko‘rinadi.')}
          />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="gm-notify__group" aria-label={group.label}>
            <h2 className="gm-notify__day">{group.label}</h2>
            <ul className="gm-notify__list">
              {group.items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  base={base}
                  admin={admin}
                  onOpen={(value) => (selecting && value.status !== 'READ' ? toggle(value.id) : open(value))}
                  onMarkRead={markRead}
                  leading={selecting ? (
                    <Checkbox hideLabel label={t('Tanlash')} checked={selected.has(item.id)} disabled={item.status === 'READ'} onChange={() => toggle(item.id)} />
                  ) : undefined}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
