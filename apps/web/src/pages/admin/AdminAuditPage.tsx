import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, BookOpen, Bot, Calculator, CalendarDays, ChevronLeft, ChevronRight, Download, Eye, FileCheck2, Filter, LogIn, MessageSquare, MoreHorizontal, Package, RotateCcw, ScrollText, Search, Settings, Shield, ShieldAlert, Store, UserCog, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatDateTime, formatNumber, formatTime } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useAuditPage, useAuditStats, useAuditSummary } from '@/features/admin/hooks/useAdmin';
import { adminService } from '@/features/admin/services/admin.service';
import { AUDIT_ACTIONS, GROUP_INFO, TARGET_LABEL, actionInfo } from '@/features/admin/audit-labels';
import type { AuditGroup } from '@/features/admin/audit-labels';
import { AuditDrawer } from '@/features/admin/audit/AuditDrawer';
import { OUTCOME, ROLE_NAME, auditSentence, targetPath } from '@/features/admin/audit/audit-ui';
import { pageNumbers } from '@/features/admin/users/users-ui';
import type { AuditActorRole, AuditFilters, AuditLog } from '@/features/admin/types';
import './AdminUsersPage.css';
import '@/features/admin/list-shared.css';
import './AdminAuditPage.css';
import { t } from '@/i18n';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Tab } from '@/components/ui/Tabs';
import { StatCard, type StatTone } from '@/components/ui/StatCard';

const GROUP_ICON: Record<AuditGroup, ReactNode> = {
  auth: <LogIn size={16} />,
  users: <Users size={16} />,
  admins: <UserCog size={16} />,
  shops: <Store size={16} />,
  catalog: <Package size={16} />,
  calc: <Calculator size={16} />,
  deals: <FileCheck2 size={16} />,
  content: <BookOpen size={16} />,
  support: <MessageSquare size={16} />,
  system: <Settings size={16} />,
};
const CATEGORY_OPTIONS = (Object.keys(GROUP_INFO) as AuditGroup[]).filter((key) => GROUP_INFO[key].prefix);
const ACTION_OPTIONS = Object.entries(AUDIT_ACTIONS)
  .filter(([code]) => code !== 'AUTH_REFRESH_ROTATED')
  .sort((a, b) => a[1].label.localeCompare(b[1].label));
