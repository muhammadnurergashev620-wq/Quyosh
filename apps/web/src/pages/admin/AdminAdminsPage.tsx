import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, ChevronDown, ChevronLeft, ChevronRight, Eye, Filter, KeyRound, LayoutGrid, List, ListChecks, MoreHorizontal, Pencil, RotateCcw, Search, ShieldCheck, ShieldOff, Snowflake, Trash2, UserCheck, UserCog, UserPlus, Users } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import type { DropdownItem } from '@/components/ui/Dropdown';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatNumber, formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import { UserAvatar } from '@/components/common/UserAvatar';
import { CreateAdminDialog } from '@/features/admin/components/CreateAdminDialog';
import { AdminDelegationDialog } from '@/features/admin/components/AdminDelegationDialog';
import { AdminPermissionsDialog } from '@/features/admin/components/AdminPermissionsDialog';
import { PasswordResetDialog } from '@/features/admin/components/PasswordResetDialog';
import { UserActionDialog } from '@/features/admin/components/UserActionDialog';
import { AdminDrawer } from '@/features/admin/admins/AdminDrawer';
import type { AdminDrawerAction } from '@/features/admin/admins/AdminDrawer';
import { ADMIN_STATUS } from '@/features/admin/admins/admins-ui';
import { ADMIN_PERMISSION_OPTIONS, PERMISSION_LABEL } from '@/features/admin/permissions';
import { useAdminAccounts, useBulkUserStatus, useSetSuperAdmin, useSetUserTwoFactor } from '@/features/admin/hooks/useAdmin';
import { pageNumbers } from '@/features/admin/users/users-ui';
import type { UserAction } from '@/features/admin/user-actions';
import type { AdminAccount, AdminUser } from '@/features/admin/types';
import { useMe } from '@/features/session/hooks/useMe';
import './AdminUsersPage.css';
import '@/features/admin/list-shared.css';
import './AdminAdminsPage.css';
import { t } from '@/i18n';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Tab } from '@/components/ui/Tabs';
import { StatCard } from '@/components/ui/StatCard';

type RoleFilter = '' | 'SUPER' | 'ADMIN' | 'DELEGATE';
type MfaFilter = '' | 'on' | 'off';
type SortKey = 'createdAt' | 'lastLoginAt' | 'name';

/** «Dialog» komponentlari kutadigan AdminUser ko‘rinishiga keltiradi. */
const asUser = (admin: AdminAccount): AdminUser => ({
  id: admin.id,
  accountNumber: admin.accountNumber,
  phone: admin.phone,
  email: admin.email ?? null,
  firstName: admin.firstName,
  lastName: admin.lastName,
  status: admin.status,
  createdAt: admin.createdAt,
  deletedAt: null,
  roles: ['ADMIN'],
  shopMemberships: [],
});

function BulkDialog({ ids, status, onClose, onDone }: { ids: string[]; status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED'; onClose: () => void; onDone: () => void }) {
  const bulk = useBulkUserStatus();
  const pushToast = useAppStore((state) => state.pushToast);
  const [reason, setReason] = useState('');
  const needsReason = status !== 'ACTIVE';
  const title = status === 'ACTIVE' ? t('Tanlangan adminlarni faollashtirish') : status === 'SUSPENDED' ? t('Tanlangan adminlarni muzlatish') : t('Tanlangan adminlarni bloklash');
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
                    pushToast(result.failed.length ? t('{ok} ta yangilandi, {fail} ta bajarilmadi', { ok: result.updated, fail: result.failed.length }) : t('{ok} ta admin yangilandi', { ok: result.updated }), result.failed.length ? 'info' : 'success');
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
        <Alert tone="info">{t('{count} ta admin tanlangan. Har biri uchun alohida audit yozuvi yaratiladi.', { count: ids.length })}</Alert>
        {bulk.isError && <Alert tone="danger">{getErrorMessage(bulk.error)}</Alert>}
        {needsReason && <Textarea label={t('Sabab')} required rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} hint={t('Kamida 3 ta belgi. Sabab audit jurnaliga yoziladi.')} />}
      </div>
    </Modal>
  );
}

