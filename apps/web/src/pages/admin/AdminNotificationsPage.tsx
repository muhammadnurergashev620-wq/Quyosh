import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, Eye, Mail, MailOpen, MoreHorizontal, RotateCcw, Search, Settings, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatNumber, formatTime } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import { UserAvatar } from '@/components/common/UserAvatar';
import { AdminNotificationDrawer } from '@/features/notification/admin/AdminNotificationDrawer';
import { CATEGORY, PRIORITY, ROLE_LABEL, notificationTitle } from '@/features/notification/admin/notify-ui';
import { useAdminNotificationActions, useAdminNotificationStats, useAdminNotifications } from '@/features/notification/hooks/useAdminNotifications';
import type { AdminNotificationBucket, AdminNotificationCategory, AdminNotificationFilters, AdminNotificationItem, AdminNotificationPriority } from '@/features/notification/admin-types';
import { pageNumbers } from '@/features/admin/users/users-ui';
import '@/features/notification/admin/AdminNotificationDrawer.css';
import './AdminUsersPage.css';
import '@/features/admin/list-shared.css';
import './AdminNotificationsPage.css';
import { t } from '@/i18n';

type Tab = '' | 'UNREAD' | 'HIGH' | 'SYSTEM';
const isoDay = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined);
const CATEGORIES = Object.keys(CATEGORY) as AdminNotificationCategory[];

function Kpi({ icon, tone, label, bucket, on, onClick }: { icon: React.ReactNode; tone: string; label: string; bucket: AdminNotificationBucket | undefined; on: boolean; onClick: () => void }) {
  const change = bucket?.changePercent ?? null;
  return (
    <button type="button" className={cx('gm-ukpi gm-ukpi--btn', on && 'is-on')} onClick={onClick} aria-pressed={on}>
      <span className={cx('gm-ukpi__icon', `gm-nt--${tone}`)}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{bucket ? formatNumber(bucket.total) : '…'}{change !== null && change !== 0 && <em className={change > 0 ? 'is-up' : 'is-down'}>{change > 0 ? '↑' : '↓'} {Math.abs(change)}%</em>}</strong>
        <span>{t('Oxirgi 7 kunda: {count}', { count: bucket ? bucket.last7 : '…' })} · {t('oldingi 7 kunda: {count}', { count: bucket ? bucket.prev7 : '…' })}</span>
      </div>
    </button>
  );
}

