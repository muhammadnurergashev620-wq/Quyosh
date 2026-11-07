import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, Download, Eye, Filter, MoreHorizontal, Pencil, RotateCcw, Search, ShieldAlert, Snowflake, Trash2, UserCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatNumber, formatRelativeTime } from '@/lib/format';
import { useDebounce } from '@/hooks/useDebounce';
import { useAppStore } from '@/store/app.store';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useAdminUserStats, useAdminUsersPage, useBulkUserStatus } from '@/features/admin/hooks/useAdmin';
import { adminService } from '@/features/admin/services/admin.service';
import { UserActionDialog } from '@/features/admin/components/UserActionDialog';
import { UserDrawer } from '@/features/admin/users/UserDrawer';
import { USER_STATUS, pageNumbers } from '@/features/admin/users/users-ui';
import type { UserAction } from '@/features/admin/user-actions';
import type { AdminUser, ManagedStatus, UserFilters } from '@/features/admin/types';
import './AdminUsersPage.css';
import { t } from '@/i18n';
import { SelectMenu } from '@/components/ui/SelectMenu';

const PAGE_SIZE = 20;
type RoleFilter = '' | 'CUSTOMER' | 'SHOP';
const STATUSES: ManagedStatus[] = ['ACTIVE', 'PENDING', 'SUSPENDED', 'BLOCKED', 'DELETED'];

function roleBadges(user: AdminUser) {
  return (
    <>
      {user.roles.includes('CUSTOMER') && <Badge tone="primary">{t('Mijoz')}</Badge>}
      {user.roles.includes('SHOP') && <Badge tone="warning">{t('Do‘kon')}</Badge>}
    </>
  );
}

function ShopsCell({ user }: { user: AdminUser }) {
  const shops = user.shopMemberships ?? [];
  if (shops.length === 0) return <span className="gm-ul__muted">—</span>;
  return (
    <span className="gm-ul__sub">
      <b>{shops[0]!.shop.name}</b>
      {shops.length > 1 && <small>+{shops.length - 1}</small>}
    </span>
  );
}

function BulkDialog({ ids, status, onClose, onDone }: { ids: string[]; status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED'; onClose: () => void; onDone: () => void }) {
  const bulk = useBulkUserStatus();
  const pushToast = useAppStore((state) => state.pushToast);
  const [reason, setReason] = useState('');
  const needsReason = status !== 'ACTIVE';
  const title = status === 'ACTIVE' ? t('Tanlanganlarni faollashtirish') : status === 'SUSPENDED' ? t('Tanlanganlarni muzlatish') : t('Tanlanganlarni bloklash');
  return (
    <Modal
      open
      onClose={bulk.isPending ? () => undefined : onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={bulk.isPending}>{t('Bekor qilish')}</Button>
          <Button
            variant={status === 'BLOCKED' ? 'danger' : 'primary'}
            loading={bulk.isPending}
            disabled={needsReason && reason.trim().length < 3}
            onClick={() =>
              bulk.mutate(
                { ids, status, reason: reason.trim() },
                {
                  onSuccess: (result) => {
                    pushToast(result.failed.length ? t('{ok} ta yangilandi, {fail} ta bajarilmadi', { ok: result.updated, fail: result.failed.length }) : t('{ok} ta foydalanuvchi yangilandi', { ok: result.updated }), result.failed.length ? 'info' : 'success');
                    onDone();
                  },
                },
              )
            }
          >
            {t('Tasdiqlash')}
          </Button>
        </>
      }
    >
      <div className="gm-form">
        <Alert tone="info">{t('{count} ta foydalanuvchi tanlangan. Har biri uchun alohida audit yozuvi yaratiladi.', { count: ids.length })}</Alert>
        {bulk.isError && <Alert tone="danger">{getErrorMessage(bulk.error)}</Alert>}
        {needsReason && <Textarea label={t('Sabab')} required rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} hint={t('Kamida 3 ta belgi. Foydalanuvchilar ham, audit jurnali ham shu sababni ko‘radi.')} />}
      </div>
    </Modal>
  );
}