function PermissionChips({ admin }: { admin: AdminAccount }) {
  if (admin.isSuperAdmin) return <span className="gm-ul__sections"><Badge tone="primary">{t('Barcha bo‘limlar')}</Badge></span>;
  const keys = admin.adminPermissions ?? [];
  if (keys.length === 0) return <Badge tone="warning">{t('Hech qaysi')}</Badge>;
  return (
    <span className="gm-ul__sections" title={keys.map((key) => PERMISSION_LABEL[key] ?? key).join(', ')}>
      <Badge tone="neutral">{PERMISSION_LABEL[keys[0]!] ?? keys[0]}</Badge>
      {keys.length > 1 && <Badge tone="neutral">+{keys.length - 1}</Badge>}
    </span>
  );
}

/** Superadmin paneli: adminlarni yaratish va boshqarish. */
export function AdminAdminsPage() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isSuper = !!me.data?.isSuperAdmin;
  const canManage = isSuper || !!me.data?.canCreateAdmins;
  const admins = useAdminAccounts(canManage);
  const setSuper = useSetSuperAdmin();
  const setTwoFactor = useSetUserTwoFactor();
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState<{ admin: AdminAccount; action: UserAction } | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminAccount | null>(null);
  const [permissionsFor, setPermissionsFor] = useState<AdminAccount | null>(null);
  const [delegationFor, setDelegationFor] = useState<AdminAccount | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | null>(null);

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('');
  const [status, setStatus] = useState('');
  const [section, setSection] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mfa, setMfa] = useState<MfaFilter>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [sort, setSort] = useState<SortKey>('createdAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filterRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => admins.data?.items ?? [], [admins.data]);
  const scope = admins.data?.scope;
  const stats = admins.data?.stats;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = items.filter((admin) => {
      if (needle) {
        const haystack = [accountName(admin), admin.login, admin.phone, admin.email, String(admin.accountNumber)].join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (role === 'SUPER' && !admin.isSuperAdmin) return false;
      if (role === 'ADMIN' && admin.isSuperAdmin) return false;
      if (role === 'DELEGATE' && !admin.canCreateAdmins) return false;
      if (status && admin.status !== status) return false;
      if (section && !admin.isSuperAdmin && !(admin.adminPermissions ?? []).includes(section)) return false;
      if (from && admin.createdAt.slice(0, 10) < from) return false;
      if (to && admin.createdAt.slice(0, 10) > to) return false;
      if (mfa === 'on' && admin.twoFactorEnabled === false) return false;
      if (mfa === 'off' && admin.twoFactorEnabled !== false) return false;
      return true;
    });
    const sign = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort === 'name') return sign * accountName(a).localeCompare(accountName(b));
      if (sort === 'lastLoginAt') return sign * ((a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0) - (b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0));
      return sign * (Date.parse(a.createdAt) - Date.parse(b.createdAt));
    });
  }, [items, search, role, status, section, from, to, mfa, sort, dir]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const drawerAdmin = items.find((admin) => admin.id === drawerId) ?? null;

  useEffect(() => setPage(1), [search, role, status, section, from, to, mfa, pageSize]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (event: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setFiltersOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [filtersOpen]);

  if (me.isLoading) return <PageLoader />;
  if (!canManage) return <Navigate to="/admin" replace />;

  const advanced = [mfa, from, to].filter(Boolean).length;
  const dirty = !!(search || role || status || section || advanced);
  const reset = () => {
    setSearch('');
    setRole('');
    setStatus('');
    setSection('');
    setMfa('');
    setFrom('');
    setTo('');
  };
  const sortBy = (key: SortKey) => {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setDir(key === 'name' ? 'asc' : 'desc');
    }
  };
  const sortMark = (key: SortKey) => (sort === key ? (dir === 'asc' ? ' ↑' : ' ↓') : '');

  const selectable = isSuper ? visible.filter((admin) => !admin.isSelf && !admin.isSuperAdmin) : [];
  const allSelected = selectable.length > 0 && selectable.every((admin) => selected.has(admin.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runAction = (admin: AdminAccount, action: AdminDrawerAction) => {
    if (action === 'permissions') setPermissionsFor(admin);
    else if (action === 'delegation') setDelegationFor(admin);
    else if (action === 'password') setPasswordFor(admin);
    else if (action === 'super') setSuper.mutate({ id: admin.id, value: !admin.isSuperAdmin });
    else setDialog({ admin, action });
  };

  const menuItems = (admin: AdminAccount): DropdownItem[] => {
    if (admin.isSelf) return [];
    const restricted = admin.status === 'SUSPENDED' || admin.status === 'BLOCKED';
    return [
      ...(!admin.isSuperAdmin ? [{ label: t('Huquqlar'), icon: <ListChecks size={16} />, onSelect: () => runAction(admin, 'permissions') }] : []),
      ...(isSuper && !admin.isSuperAdmin ? [{ label: t('Admin yaratish vakolati'), icon: <UserPlus size={16} />, onSelect: () => runAction(admin, 'delegation') }] : []),
      ...(isSuper
        ? [
            { label: t('Yangi parol'), icon: <KeyRound size={16} />, onSelect: () => runAction(admin, 'password') },
            { label: admin.isSuperAdmin ? t('Oddiy admin qilish') : t('Superadmin qilish'), icon: admin.isSuperAdmin ? <ShieldOff size={16} /> : <ShieldCheck size={16} />, onSelect: () => runAction(admin, 'super') },
            ...(restricted
              ? [{ label: t('Faollashtirish'), icon: <UserCheck size={16} />, onSelect: () => runAction(admin, 'ACTIVATE'), separator: true }]
              : [
                  { label: t('Muzlatish'), icon: <Snowflake size={16} />, onSelect: () => runAction(admin, 'SUSPEND'), separator: true },
                  { label: t('Bloklash'), icon: <Ban size={16} />, onSelect: () => runAction(admin, 'BLOCK') },
                ]),
            { label: t('O‘chirish'), icon: <Trash2 size={16} />, onSelect: () => runAction(admin, 'DELETE'), danger: true },
          ]
        : []),
    ];
  };

  const roleBadges = (admin: AdminAccount) => (
    <span className="gm-ul__roles">
      <Badge tone={admin.isSuperAdmin ? 'primary' : 'neutral'}>{admin.isSuperAdmin ? t('Superadmin') : t('Admin')}</Badge>
      {admin.isSelf && <Badge tone="success">{t('Siz')}</Badge>}
    </span>
  );
  const rowActions = (admin: AdminAccount) => {
    const menu = menuItems(admin);
    return (
      <span className="gm-ul__acts" onClick={(event) => event.stopPropagation()}>
        <button type="button" aria-label={t('Tezkor ko‘rish')} title={t('Tezkor ko‘rish')} onClick={() => setDrawerId(admin.id)}><Eye size={16} /></button>
        <button type="button" aria-label={t('Profilni ochish')} title={t('Profilni ochish')} onClick={() => navigate(`/admin/foydalanuvchilar/${admin.accountNumber}`)}><Pencil size={15} /></button>
        {menu.length > 0 && <Dropdown triggerClassName="gm-ul__more" label={t('Boshqa amallar')} trigger={<MoreHorizontal size={17} />} items={menu} />}
      </span>
    );
  };

  const kpiShare = (value: number) => (stats && stats.total ? Math.round((value / stats.total) * 100) : 0);
  const weekDelta = stats && stats.totalWeekAgo > 0 ? Math.round(((stats.total - stats.totalWeekAgo) / stats.totalWeekAgo) * 100) : null;

  return (
    <div className="gm-ul gm-adm2">
      <header className="gm-ul__head gm-adm2__head">
        <div>
          <h1>{t('Adminlar')}</h1>
          <p>{isSuper ? t('Yangi adminlar yarating, ularning huquqlari va akkauntlarini boshqaring.') : t('Siz yaratgan adminlar. Ularga faqat superadmin ruxsat bergan huquqlarni bera olasiz.')}</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gm-adm2__create">
          <UserPlus size={17} aria-hidden="true" /> {t('Yangi admin yaratish')}
        </Button>
      </header>

      <div className="gm-ul__kpis">
        <StatCard variant="compact" tone="info" icon={<Users size={24} aria-hidden="true" />} label={t('Jami adminlar')} value={<>{stats ? formatNumber(stats.total) : '…'}{weekDelta !== null && weekDelta !== 0 && <em className={weekDelta > 0 ? 'is-up' : 'is-down'}>{weekDelta > 0 ? '↑' : '↓'} {Math.abs(weekDelta)}%</em>}</>} note={<>{t('O‘tgan hafta: {count}', { count: stats?.totalWeekAgo ?? '…' })}{stats && stats.superAdmins > 0 && ` · ${t('Superadmin: {count}', { count: stats.superAdmins })}`}</>} />
        <StatCard variant="compact" tone="success" icon={<UserCheck size={24} aria-hidden="true" />} label={t('Faol adminlar')} value={<>{stats ? formatNumber(stats.active) : '…'}</>} note={<>{t('Jami adminlarning {percent}%', { percent: stats ? kpiShare(stats.active) : '…' })}{stats && stats.pending > 0 && ` · ${t('Tasdiqlanmagan: {count}', { count: stats.pending })}`}</>} />
        <StatCard variant="compact" tone="danger" icon={<Ban size={24} aria-hidden="true" />} label={t('Bloklangan')} value={<>{stats ? formatNumber(stats.blocked) : '…'}</>} note={<>{t('Muzlatilgan: {count}', { count: stats?.suspended ?? '…' })}</>} />
        <StatCard variant="compact" tone="warning" icon={<ShieldCheck size={24} aria-hidden="true" />} label={t('MFA yoqilgan')} value={<>{stats ? formatNumber(stats.mfaOn) : '…'}</>} note={<>{t('MFA o‘chirilgan: {count}', { count: stats?.mfaOff ?? '…' })}</>} />
      </div>

      <section className="gm-ul__panel">
        <div className="gm-ul__toolbar">
          <label className="gm-ul__search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Ism, telefon, ID yoki email bo‘yicha qidirish...')} aria-label={t('Qidirish')} autoComplete="off" />
          </label>
          <label className="gm-ul__select">
            <span>{t('Rol')}</span>
            <SelectMenu value={role} onChange={(event) => setRole(event.target.value as RoleFilter)}>
              <option value="">{t('Barcha rollar')}</option>
              <option value="SUPER">{t('Superadmin')}</option>
              <option value="ADMIN">{t('Admin')}</option>
              <option value="DELEGATE">{t('Admin yarata oladi')}</option>
            </SelectMenu>
          </label>
          <label className="gm-ul__select">
            <span>{t('Holat')}</span>
            <SelectMenu value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t('Barcha holatlar')}</option>
              {Object.entries(ADMIN_STATUS).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
            </SelectMenu>
          </label>
          <label className="gm-ul__select">
            <span>{t('Bo‘lim')}</span>
            <SelectMenu value={section} onChange={(event) => setSection(event.target.value)}>
              <option value="">{t('Barcha bo‘limlar')}</option>
              {ADMIN_PERMISSION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectMenu>
          </label>
          <div className="gm-ul__filters" ref={filterRef}>
            <Button variant="secondary" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
              <Filter size={16} aria-hidden="true" /> {t('Filtrlar')}{advanced > 0 && <span className="gm-ul__count">{advanced}</span>}
            </Button>
            {filtersOpen && (
              <div className="gm-ul__pop">
                <label>
                  <span>MFA</span>
                  <SelectMenu value={mfa} onChange={(event) => setMfa(event.target.value as MfaFilter)}>
                    <option value="">{t('Barchasi')}</option>
                    <option value="on">{t('Yoqilgan')}</option>
                    <option value="off">{t('O‘chirilgan')}</option>
                  </SelectMenu>
                </label>
                <label>
                  <span>{t('Ro‘yxatdan o‘tgan (dan)')}</span>
                  <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
                </label>
                <label>
                  <span>{t('Ro‘yxatdan o‘tgan (gacha)')}</span>
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
          {isSuper && (
            <>
              <label className="gm-ul__check">
                <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((admin) => admin.id)))} disabled={selectable.length === 0} />
                <span>{selected.size > 0 ? t('Tanlandi: {count}', { count: selected.size }) : t('Barchasini tanlash ({count})', { count: selectable.length })}</span>
              </label>
              <Dropdown
                triggerClassName="gm-ul__menu-btn"
                label={t('Ommaviy amallar')}
                trigger={<>{t('Ommaviy amallar')} <ChevronDown size={15} aria-hidden="true" /></>}
                items={[
                  { label: t('Faollashtirish'), icon: <UserCheck size={16} />, onSelect: () => selected.size > 0 && setBulk('ACTIVE') },
                  { label: t('Muzlatish'), icon: <Snowflake size={16} />, onSelect: () => selected.size > 0 && setBulk('SUSPENDED') },
                  { label: t('Bloklash'), icon: <Ban size={16} />, onSelect: () => selected.size > 0 && setBulk('BLOCKED'), danger: true },
                ]}
              />
              {selected.size === 0 && <small className="gm-ul__hint">{t('Ommaviy amal uchun avval adminlarni belgilang.')}</small>}
            </>
          )}
          <span className="gm-adm2__views" role="group" aria-label={t('Ko‘rinish')}>
            <Tab aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label={t('Jadval')} selected={view === 'list'}><List size={17} /></Tab>
            <Tab aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label={t('Kartalar')} selected={view === 'grid'}><LayoutGrid size={17} /></Tab>
          </span>
        </div>

        {admins.isLoading && <PageLoader variant="list" label={t('Adminlar yuklanmoqda…')} />}
        {admins.isError && <Alert tone="danger">{getErrorMessage(admins.error)}</Alert>}
        {setSuper.isError && <Alert tone="danger">{getErrorMessage(setSuper.error)}</Alert>}
        {setTwoFactor.isError && <Alert tone="danger">{getErrorMessage(setTwoFactor.error)}</Alert>}
        {admins.data && filtered.length === 0 && <EmptyState icon={<UserCog size={28} />} title={t('Admin topilmadi')} description={t('Qidiruv yoki filtrni o‘zgartirib ko‘ring.')} />}

        {visible.length > 0 && view === 'list' && (
          <div className="gm-ul__table">
            <table>
              <thead>
                <tr>
                  {isSuper && <th className="gm-ul__c-check" />}
                  <th className="gm-ul__c-num">#</th>
                  <th><button type="button" onClick={() => sortBy('name')}>{t('Foydalanuvchi')}{sortMark('name')}</button></th>
                  <th>{t('Rol')}</th>
                  <th>{t('Bo‘lim')}</th>
                  <th className="gm-ul__c-phone">{t('Aloqa')}</th>
                  <th><button type="button" onClick={() => sortBy('createdAt')}>{t('Ro‘yxatdan o‘tgan')}{sortMark('createdAt')}</button></th>
                  <th className="gm-ul__c-last"><button type="button" onClick={() => sortBy('lastLoginAt')}>{t('Oxirgi kirish')}{sortMark('lastLoginAt')}</button></th>
                  <th>{t('Holat')}</th>
                  <th className="gm-ul__c-orders">MFA</th>
                  <th className="gm-ul__c-act">{t('Amallar')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((admin, index) => {
                  const st = ADMIN_STATUS[admin.status] ?? { label: admin.status, tone: 'neutral' as const };
                  const name = accountName(admin);
                  const canSelect = selectable.some((item) => item.id === admin.id);
                  return (
                    <tr key={admin.id} className={cx(drawerId === admin.id && 'is-open', selected.has(admin.id) && 'is-selected')} onClick={() => setDrawerId(admin.id)}>
                      {isSuper && (
                        <td className="gm-ul__c-check" onClick={(event) => event.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(admin.id)} disabled={!canSelect} onChange={() => toggle(admin.id)} aria-label={t('{name} ni tanlash', { name })} />
                        </td>
                      )}
                      <td className="gm-ul__c-num">{(page - 1) * pageSize + index + 1}</td>
                      <td>
                        <div className="gm-ul__user">
                          <UserAvatar name={name} seed={admin.id} size="md" src={admin.avatar} />
                          <div>
                            <strong>{name}</strong>
                            <small>{admin.email ?? `ID ${admin.accountNumber}`}</small>
                          </div>
                        </div>
                      </td>
                      <td>{roleBadges(admin)}</td>
                      <td><PermissionChips admin={admin} /></td>
                      <td className="gm-ul__c-phone">{admin.login ?? admin.phone}</td>
                      <td><span className="gm-ul__date">{formatDate(admin.createdAt)}<small>({formatRelativeTime(admin.createdAt)})</small></span></td>
                      <td className="gm-ul__c-last">{admin.lastLoginAt ? <span className="gm-ul__date">{formatDate(admin.lastLoginAt)}<small>({formatRelativeTime(admin.lastLoginAt)})</small></span> : <span className="gm-ul__muted">{t('Hali kirmagan')}</span>}</td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="gm-ul__c-orders"><Badge tone={admin.twoFactorEnabled !== false ? 'success' : 'neutral'}>{admin.twoFactorEnabled !== false ? t('Yoqilgan') : t('O‘chirilgan')}</Badge></td>
                      <td className="gm-ul__c-act">{rowActions(admin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {visible.length > 0 && view === 'grid' && (
          <div className="gm-adm2__grid">
            {visible.map((admin) => {
              const st = ADMIN_STATUS[admin.status] ?? { label: admin.status, tone: 'neutral' as const };
              const name = accountName(admin);
              return (
                <article key={admin.id} className={cx('gm-adm2__card', drawerId === admin.id && 'is-open')} onClick={() => setDrawerId(admin.id)}>
                  <header>
                    <UserAvatar name={name} seed={admin.id} size="lg" src={admin.avatar} />
                    <div>
                      <strong>{name}</strong>
                      <small>{admin.email ?? admin.phone}</small>
                    </div>
                    {rowActions(admin)}
                  </header>
                  <div className="gm-adm2__badges">
                    {roleBadges(admin)}
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <Badge tone={admin.twoFactorEnabled !== false ? 'success' : 'neutral'}>MFA</Badge>
                  </div>
                  <PermissionChips admin={admin} />
                  <footer>
                    <span>{admin.phone}</span>
                    <span>{admin.lastLoginAt ? t('Kirgan: {when}', { when: formatRelativeTime(admin.lastLoginAt) }) : t('Hali kirmagan')}</span>
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {filtered.length > 0 && (
          <footer className="gm-ul__foot">
            <span>{t('Jami: {total} ta admin', { total: formatNumber(filtered.length) })}{filtered.length !== items.length && ` (${t('filtrdan oldin: {count}', { count: items.length })})`}</span>
            <nav className="gm-ul__pager" aria-label={t('Sahifalar')}>
              <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label={t('Oldingi sahifa')}><ChevronLeft size={16} /></button>
              {pageNumbers(page, pages).map((entry) =>
                typeof entry === 'number' ? (
                  <Tab key={entry} aria-current={entry === page ? 'page' : undefined} onClick={() => setPage(entry)} selected={entry === page}>{entry}</Tab>
                ) : (
                  <span key={entry}>…</span>
                ),
              )}
              <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pages} aria-label={t('Keyingi sahifa')}><ChevronRight size={16} /></button>
              <SelectMenu className="gm-adm2__size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label={t('Sahifadagi soni')}>
                {[10, 20, 50].map((size) => <option key={size} value={size}>{t('{size} / sahifa', { size })}</option>)}
              </SelectMenu>
            </nav>
          </footer>
        )}
      </section>

      {drawerAdmin && (
        <AdminDrawer
          admin={drawerAdmin}
          isSuper={isSuper}
          twoFactorBusy={setTwoFactor.isPending && setTwoFactor.variables?.id === drawerAdmin.id}
          superBusy={setSuper.isPending && setSuper.variables?.id === drawerAdmin.id}
          onClose={() => setDrawerId(null)}
          onAction={(action) => runAction(drawerAdmin, action)}
          onTwoFactor={(enabled) => setTwoFactor.mutate({ id: drawerAdmin.id, enabled })}
        />
      )}
      {creating && <CreateAdminDialog onClose={() => setCreating(false)} scope={scope} />}
      {dialog && <UserActionDialog user={asUser(dialog.admin)} action={dialog.action} onClose={() => setDialog(null)} onDeleted={() => { setDialog(null); setDrawerId(null); }} />}
      {permissionsFor && <AdminPermissionsDialog admin={permissionsFor} onClose={() => setPermissionsFor(null)} allowed={isSuper ? undefined : scope?.grantable} />}
      {delegationFor && <AdminDelegationDialog admin={delegationFor} onClose={() => setDelegationFor(null)} />}
      {passwordFor && <PasswordResetDialog userId={passwordFor.id} name={accountName(passwordFor)} phone={passwordFor.phone} onClose={() => setPasswordFor(null)} />}
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