type RoleTab = AuditActorRole | 'USERS' | '';
const ROLE_TABS: Array<{ value: RoleTab; label: string }> = [
  { value: '', label: t('Barcha') },
  { value: 'ADMIN', label: t('Adminlar') },
  { value: 'USERS', label: t('Foydalanuvchilar') },
  { value: 'SHOP', label: t('Do‘konlar') },
  { value: 'CUSTOMER', label: t('Mijozlar') },
  { value: 'SYSTEM', label: t('Tizim') },
];
const toneClass = (tone: string) => `gm-aud__chip--${tone}`;
const isoDay = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined);
const csvCell = (value: string | number | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function Delta({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined || previous === 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return null;
  return <em className={change > 0 ? 'is-up' : 'is-down'}>{change > 0 ? '↑' : '↓'} {Math.abs(change)}%</em>;
}

export function AdminAuditPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const pushToast = useAppStore((state) => state.pushToast);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleTab>('');
  const [category, setCategory] = useState('');
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState<'' | 'SUCCESS' | 'FAILED'>('');
  const [securityOnly, setSecurityOnly] = useState(false);
  const [technical, setTechnical] = useState(false);
  const [actorId, setActorId] = useState(params.get('actor') ?? '');
  const [from, setFrom] = useState(isoDay(29));
  const [to, setTo] = useState(isoDay(0));
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  const actorValid = /^\d{1,9}$/.test(actorId.trim());
  const filters = useMemo<AuditFilters>(
    () => ({
      actorRole: role || undefined,
      search: search.trim() || undefined,
      category: action ? undefined : category || undefined,
      action: action || undefined,
      outcome: outcome || undefined,
      kind: securityOnly ? 'security' : undefined,
      technical: technical ? 'true' : undefined,
      actorNumber: actorValid ? Number(actorId.trim()) : undefined,
      from: dayStart(from),
      to: dayEnd(to),
      dir,
    }),
    [role, search, category, action, outcome, securityOnly, technical, actorId, actorValid, from, to, dir],
  );
  const logs = useAuditPage(filters, page, pageSize);
  const stats = useAuditStats(filters);
  const summary = useAuditSummary(filters);
  const data = logs.data;
  const items = data?.items ?? [];
  const cur = stats.data?.current;
  const prev = stats.data?.previous ?? undefined;
  const advanced = [category, securityOnly, technical, actorId].filter(Boolean).length;
  const dirty = !!(search || role || category || action || outcome || securityOnly || technical || actorId || from !== isoDay(29) || to !== isoDay(0));

  useEffect(() => setPage(1), [filters, pageSize]);
  useEffect(() => {
    if (!filtersOpen && !dateOpen) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) setFiltersOpen(false);
      if (dateRef.current && !dateRef.current.contains(target)) setDateOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [filtersOpen, dateOpen]);

  const reset = () => {
    setSearch('');
    setRole('');
    setCategory('');
    setAction('');
    setOutcome('');
    setSecurityOnly(false);
    setTechnical(false);
    setActorId('');
    setFrom(isoDay(29));
    setTo(isoDay(0));
  };
  const count = (value: RoleTab) => (!summary.data ? undefined : value === '' ? summary.data.ALL : value === 'USERS' ? summary.data.SHOP + summary.data.CUSTOMER : summary.data[value]);
  const dateLabel = from || to ? `${from ? formatDate(from) : '…'} – ${to ? formatDate(to) : '…'}` : t('Barcha vaqt');

  /** Joriy filtrlarga mos BARCHA yozuvlarni CSV (Excel ochadi) qilib yuklaydi. */
  async function exportCsv() {
    setExporting(true);
    try {
      const rows: AuditLog[] = [];
      for (let p = 1; p <= 100; p += 1) {
        const chunk = await adminService.auditPage(filters, p, 100);
        rows.push(...chunk.items);
        if (p >= chunk.pages) break;
      }
      const head = [t('Hodisa ID'), t('Vaqt'), t('Amal turi'), t('Amal kodi'), t('Tavsif'), t('Bajaruvchi'), t('Bajaruvchi roli'), t('Obyekt'), t('Status'), t('IP manzil'), t('Sabab')];
      const lines = rows.map((log) => {
        const info = actionInfo(log.action);
        return [log.code, formatDateTime(log.createdAt), info.label, log.action, auditSentence(log), log.actor ? accountName(log.actor) : t('Tizim'), log.actorRole ? ROLE_NAME[log.actorRole] : '', log.targetType ? (TARGET_LABEL[log.targetType] ?? log.targetType) : '', OUTCOME[log.outcome ?? 'SUCCESS'].label, log.ipAddress, log.reason].map(csvCell).join(',');
      });
      const blob = new Blob([`﻿${[head.map(csvCell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit-jurnali-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      pushToast(t('{count} ta yozuv eksport qilindi', { count: rows.length }), 'success');
    } catch (error) {
      pushToast(getErrorMessage(error), 'error');
    } finally {
      setExporting(false);
    }
  }

  const kpis: Array<{ key: string; label: string; icon: ReactNode; tone: string; value: number | undefined; previous: number | undefined; on: boolean; onClick: () => void }> = [
    { key: 'total', label: t('Jami hodisalar'), icon: <ScrollText size={24} />, tone: 'blue', value: cur?.total, previous: prev?.total, on: !role && !securityOnly, onClick: () => { setRole(''); setSecurityOnly(false); } },
    { key: 'users', label: t('Foydalanuvchilar'), icon: <Users size={24} />, tone: 'green', value: cur?.users, previous: prev?.users, on: role === 'USERS', onClick: () => { setRole('USERS'); setSecurityOnly(false); } },
    { key: 'admins', label: t('Admin amallari'), icon: <Shield size={24} />, tone: 'violet', value: cur?.admins, previous: prev?.admins, on: role === 'ADMIN', onClick: () => { setRole('ADMIN'); setSecurityOnly(false); } },
    { key: 'security', label: t('Xavfsizlik hodisalari'), icon: <ShieldAlert size={24} />, tone: 'red', value: cur?.security, previous: prev?.security, on: securityOnly, onClick: () => { setRole(''); setSecurityOnly(true); } },
    { key: 'system', label: t('Tizim hodisalari'), icon: <Bot size={24} />, tone: 'amber', value: cur?.system, previous: prev?.system, on: role === 'SYSTEM', onClick: () => { setRole('SYSTEM'); setSecurityOnly(false); } },
  ];

  return (
    <div className="gm-ul gm-aud">
      <header className="gm-ul__head gm-adm2__head">
        <span className="gm-adm2__logo"><ScrollText size={26} aria-hidden="true" /></span>
        <div>
          <h1>{t('Audit jurnali')}</h1>
          <p>{t('Tizimda kim, qachon va nima qilgani: har bir muhim amal, uning sababi va o‘zgarishlari bilan.')}</p>
        </div>
        <div className="gm-aud__tools gm-adm2__create">
          <div className="gm-ord2__date" ref={dateRef}>
            <Button variant="secondary" onClick={() => setDateOpen((open) => !open)} aria-expanded={dateOpen}>
              <CalendarDays size={16} aria-hidden="true" /> {dateLabel}
            </Button>
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
          <Button loading={exporting} onClick={() => void exportCsv()} disabled={!data || data.total === 0}>
            <Download size={16} aria-hidden="true" /> {t('Export qilish')}
          </Button>
        </div>
      </header>

      <div className="gm-ul__kpis gm-ord2__kpis">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.key}
            variant="compact"
            tone={(({ blue: 'info', green: 'success', red: 'danger', amber: 'warning', violet: 'violet', teal: 'teal' }) as Record<string, StatTone>)[kpi.tone] ?? 'primary'}
            icon={kpi.icon}
            label={kpi.label}
            value={kpi.value === undefined ? null : <>{formatNumber(kpi.value)}<Delta current={kpi.value} previous={kpi.previous} /></>}
            note={prev ? t('Oldingi davr: {count}', { count: formatNumber(kpi.previous ?? 0) }) : t('Oldingi davr bilan solishtirish uchun sana oralig‘ini tanlang')}
            selected={kpi.on}
            onClick={kpi.onClick}
          />
        ))}
      </div>

      <section className="gm-ul__panel">
        <div className="gm-ul__toolbar">
          <label className="gm-ul__search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Foydalanuvchi, telefon, IP, amal yoki sabab bo‘yicha qidirish...')} aria-label={t('Qidirish')} autoComplete="off" />
          </label>
          <label className="gm-ul__select">
            <span>{t('Amal turi')}</span>
            <SelectMenu value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">{t('Barcha amallar')}</option>
              {ACTION_OPTIONS.map(([code, info]) => <option key={code} value={code}>{info.label}</option>)}
            </SelectMenu>
          </label>
          <label className="gm-ul__select">
            <span>{t('Foydalanuvchi roli')}</span>
            <SelectMenu value={role} onChange={(event) => setRole(event.target.value as RoleTab)}>
              {ROLE_TABS.map((tab) => <option key={tab.value} value={tab.value}>{tab.value ? tab.label : t('Barcha rollar')}</option>)}
            </SelectMenu>
          </label>
          <label className="gm-ul__select">
            <span>{t('Status')}</span>
            <SelectMenu value={outcome} onChange={(event) => setOutcome(event.target.value as '' | 'SUCCESS' | 'FAILED')}>
              <option value="">{t('Barcha holatlar')}</option>
              <option value="SUCCESS">{OUTCOME.SUCCESS.label}</option>
              <option value="FAILED">{OUTCOME.FAILED.label}</option>
            </SelectMenu>
          </label>
          <div className="gm-ul__filters" ref={filterRef}>
            <Button variant="secondary" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
              <Filter size={16} aria-hidden="true" /> {t('Filtrlar')}{advanced > 0 && <span className="gm-ul__count">{advanced}</span>}
            </Button>
            {filtersOpen && (
              <div className="gm-ul__pop">
                <label>
                  <span>{t('Bo‘lim')}</span>
                  <SelectMenu value={category} onChange={(event) => { setCategory(event.target.value); setAction(''); }}>
                    <option value="">{t('Barcha bo‘limlar')}</option>
                    {CATEGORY_OPTIONS.map((key) => <option key={key} value={GROUP_INFO[key].prefix}>{GROUP_INFO[key].label}</option>)}
                  </SelectMenu>
                </label>
                <label>
                  <span>{t('Bajaruvchi ID (raqam)')}</span>
                  <input value={actorId} inputMode="numeric" onChange={(event) => setActorId(event.target.value.replace(/\D/g, ''))} placeholder={t('Masalan, 578')} aria-invalid={!!actorId && !actorValid} />
                </label>
                <label className="gm-ord2__check"><input type="checkbox" checked={securityOnly} onChange={(event) => setSecurityOnly(event.target.checked)} /> {t('Faqat xavfsizlik hodisalari')}</label>
                <label className="gm-ord2__check"><input type="checkbox" checked={technical} onChange={(event) => setTechnical(event.target.checked)} /> {t('Texnik yozuvlarni ham ko‘rsatish (sessiya yangilanishi)')}</label>
              </div>
            )}
          </div>
          <Button variant="ghost" onClick={reset} disabled={!dirty}>
            <RotateCcw size={15} aria-hidden="true" /> {t('Tozalash')}
          </Button>
        </div>

        <div className="gm-aud__tabs" role="tablist" aria-label={t('Amalni kim bajargani')}>
          {ROLE_TABS.map((tab) => {
            const n = count(tab.value);
            return (
              <Tab key={tab.value || 'all'} role="tab" aria-selected={role === tab.value} onClick={() => setRole(tab.value)} selected={role === tab.value}>
                {tab.label}{n !== undefined && <span>{formatNumber(n)}</span>}
              </Tab>
            );
          })}
        </div>

        {logs.isLoading && <PageLoader variant="list" label={t('Audit yozuvlari yuklanmoqda…')} />}
        {logs.isError && <Alert tone="danger">{getErrorMessage(logs.error)}</Alert>}
        {data && items.length === 0 && <EmptyState icon={<Activity size={26} />} title={t('Yozuvlar topilmadi')} description={dirty ? t('Filtrlarni o‘zgartirib ko‘ring.') : undefined} />}

        {items.length > 0 && (
          <div className={cx('gm-ul__table', logs.isFetching && 'is-loading')}>
            <table>
              <thead>
                <tr>
                  <th className="gm-ul__c-num">#</th>
                  <th><button type="button" onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')}>{t('Vaqt')} {dir === 'desc' ? '↓' : '↑'}</button></th>
                  <th>{t('Amal turi')}</th>
                  <th className="gm-ul__c-phone">{t('Tavsif')}</th>
                  <th>{t('Foydalanuvchi')}</th>
                  <th className="gm-ul__c-last">{t('Obyekt')}</th>
                  <th>{t('Status')}</th>
                  <th className="gm-ul__c-orders">{t('IP manzil')}</th>
                  <th className="gm-ul__c-act">{t('Batafsil')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((log, index) => {
                  const info = actionInfo(log.action);
                  const out = OUTCOME[log.outcome ?? 'SUCCESS'];
                  const actorUser = log.actor ?? (!log.actorId && info.group === 'auth' ? log.targetUser : null);
                  const path = targetPath(log);
                  return (
                    <tr key={log.id} className={cx(selected?.id === log.id && 'is-open')} onClick={() => setSelected(log)}>
                      <td className="gm-ul__c-num">{(page - 1) * pageSize + index + 1}</td>
                      <td><span className="gm-ul__date">{formatDate(log.createdAt)}<small>{formatTime(log.createdAt)}</small></span></td>
                      <td><span className={cx('gm-aud__chip', toneClass(info.tone))}>{GROUP_ICON[info.group]} {info.label}</span></td>
                      <td className="gm-ul__c-phone"><span className="gm-aud__desc" title={log.reason ? `${auditSentence(log)} — ${log.reason}` : auditSentence(log)}>{auditSentence(log)}</span></td>
                      <td>
                        {actorUser ? (
                          <div className="gm-ul__user">
                            <UserAvatar name={accountName(actorUser)} seed={actorUser.id} size="md" />
                            <div>
                              <strong>{accountName(actorUser)}</strong>
                              <small>{log.actorRole ? ROLE_NAME[log.actorRole] : ''}</small>
                            </div>
                          </div>
                        ) : (
                          <div className="gm-ul__user">
                            <span className="gm-aud__sys"><Bot size={18} aria-hidden="true" /></span>
                            <div>
                              <strong>{t('Tizim')}</strong>
                              <small>{t('Avtomatik')}</small>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="gm-ul__c-last">{log.targetType ? (TARGET_LABEL[log.targetType] ?? log.targetType) : '—'}</td>
                      <td><Badge tone={out.tone}>{out.label}</Badge></td>
                      <td className="gm-ul__c-orders"><span className="gm-aud__ip">{log.ipAddress ?? '—'}</span></td>
                      <td className="gm-ul__c-act" onClick={(event) => event.stopPropagation()}>
                        <span className="gm-ul__acts">
                          <button type="button" aria-label={t('Ko‘rish')} title={t('Ko‘rish')} onClick={() => setSelected(log)}><Eye size={16} /></button>
                          <Dropdown
                            triggerClassName="gm-ul__more"
                            label={t('Boshqa amallar')}
                            trigger={<MoreHorizontal size={17} />}
                            items={[
                              { label: t('Batafsil'), icon: <Eye size={16} />, onSelect: () => setSelected(log) },
                              ...(actorUser ? [{ label: t('Shu bajaruvchi amallari'), icon: <UserRound size={16} />, onSelect: () => setActorId(String(actorUser.accountNumber)) }] : []),
                              ...(path ? [{ label: t('Obyektni ochish'), icon: <ScrollText size={16} />, onSelect: () => navigate(path) }] : []),
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
            <span>{t('Jami: {total} ta hodisa, sahifa {page}/{pages}', { total: formatNumber(data.total), page: data.page, pages: formatNumber(data.pages) })}</span>
            <nav className="gm-ul__pager" aria-label={t('Sahifalar')}>
              <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label={t('Oldingi sahifa')}><ChevronLeft size={16} /></button>
              {pageNumbers(page, data.pages).map((entry) =>
                typeof entry === 'number' ? (
                  <Tab key={entry} aria-current={entry === page ? 'page' : undefined} onClick={() => setPage(entry)} selected={entry === page}>{entry}</Tab>
                ) : (
                  <span key={entry}>…</span>
                ),
              )}
              <button type="button" onClick={() => setPage(page + 1)} disabled={page >= data.pages} aria-label={t('Keyingi sahifa')}><ChevronRight size={16} /></button>
              <SelectMenu className="gm-adm2__size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label={t('Sahifadagi soni')}>
                {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{t('{size} / sahifa', { size })}</option>)}
              </SelectMenu>
            </nav>
          </footer>
        )}
      </section>

      {selected && <AuditDrawer log={items.find((item) => item.id === selected.id) ?? selected} onClose={() => setSelected(null)} onFilterActor={(number) => setActorId(String(number))} />}
    </div>
  );
}