/** CSV katagi; `= + - @` bilan boshlanadigan matn (foydalanuvchi ismi va h.k.) Excel’da formula bo‘lib bajarilmasin. */
const csvCell = (value: string | number | null | undefined) => {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text) && !/^[-+]?\d+([.,]\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export function AdminUsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((state) => state.pushToast);
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role');
  const [role, setRole] = useState<RoleFilter>(initialRole === 'CUSTOMER' || initialRole === 'SHOP' ? initialRole : '');
  const [status, setStatus] = useState<ManagedStatus | ''>(STATUSES.includes(searchParams.get('status') as ManagedStatus) ? (searchParams.get('status') as ManagedStatus) : '');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
    const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<NonNullable<UserFilters['sort']>>('createdAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<AdminUser | null>(null);
  const [dialog, setDialog] = useState<{ user: AdminUser; action: UserAction } | null>(null);
  const [bulk, setBulk] = useState<'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | null>(null);
  const [exporting, setExporting] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search.trim(), 350);

  const filters = useMemo<UserFilters>(
    () => ({ role: role || undefined, status: status || undefined, search: debouncedSearch || undefined, from: from || undefined, to: to || undefined, sort, dir }),
    [role, status, debouncedSearch, from, to, sort, dir],
  );
  const stats = useAdminUserStats();
  const users = useAdminUsersPage(filters, page);
  const data = users.data;
  const items = data?.items ?? [];

  // Filtr o‘zgarganda 1-sahifaga qaytiladi va tanlov tozalanadi.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [filters]);
  useEffect(() => setSelected(new Set()), [page]);
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (event: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setFiltersOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [filtersOpen]);

  const advancedCount = [from, to].filter(Boolean).length;
  const dirty = !!(role || status || search || advancedCount);
  const reset = () => {
    setRole('');
    setStatus('');
    setSearch('');
    setFrom('');
    setTo('');
    setSort('createdAt');
    setDir('desc');
  };

  const selectable = items.filter((user) => user.status !== 'DELETED' && !user.roles.includes('ADMIN'));
  const allSelected = selectable.length > 0 && selectable.every((user) => selected.has(user.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const sortBy = (key: NonNullable<UserFilters['sort']>) => {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  /** Joriy filtrlarga mos BARCHA foydalanuvchilarni CSV (Excel ochadi) qilib yuklaydi. */
  async function exportCsv() {
    setExporting(true);
    try {
      const rows: AdminUser[] = [];
      for (let p = 1; p <= 100; p += 1) {
        const chunk = await adminService.usersPage(filters, p, 100);
        rows.push(...chunk.items);
        if (p >= chunk.pages) break;
      }
      const head = ['ID', t('Ism'), t('Rol'), t('Holat'), t('Telefon'), 'Email', t('Ro‘yxatdan o‘tgan'), t('Oxirgi faollik'), t('Do‘kon')];
      const lines = rows.map((u) =>
        [
          u.accountNumber,
          accountName(u),
          u.roles.map((r) => (r === 'SHOP' ? t('Do‘kon') : r === 'CUSTOMER' ? t('Mijoz') : t('Admin'))).join(' + '),
          USER_STATUS[u.status].label,
          u.phone,
          u.email,
          formatDate(u.createdAt),
          u.lastLoginAt ? formatDate(u.lastLoginAt) : '',
          (u.shopMemberships ?? []).map((m) => m.shop.name).join('; '),
        ].map(csvCell).join(','),
      );
      const blob = new Blob([`﻿${[head.map(csvCell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `foydalanuvchilar-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      pushToast(t('{count} ta foydalanuvchi eksport qilindi', { count: rows.length }), 'success');
    } catch (error) {
      pushToast(getErrorMessage(error), 'error');
    } finally {
      setExporting(false);
    }
  }

  const s = stats.data;
  const growth = s?.total.growthPercent;
  const sortMark = (key: string) => (sort === key ? (dir === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <div className="gm-ul">
      <header className="gm-ul__head">
        <h1>{t('Foydalanuvchilar')}</h1>
        <p>{t('Mijozlar va do‘kon xodimlarini yagona boshqaruv markazidan nazorat qiling')}</p>
      </header>

      <div className="gm-ul__kpis">
        <article className="gm-ukpi">
          <span className="gm-ukpi__icon gm-ukpi__icon--blue"><Users size={24} aria-hidden="true" /></span>
          <div>
            <small>{t('Jami foydalanuvchilar')}</small>
            <strong>{s ? formatNumber(s.total.all) : '…'}{growth !== null && growth !== undefined && <em className={growth >= 0 ? 'is-up' : 'is-down'} title={t('Oxirgi 30 kunda yangi: {count}', { count: s?.total.new30 ?? 0 })}>{growth >= 0 ? '↑' : '↓'} {Math.abs(growth)}%</em>}</strong>
            <span>{t('Mijozlar: {c} | Do‘kon xodimlari: {m}', { c: s ? formatNumber(s.total.customers) : '…', m: s ? formatNumber(s.total.shops) : '…' })}</span>
          </div>
        </article>
        <article className="gm-ukpi">
          <span className="gm-ukpi__icon gm-ukpi__icon--green"><UserCheck size={24} aria-hidden="true" /></span>
          <div>
            <small>{t('Faol akkauntlar')}</small>
            <strong>{s ? formatNumber(s.active.all) : '…'}</strong>
            <span>{t('Mijozlar: {c} | Do‘kon xodimlari: {m}', { c: s ? formatNumber(s.active.customers) : '…', m: s ? formatNumber(s.active.shops) : '…' })}</span>
          </div>
        </article>
        <article className="gm-ukpi">
          <span className="gm-ukpi__icon gm-ukpi__icon--red"><Ban size={24} aria-hidden="true" /></span>
          <div>
            <small>{t('Bloklangan')}</small>
            <strong>{s ? formatNumber(s.blocked.all) : '…'}</strong>
            <span>{t('Mijozlar: {c} | Do‘kon xodimlari: {m}', { c: s ? formatNumber(s.blocked.customers) : '…', m: s ? formatNumber(s.blocked.shops) : '…' })}{s && s.blocked.suspended > 0 && ` · ${t('Muzlatilgan: {n}', { n: s.blocked.suspended })}`}</span>
          </div>
        </article>
        <article className="gm-ukpi">
          <span className="gm-ukpi__icon gm-ukpi__icon--amber"><Clock size={24} aria-hidden="true" /></span>
          <div>
            <small>{t('Tasdiqlanishi kutilmoqda')}</small>
            <strong>{s ? formatNumber(s.pending.all) : '…'}</strong>
            <span>{t('Mijozlar: {c} | Do‘kon xodimlari: {m}', { c: s ? formatNumber(s.pending.customers) : '…', m: s ? formatNumber(s.pending.shops) : '…' })}</span>
          </div>
        </article>
      </div>

      <section className="gm-ul__panel">
        <div className="gm-ul__toolbar">
          <div className="gm-ul__tabs" role="tablist" aria-label={t('Rol bo‘yicha')}>
            {([['', t('Barchasi'), s?.total.all], ['CUSTOMER', t('Mijozlar'), s?.total.customers], ['SHOP', t('Do‘kon xodimlari'), s?.total.shops]] as Array<[RoleFilter, string, number | undefined]>).map(([value, label, count]) => (
              <button key={value || 'all'} type="button" role="tab" aria-selected={role === value} className={cx(role === value && 'is-on')} onClick={() => setRole(value)}>
                {label}{count !== undefined && ` (${formatNumber(count)})`}
              </button>
            ))}
          </div>
          <label className="gm-ul__search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Ism, telefon, ID yoki email bo‘yicha qidirish...')} aria-label={t('Qidirish')} autoComplete="off" />
          </label>
          <label className="gm-ul__select">
            <span>{t('Holat')}</span>
            <SelectMenu value={status} onChange={(event) => setStatus(event.target.value as ManagedStatus | '')}>
              <option value="">{t('Barcha holatlar')}</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>{USER_STATUS[value].label}</option>
              ))}
            </SelectMenu>
          </label>
          <div className="gm-ul__filters" ref={filterRef}>
            <Button variant="secondary" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
              <Filter size={16} aria-hidden="true" /> {t('Filtrlar')}{advancedCount > 0 && <span className="gm-ul__count">{advancedCount}</span>}
            </Button>
            {filtersOpen && (
              <div className="gm-ul__pop">
                <label>
                  <span><CalendarDays size={13} aria-hidden="true" /> {t('Ro‘yxatdan o‘tgan (dan)')}</span>
                  <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
                </label>
                <label>
                  <span><CalendarDays size={13} aria-hidden="true" /> {t('Ro‘yxatdan o‘tgan (gacha)')}</span>
                  <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
                </label>
              </div>
            )}
          </div>
          <Button variant="ghost" onClick={reset} disabled={!dirty}>
            <RotateCcw size={15} aria-hidden="true" /> {t('Tozalash')}
          </Button>
        </div>

        <div className="gm-ul__bulk">
          <label className="gm-ul__check">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((user) => user.id)))} disabled={selectable.length === 0} />
            <span>{selected.size > 0 ? t('Tanlandi: {count}', { count: selected.size }) : t('Barchasini tanlash')}</span>
          </label>
          <Dropdown
            triggerClassName="gm-ul__menu-btn"
            label={t('Ommaviy amal')}
            trigger={<>{t('Ommaviy amal')} <ChevronDown size={15} aria-hidden="true" /></>}
            items={[
              { label: t('Faollashtirish'), icon: <UserCheck size={16} />, onSelect: () => selected.size > 0 && setBulk('ACTIVE') },
              { label: t('Muzlatish'), icon: <Snowflake size={16} />, onSelect: () => selected.size > 0 && setBulk('SUSPENDED') },
              { label: t('Bloklash'), icon: <Ban size={16} />, onSelect: () => selected.size > 0 && setBulk('BLOCKED'), danger: true },
            ]}
          />
          <Button variant="secondary" size="sm" loading={exporting} onClick={() => void exportCsv()} disabled={!data || data.total === 0}>
            <Download size={15} aria-hidden="true" /> {t('Eksport (CSV)')}
          </Button>
          {selected.size === 0 && <small className="gm-ul__hint">{t('Ommaviy amal uchun avval foydalanuvchilarni belgilang.')}</small>}
        </div>

        {users.isLoading && <PageLoader label={t('Foydalanuvchilar yuklanmoqda…')} />}
        {users.isError && <Alert tone="danger">{getErrorMessage(users.error)}</Alert>}
        {data && items.length === 0 && <EmptyState icon={<Search size={28} />} title={t('Foydalanuvchi topilmadi')} description={t('Qidiruv yoki filtrni o‘zgartirib ko‘ring.')} />}

        {items.length > 0 && (
          <div className={cx('gm-ul__table', users.isFetching && 'is-loading')}>
            <table>
              <thead>
                <tr>
                  <th className="gm-ul__c-check" />
                  <th className="gm-ul__c-num">#</th>
                  <th><button type="button" onClick={() => sortBy('name')}>{t('Foydalanuvchi')}{sortMark('name')}</button></th>
                  <th>{t('Rol')}</th>
                  <th>{t('Holat')}</th>
                  <th className="gm-ul__c-phone">{t('Telefon')}</th>
                  <th className="gm-ul__c-id">ID</th>
                  <th><button type="button" onClick={() => sortBy('createdAt')}>{t('Ro‘yxatdan o‘tgan')}{sortMark('createdAt')}</button></th>
                  <th className="gm-ul__c-last"><button type="button" onClick={() => sortBy('lastLoginAt')}>{t('Oxirgi faollik')}{sortMark('lastLoginAt')}</button></th>
                  <th className="gm-ul__c-sub">{t('Do‘kon')}</th>
                  <th className="gm-ul__c-act">{t('Amallar')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user, index) => {
                  const st = USER_STATUS[user.status];
                  const locked = user.status === 'DELETED' || user.roles.includes('ADMIN');
                  const restricted = user.status === 'SUSPENDED' || user.status === 'BLOCKED';
                  const name = accountName(user);
                  return (
                    <tr key={user.id} className={cx(drawer?.id === user.id && 'is-open', selected.has(user.id) && 'is-selected')} onClick={() => setDrawer(user)}>
                      <td className="gm-ul__c-check" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(user.id)} disabled={locked} onChange={() => toggle(user.id)} aria-label={t('{name} ni tanlash', { name })} />
                      </td>
                      <td className="gm-ul__c-num">{(page - 1) * PAGE_SIZE + index + 1}</td>
                      <td>
                        <div className="gm-ul__user">
                          <UserAvatar name={name} seed={user.id} size="md" src={user.avatar} />
                          <div>
                            <strong>{name}</strong>
                            <small>{user.email ?? `ID ${user.accountNumber}`}</small>
                          </div>
                        </div>
                      </td>
                      <td><span className="gm-ul__roles">{roleBadges(user)}</span></td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="gm-ul__c-phone">{user.phone}</td>
                      <td className="gm-ul__c-id">{user.accountNumber}</td>
                      <td>
                        <span className="gm-ul__date">{formatDate(user.createdAt)}<small>({formatRelativeTime(user.createdAt)})</small></span>
                      </td>
                      <td className="gm-ul__c-last">{user.lastLoginAt ? <span className="gm-ul__date">{formatRelativeTime(user.lastLoginAt)}</span> : <span className="gm-ul__muted">{t('Hali kirmagan')}</span>}</td>
                      <td className="gm-ul__c-sub"><ShopsCell user={user} /></td>
                      <td className="gm-ul__c-act" onClick={(event) => event.stopPropagation()}>
                        <span className="gm-ul__acts">
                          <button type="button" aria-label={t('Tezkor ko‘rish')} title={t('Tezkor ko‘rish')} onClick={() => setDrawer(user)}><Eye size={16} /></button>
                          <button type="button" aria-label={t('Profilni ochish')} title={t('Profilni ochish')} onClick={() => navigate(`/admin/foydalanuvchilar/${user.accountNumber}`)}><Pencil size={15} /></button>
                          {!locked && (
                            <Dropdown
                              triggerClassName="gm-ul__more"
                              label={t('Boshqa amallar')}
                              trigger={<MoreHorizontal size={17} />}
                              items={[
                                ...(restricted
                                  ? [{ label: t('Faollashtirish'), icon: <UserCheck size={16} />, onSelect: () => setDialog({ user, action: 'ACTIVATE' }) }]
                                  : [
                                      { label: t('Muzlatish'), icon: <Snowflake size={16} />, onSelect: () => setDialog({ user, action: 'SUSPEND' }) },
                                      { label: t('Bloklash'), icon: <ShieldAlert size={16} />, onSelect: () => setDialog({ user, action: 'BLOCK' }) },
                                    ]),
                                { label: t('O‘chirish'), icon: <Trash2 size={16} />, onSelect: () => setDialog({ user, action: 'DELETE' }), danger: true },
                              ]}
                            />
                          )}
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
            <span>{t('Jami {total} ta foydalanuvchi, sahifa {page}/{pages}', { total: formatNumber(data.total), page: data.page, pages: formatNumber(data.pages) })}</span>
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
            </nav>
          </footer>
        )}
      </section>

      {drawer && <UserDrawer user={items.find((item) => item.id === drawer.id) ?? drawer} onClose={() => setDrawer(null)} />}
      {dialog && <UserActionDialog user={dialog.user} action={dialog.action} onClose={() => setDialog(null)} />}
      {bulk && (
        <BulkDialog
          ids={[...selected]}
          status={bulk}
          onClose={() => setBulk(null)}
          onDone={() => {
            setBulk(null);
            setSelected(new Set());
            void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
          }}
        />
      )}
    </div>
  );
}