export function AdminNotificationsPage() {
  const pushToast = useAppStore((state) => state.pushToast);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('');
  const [category, setCategory] = useState<AdminNotificationCategory | ''>('');
  const [priority, setPriority] = useState<AdminNotificationPriority | ''>('');
  const [state, setState] = useState<'' | 'UNREAD' | 'READ'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);

  // Tab tanlovi filtrlarga aylanadi (tab — tezkor qisqartma).
  const effective = {
    state: tab === 'UNREAD' ? ('UNREAD' as const) : state || undefined,
    priority: tab === 'HIGH' ? ('HIGH' as const) : priority || undefined,
    category: tab === 'SYSTEM' ? ('SYSTEM' as const) : category || undefined,
  };
  const filters = useMemo<AdminNotificationFilters>(
    () => ({ search: search.trim() || undefined, state: effective.state, priority: effective.priority, category: effective.category, from: dayStart(from), to: dayEnd(to), dir }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, tab, state, priority, category, from, to, dir],
  );
  const list = useAdminNotifications(filters, page, pageSize);
  const stats = useAdminNotificationStats();
  const { markRead, markAll } = useAdminNotificationActions();
  const data = list.data;
  const items = data?.items ?? [];
  const s = stats.data;
  const dirty = !!(search || tab || category || priority || state || from || to);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [filters, pageSize]);
  useEffect(() => setSelected(new Set()), [page]);
  useEffect(() => {
    if (!dateOpen) return;
    const onDown = (event: PointerEvent) => {
      if (dateRef.current && !dateRef.current.contains(event.target as Node)) setDateOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [dateOpen]);

  const reset = () => {
    setSearch('');
    setTab('');
    setCategory('');
    setPriority('');
    setState('');
    setFrom('');
    setTo('');
  };
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const unreadSelected = items.filter((item) => selected.has(item.id) && !item.read).map((item) => item.id);
  const dateLabel = from || to ? `${from ? formatDate(from) : '…'} – ${to ? formatDate(to) : '…'}` : t('Barcha vaqt');

  const objectCell = (item: AdminNotificationItem) => {
    if (item.object?.type === 'Order') {
      return (
        <div className="gm-ul__user">
          <span className="gm-nt__obj gm-nt--amber">{CATEGORY.ORDER.icon}</span>
          <div>
            <strong>{item.object.number ? `№${item.object.number}` : t('Buyurtma')}</strong>
            <small>{item.actor ? `${accountName(item.actor)} · ${ROLE_LABEL[item.actor.role]}` : t('Buyurtma')}</small>
          </div>
        </div>
      );
    }
    if (item.actor) {
      return (
        <div className="gm-ul__user">
          <UserAvatar name={accountName(item.actor)} seed={item.actor.id} size="md" src={item.actor.avatar} />
          <div>
            <strong>{accountName(item.actor)}</strong>
            <small>{ROLE_LABEL[item.actor.role]}</small>
          </div>
        </div>
      );
    }
    return (
      <div className="gm-ul__user">
        <span className="gm-nt__obj gm-nt--gray"><Settings size={17} aria-hidden="true" /></span>
        <div>
          <strong>{t('Tizim')}</strong>
          <small>{t('Avtomatik')}</small>
        </div>
      </div>
    );
  };

  return (
    <div className="gm-ul gm-ntf">
      <header className="gm-ul__head gm-adm2__head">
        <span className="gm-adm2__logo"><Bell size={26} aria-hidden="true" /></span>
        <div>
          <h1>{t('Bildirishnomalar')}</h1>
          <p>{t('Tizim, buyurtma, to‘lov va xavfsizlik bo‘yicha yangiliklar')}</p>
        </div>
        <div className="gm-ntf__tools gm-adm2__create">
          <Button variant="secondary" loading={markAll.isPending} disabled={!s || s.unread.total === 0} onClick={() => markAll.mutate(undefined, { onSuccess: () => pushToast(t('Hammasi o‘qilgan deb belgilandi'), 'success') })}>
            <CheckCheck size={16} aria-hidden="true" /> {t('Hammasini o‘qilgan deb belgilash')}
          </Button>
        </div>
      </header>

      <div className="gm-ul__kpis gm-ntf__kpis">
        <Kpi icon={<Bell size={24} />} tone="blue" label={t('Jami bildirishnomalar')} bucket={s?.total} on={!tab} onClick={() => setTab('')} />
        <Kpi icon={<Mail size={24} />} tone="green" label={t('O‘qilmagan')} bucket={s?.unread} on={tab === 'UNREAD'} onClick={() => setTab('UNREAD')} />
        <Kpi icon={<ShieldAlert size={24} />} tone="red" label={t('Muhim')} bucket={s?.important} on={tab === 'HIGH'} onClick={() => setTab('HIGH')} />
        <Kpi icon={<Settings size={24} />} tone="violet" label={t('Tizim')} bucket={s?.system} on={tab === 'SYSTEM'} onClick={() => setTab('SYSTEM')} />
      </div>

      <section className="gm-ul__panel">
        <div className="gm-ul__toolbar">
          <label className="gm-ul__search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Sarlavha yoki matn bo‘yicha qidirish...')} aria-label={t('Qidirish')} autoComplete="off" />
          </label>
          <label className="gm-ul__select">
            <span>{t('Kategoriyalar')}</span>
            <select value={category} onChange={(event) => { setCategory(event.target.value as AdminNotificationCategory | ''); if (tab === 'SYSTEM') setTab(''); }} disabled={tab === 'SYSTEM'}>
              <option value="">{t('Barcha kategoriyalar')}</option>
              {CATEGORIES.map((key) => <option key={key} value={key}>{CATEGORY[key].label}</option>)}
            </select>
          </label>
          <label className="gm-ul__select">
            <span>{t('Darajalar')}</span>
            <select value={priority} onChange={(event) => { setPriority(event.target.value as AdminNotificationPriority | ''); if (tab === 'HIGH') setTab(''); }} disabled={tab === 'HIGH'}>
              <option value="">{t('Barcha darajalar')}</option>
              {(Object.keys(PRIORITY) as AdminNotificationPriority[]).map((key) => <option key={key} value={key}>{PRIORITY[key].label}</option>)}
            </select>
          </label>
          <div className="gm-ord2__date" ref={dateRef}>
            <label className="gm-ul__select">
              <span>{t('Sana oralig‘i')}</span>
              <button type="button" className="gm-ntf__datebtn" onClick={() => setDateOpen((open) => !open)} aria-expanded={dateOpen}>
                <CalendarDays size={15} aria-hidden="true" /> {dateLabel}
              </button>
            </label>
            {dateOpen && (
              <div className="gm-ul__pop gm-ord2__datepop">
                <label><span>{t('Sanadan')}</span><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
                <label><span>{t('Sanagacha')}</span><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
                <div className="gm-aud__presets">
                  <button type="button" onClick={() => { setFrom(isoDay(0)); setTo(isoDay(0)); }}>{t('Bugun')}</button>
                  <button type="button" onClick={() => { setFrom(isoDay(6)); setTo(isoDay(0)); }}>{t('7 kun')}</button>
                  <button type="button" onClick={() => { setFrom(isoDay(29)); setTo(isoDay(0)); }}>{t('30 kun')}</button>
                  <button type="button" onClick={() => { setFrom(''); setTo(''); }}>{t('Barcha vaqt')}</button>
                </div>
              </div>
            )}
          </div>
          <label className="gm-ul__select">
            <span>{t('O‘qilganlik holati')}</span>
            <select value={state} onChange={(event) => { setState(event.target.value as '' | 'UNREAD' | 'READ'); if (tab === 'UNREAD') setTab(''); }} disabled={tab === 'UNREAD'}>
              <option value="">{t('Barcha holatlar')}</option>
              <option value="UNREAD">{t('O‘qilmagan')}</option>
              <option value="READ">{t('O‘qilgan')}</option>
            </select>
          </label>
          <Button variant="ghost" onClick={reset} disabled={!dirty}>
            <RotateCcw size={15} aria-hidden="true" /> {t('Tozalash')}
          </Button>
        </div>

        <div className="gm-aud__tabs" role="tablist">
          {([['', t('Barchasi'), s?.total.total], ['UNREAD', t('O‘qilmagan'), s?.unread.total], ['HIGH', t('Muhim'), s?.important.total], ['SYSTEM', t('Tizim'), s?.system.total]] as Array<[Tab, string, number | undefined]>).map(([value, label, count]) => (
            <button key={value || 'all'} type="button" role="tab" aria-selected={tab === value} className={cx(tab === value && 'is-on')} onClick={() => setTab(value)}>
              {label}{count !== undefined && <span>{formatNumber(count)}</span>}
            </button>
          ))}
        </div>

        <div className="gm-ul__bulk">
          <label className="gm-ul__check">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))} disabled={items.length === 0} />
            <span>{selected.size > 0 ? t('Tanlandi: {count}', { count: selected.size }) : t('Barchasini tanlash')}</span>
          </label>
          <Button size="sm" variant="secondary" loading={markRead.isPending} disabled={unreadSelected.length === 0} onClick={() => markRead.mutate(unreadSelected, { onSuccess: (result) => { pushToast(t('{count} ta bildirishnoma o‘qilgan deb belgilandi', { count: result.count }), 'success'); setSelected(new Set()); } })}>
            <Check size={15} aria-hidden="true" /> {t('Tanlanganlarni o‘qilgan deb belgilash')}
          </Button>
          {data?.truncated && <small className="gm-ul__hint">{t('Eng so‘nggi 3000 ta bildirishnoma hisobga olingan.')}</small>}
        </div>

        {list.isLoading && <PageLoader label={t('Bildirishnomalar yuklanmoqda…')} />}
        {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}
        {data && items.length === 0 && <EmptyState icon={<Bell size={26} />} title={t('Bildirishnoma topilmadi')} description={dirty ? t('Filtrlarni o‘zgartirib ko‘ring.') : undefined} />}

        {items.length > 0 && (
          <div className={cx('gm-ul__table', list.isFetching && 'is-loading')}>
            <table>
              <thead>
                <tr>
                  <th className="gm-ul__c-check" />
                  <th className="gm-ul__c-num">#</th>
                  <th>{t('Kategoriya')}</th>
                  <th>{t('Sarlavha')}</th>
                  <th className="gm-ul__c-phone">{t('Foydalanuvchi / Obyekt')}</th>
                  <th><button type="button" onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')}>{t('Vaqt')} {dir === 'desc' ? '↓' : '↑'}</button></th>
                  <th>{t('Daraja')}</th>
                  <th>{t('Holat')}</th>
                  <th className="gm-ul__c-act">{t('Amallar')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const category = CATEGORY[item.category];
                  const priority = PRIORITY[item.priority];
                  return (
                    <tr key={item.id} className={cx(openId === item.id && 'is-open', selected.has(item.id) && 'is-selected', !item.read && 'gm-ntf__unread')} onClick={() => setOpenId(item.id)}>
                      <td className="gm-ul__c-check" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} aria-label={t('{title} ni tanlash', { title: notificationTitle(item) })} />
                      </td>
                      <td className="gm-ul__c-num">{(page - 1) * pageSize + index + 1}</td>
                      <td>
                        <span className="gm-ntf__cat"><span className={cx('gm-ntf__cicon', `gm-nt--${category.tone}`)}>{category.icon}</span><b className={`gm-nt-text--${category.tone}`}>{category.label}</b></span>
                      </td>
                      <td>
                        <div className="gm-ntf__text">
                          <strong>{notificationTitle(item)}</strong>
                          <small title={item.body}>{item.body}</small>
                        </div>
                      </td>
                      <td className="gm-ul__c-phone">{objectCell(item)}</td>
                      <td><span className="gm-ul__date">{formatDate(item.createdAt)}<small>{formatTime(item.createdAt)}</small></span></td>
                      <td><Badge tone={priority.tone}>{priority.label}</Badge></td>
                      <td><Badge tone={item.read ? 'success' : 'danger'}>{item.read ? t('O‘qilgan') : t('O‘qilmagan')}</Badge></td>
                      <td className="gm-ul__c-act" onClick={(event) => event.stopPropagation()}>
                        <span className="gm-ul__acts">
                          <button type="button" aria-label={t('Ko‘rish')} title={t('Ko‘rish')} onClick={() => setOpenId(item.id)}><Eye size={16} /></button>
                          <Dropdown
                            triggerClassName="gm-ul__more"
                            label={t('Boshqa amallar')}
                            trigger={<MoreHorizontal size={17} />}
                            items={[
                              { label: t('Batafsil'), icon: <Eye size={16} />, onSelect: () => setOpenId(item.id) },
                              ...(item.read ? [] : [{ label: t('O‘qilgan deb belgilash'), icon: <MailOpen size={16} />, onSelect: () => markRead.mutate([item.id]) }]),
                            ]}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && (
          <footer className="gm-ul__foot">
            <span>{t('Jami:')} <b>{formatNumber(data.total)}</b> {t('ta bildirishnoma')} · <b>{formatNumber(data.unread)}</b> {t('ta o‘qilmagan')}</span>
            <nav className="gm-ul__pager" aria-label={t('Sahifalar')}>
              <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label={t('Oldingi sahifa')}><ChevronLeft size={16} /></button>
              {pageNumbers(page, data.pages).map((entry) =>
                typeof entry === 'number' ? (
                  <button key={entry} type="button" className={cx(entry === page && 'is-on')} aria-current={entry === page ? 'page' : undefined} onClick={() => setPage(entry)}>{entry}</button>
                ) : (
                  <span key={entry}>…</span>
                ),
              )}
              <button type="button" onClick={() => setPage(page + 1)} disabled={page >= data.pages} aria-label={t('Keyingi sahifa')}><ChevronRight size={16} /></button>
              <select className="gm-adm2__size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label={t('Sahifadagi soni')}>
                {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{t('{size} / sahifa', { size })}</option>)}
              </select>
            </nav>
          </footer>
        )}
      </section>

      {openId && <AdminNotificationDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
