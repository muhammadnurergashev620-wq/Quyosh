import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, BellOff, CheckCheck, X } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { getErrorMessage } from '@/lib/error-messages';
import { toast } from '@/lib/toast';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import { useMarkAllAsRead, useNotifications, useUnreadCount } from '../hooks/useNotifications';
import { useNotificationTarget } from '../hooks/useNotificationTarget';
import { FILTERS, groupByDate, matchesFilter } from '../notification-ui';
import type { NotificationFilter } from '../notification-ui';
import { NotificationRow } from './NotificationRow';
import './NotificationPanel.css';

const PANEL_LIMIT = 8;
const MOBILE = '(max-width: 639px)';

function useIsMobile(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(MOBILE);
      media.addEventListener('change', notify);
      return () => media.removeEventListener('change', notify);
    },
    () => window.matchMedia(MOBILE).matches,
    () => false,
  );
}

/**
 * Qo‘ng‘iroq + bildirishnomalar paneli: kompyuterda 400 px dropdown, mobilda pastdan chiquvchi sheet.
 * Yangi bildirishnoma kelganda qo‘ng‘iroq bir marta silkinadi va toast chiqadi.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;
  const [open, setOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const prev = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mobile = useIsMobile();

  useEffect(() => {
    if (unread.data === undefined) return;
    const before = prev.current;
    prev.current = count;
    if (before === null || count <= before) return;
    setShake(true);
    const id = window.setTimeout(() => setShake(false), 900);
    toast.info(t('Yangi bildirishnoma'), {
      id: 'notification-new',
      description: count - before > 1 ? t('{count} ta yangi bildirishnoma', { count: count - before }) : undefined,
      action: { label: t('Ko‘rish'), onClick: () => navigate('/bildirishnomalar') },
    });
    return () => window.clearTimeout(id);
  }, [count, unread.data, navigate]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const sheet = (
    <>
      <div className="gm-npanel__scrim" aria-hidden="true" onClick={() => setOpen(false)} />
      <div ref={panelRef} className="gm-npanel" role="dialog" aria-modal={mobile || undefined} aria-label={t('Bildirishnomalar')} tabIndex={-1}>
        <NotificationPanelBody onClose={() => setOpen(false)} />
      </div>
    </>
  );

  return (
    <div className="gm-nbell" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cx('gm-aheader__bell', shake && 'is-shaking')}
        aria-label={count > 0 ? t('Bildirishnomalar, {count} ta yangi', { count }) : t('Bildirishnomalar')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={19} strokeWidth={2} aria-hidden="true" />
        {count > 0 && <span className="gm-aheader__badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (mobile ? createPortal(sheet, document.body) : sheet)}
    </div>
  );
}

function NotificationPanelBody({ onClose }: { onClose: () => void }) {
  const notifications = useNotifications();
  const markAll = useMarkAllAsRead();
  const { base, admin, open, markRead } = useNotificationTarget();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const all = useMemo(() => notifications.data?.items ?? [], [notifications.data]);
  const unreadCount = all.filter((item) => item.status !== 'READ').length;
  const visible = useMemo(() => all.filter((item) => matchesFilter(item, filter)).slice(0, PANEL_LIMIT), [all, filter]);
  const groups = useMemo(() => groupByDate(visible), [visible]);

  return (
    <>
      <header className="gm-npanel__head">
        <span className="gm-npanel__grip" aria-hidden="true" />
        <h2>{t('Bildirishnomalar')}</h2>
        <Button variant="link" size="sm" disabled={unreadCount === 0} loading={markAll.isPending} onClick={() => markAll.mutate()} leftIcon={<CheckCheck />}>
          {t('Hammasini o‘qilgan')}
        </Button>
        <Button variant="ghost" size="sm" iconOnly aria-label={t('Yopish')} className="gm-npanel__close" onClick={onClose}>
          <X />
        </Button>
      </header>
      <div className="gm-npanel__tabs">
        <Tabs
          size="sm"
          label={t('Filtr')}
          value={filter}
          onChange={setFilter}
          items={FILTERS.map((item) => ({ value: item.value, label: item.label(), count: item.value === 'unread' && unreadCount > 0 ? unreadCount : undefined }))}
        />
      </div>
      <div className="gm-npanel__list">
        {notifications.isLoading ? (
          <div className="gm-npanel__skeletons" aria-busy="true">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="gm-npanel__skeleton">
                <Skeleton className="gm-npanel__skeleton-icon" />
                <div><Skeleton className="gm-npanel__skeleton-line" /><Skeleton className="gm-npanel__skeleton-line gm-npanel__skeleton-line--short" /></div>
              </div>
            ))}
          </div>
        ) : notifications.isError ? (
          <Alert tone="danger">{getErrorMessage(notifications.error)}</Alert>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<BellOff size={28} />}
            title={filter === 'unread' ? t('Hammasi o‘qilgan') : t('Bildirishnomalar yo‘q')}
            description={t('Yangi bildirishnomalar shu yerda paydo bo‘ladi.')}
          />
        ) : (
          groups.map((group) => (
            <section key={group.key} className="gm-npanel__group" aria-label={group.label}>
              <h3 className="gm-npanel__day">{group.label}</h3>
              <ul className="gm-npanel__rows">
                {group.items.map((item) => (
                  <NotificationRow key={item.id} item={item} base={base} admin={admin} compact onOpen={(value) => open(value, onClose)} onMarkRead={markRead} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      <footer className="gm-npanel__foot">
        <Link to="/bildirishnomalar" className="gm-npanel__all" onClick={onClose}>
          {t('Barcha bildirishnomalar')} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </footer>
    </>
  );
}
