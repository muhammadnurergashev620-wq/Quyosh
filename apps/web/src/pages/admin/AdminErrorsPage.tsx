import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle, Bug, CalendarDays, Check, ChevronLeft, ChevronRight, Download, Eye, MoreHorizontal, RefreshCw, RotateCcw, Search, Server, Smartphone, Users, WifiOff } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate, formatDateTime, formatNumber, formatTime } from '@/lib/utils';
import { useAppStore } from '@/store/app.store';
import { ErrorDrawer } from '@/features/errors/admin/ErrorDrawer';
import { statusName, whereOf } from '@/features/errors/admin/errors-ui';
import { useErrorGroupsPage, useErrorOverview, useResolveErrors } from '@/features/errors/hooks';
import { errorLogService } from '@/features/errors/service';
import type { ErrorGroupRow, ErrorGroupsPageFilters } from '@/features/errors/types';
import { pageNumbers } from '@/features/admin/users/users-ui';
import '@/features/admin/list-shared.css';
import './AdminUsersPage.css';
import './AdminErrorsPage.css';
import { t } from '@/i18n';

const isoDay = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined);
const csvCell = (value: string | number | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return null;
  // Xatolar kamayishi — yaxshi (yashil), ko‘payishi — yomon (qizil).
  return <em className={change < 0 ? 'is-up' : 'is-down'}>{change > 0 ? '↑' : '↓'} {Math.abs(change)}%</em>;
}

/** Kunlik xatolar: pastda jiddiylari (qizil), ustida ogohlantirishlar (sariq). */
function DynamicsChart({ series }: { series: Array<{ day: string; errors: number; warnings: number }> }) {
  const max = Math.max(4, ...series.map((row) => row.errors + row.warnings));
  const top = Math.ceil(max / 4) * 4;
  const ticks = [4, 3, 2, 1, 0].map((i) => Math.round((top / 4) * i));
  const total = series.reduce((sum, row) => sum + row.errors + row.warnings, 0);
  if (total === 0) return <p className="gm-errs2__empty">{t('Tanlangan davrda xato qayd etilmagan.')}</p>;
  return (
    <div className="gm-errs2__chart">
      <div className="gm-errs2__axis">{ticks.map((tick) => <span key={tick}>{tick}</span>)}</div>
      <div className="gm-errs2__plot" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}>
        {series.map((row) => {
          const sum = row.errors + row.warnings;
          return (
            <div key={row.day} className="gm-errs2__col" title={`${formatDate(row.day)}: ${t('Jiddiy')} ${row.errors}, ${t('Ogohlantirish')} ${row.warnings}`}>
              {sum > 0 && <b>{formatNumber(sum)}</b>}
              <div className="gm-errs2__bar" style={{ height: `${(sum / top) * 100}%` }}>
                <i className="is-warn" style={{ flexGrow: row.warnings }} />
                <i className="is-err" style={{ flexGrow: row.errors }} />
              </div>
              <small>{formatDate(row.day).slice(0, 5)}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminErrorsPage() {
  const pushToast = useAppStore((state) => state.pushToast);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<'' | 'ERROR' | 'WARNING'>('');
  const [state, setState] = useState<'' | 'open' | 'resolved'>('');
  const [source, setSource] = useState<'' | 'SERVER' | 'CLIENT'>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [statusClass, setStatusClass] = useState<'' | '4xx' | '5xx' | 'none'>('');
  const [from, setFrom] = useState(isoDay(6));
  const [to, setTo] = useState(isoDay(0));
  const [sort, setSort] = useState<'last' | 'count' | 'users'>('last');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openFp, setOpenFp] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const resolve = useResolveErrors();

  const range = useMemo(() => ({ from: dayStart(from), to: dayEnd(to) }), [from, to]);
  const filters = useMemo<ErrorGroupsPageFilters>(
    () => ({ q: search.trim() || undefined, severity: severity || undefined, state: state || undefined, source: source || undefined, status: statusFilter || undefined, statusClass: statusClass || undefined, ...range, sort, dir }),
    [search, severity, state, source, statusFilter, statusClass, range, sort, dir],
  );
  const overview = useErrorOverview(range);
  const groups = useErrorGroupsPage(filters, page, pageSize);
  const o = overview.data;
  const data = groups.data;
  const items = data?.items ?? [];
  const dirty = !!(search || severity || state || source || statusFilter || statusClass || from !== isoDay(6) || to !== isoDay(0));
  const dateLabel = from || to ? `${from ? formatDate(from) : '…'} – ${to ? formatDate(to) : '…'}` : t('Barcha vaqt');

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
    setSeverity('');
    setState('');
    setSource('');
    setStatusFilter('');
    setStatusClass('');
    setFrom(isoDay(6));
    setTo(isoDay(0));
  };
  const toggle = (fp: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fp)) next.delete(fp);
      else next.add(fp);
      return next;
    });
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.fingerprint));
  const sortBy = (key: 'last' | 'count' | 'users') => {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setDir('desc');
    }
  };
  const mark = (key: 'last' | 'count' | 'users') => (sort === key ? (dir === 'asc' ? ' ↑' : ' ↓') : '');

  async function resolveSelected(value: boolean) {
    for (const fingerprint of selected) await resolve.mutateAsync({ fingerprint, value });
    setSelected(new Set());
  }

  /** Joriy filtrlarga mos BARCHA guruhlarni CSV (Excel ochadi) qilib yuklaydi. */
  async function exportCsv() {
    setExporting(true);
    try {
      const rows: ErrorGroupRow[] = [];
      for (let p = 1; p <= 50; p += 1) {
        const chunk = await errorLogService.groupsPage(filters, p, 100);
        rows.push(...chunk.items);
        if (p >= chunk.pages) break;
      }
      const head = [t('Jiddiylik'), t('Kod'), t('Xato'), t('Xabar'), t('Endpoint'), t('Takrorlanish'), t('Foydalanuvchilar'), t('Birinchi marta'), t('Oxirgi marta'), t('Holat')];
      const lines = rows.map((row) => [row.severity === 'ERROR' ? t('Jiddiy') : t('Ogohlantirish'), row.status ?? '', statusName(row.status, row.kind), row.message, whereOf(row), row.count, row.users, formatDateTime(row.firstSeenAt), formatDateTime(row.lastSeenAt), row.resolved ? t('Yechilgan') : t('Hal qilinmagan')].map(csvCell).join(','));
      const blob = new Blob([`﻿${[head.map(csvCell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `xatolar-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      pushToast(t('{count} ta xato guruhi eksport qilindi', { count: rows.length }), 'success');
    } catch (error) {
      pushToast(getErrorMessage(error), 'error');
    } finally {
      setExporting(false);
    }
  }

  const total = o ? o.categories.client4xx + o.categories.server5xx + o.categories.ui + o.categories.other : 0;
  const share = (value: number) => (total ? Math.round((value / total) * 100) : 0);
  const categoryCards: Array<{ key: string; label: string; hint: string; value: number; icon: React.ReactNode; tone: string; apply: () => void }> = o
    ? [
        { key: '4xx', label: '4xx', hint: t('Mijoz xatolari'), value: o.categories.client4xx, icon: <AlertTriangle size={18} />, tone: 'red', apply: () => { setStatusClass('4xx'); setStatusFilter(''); } },
        { key: '5xx', label: '5xx', hint: t('Server xatolari'), value: o.categories.server5xx, icon: <Server size={18} />, tone: 'red', apply: () => { setStatusClass('5xx'); setStatusFilter(''); } },
        { key: 'ui', label: t('Tarmoq / interfeys'), hint: t('Ulanish va interfeys'), value: o.categories.ui, icon: <WifiOff size={18} />, tone: 'blue', apply: () => { setSource('CLIENT'); setStatusClass('none'); setStatusFilter(''); } },
        { key: 'other', label: t('Boshqa'), hint: t('Boshqa xatoliklar'), value: o.categories.other, icon: <Bug size={18} />, tone: 'blue', apply: () => { setSource('SERVER'); setStatusClass('none'); setStatusFilter(''); } },
      ]
    : [];

  return (
    <div className="gm-ul gm-errs2">
      <header className="gm-ul__head gm-adm2__head">
        <span className="gm-adm2__logo"><AlertOctagon size={26} aria-hidden="true" /></span>
        <div>
          <h1>{t('Xatolar')}</h1>
          <p>{t('Server, veb sayt va mobil ilovadagi xatolar: kim, qachon va nima qilganda.')}</p>
        </div>
        <div className="gm-errs2__tools gm-adm2__create">
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
                </div>
              </div>
            )}
          </div>
          <Button variant="secondary" loading={overview.isFetching || groups.isFetching} onClick={() => { void overview.refetch(); void groups.refetch(); }}>
            <RefreshCw size={15} aria-hidden="true" /> {t('Yangilash')}
          </Button>
          <Button loading={exporting} onClick={() => void exportCsv()} disabled={!data || data.total === 0}>
            <Download size={16} aria-hidden="true" /> {t('Eksport qilish')}
          </Button>
        </div>
      </header>

      <div className="gm-ul__kpis gm-errs2__kpis">
        <button type="button" className={cx('gm-ukpi gm-ukpi--btn', !severity && !state && 'is-on')} onClick={() => { setSeverity(''); setState(''); }}>
          <span className="gm-ukpi__icon gm-errs2__ic--red"><AlertTriangle size={24} /></span>
          <div><small>{t('Jami xatolar')}</small><strong>{o ? formatNumber(o.current.total) : '…'}{o && <Delta current={o.current.total} previous={o.previous.total} />}</strong><span>{t('Oldingi davr: {count}', { count: o ? formatNumber(o.previous.total) : '…' })}</span></div>
        </button>
        <button type="button" className={cx('gm-ukpi gm-ukpi--btn', severity === 'ERROR' && 'is-on')} onClick={() => setSeverity('ERROR')}>
          <span className="gm-ukpi__icon gm-errs2__ic--red"><AlertOctagon size={24} /></span>
          <div><small>{t('Jiddiy')}</small><strong>{o ? formatNumber(o.current.severe) : '…'}{o && <Delta current={o.current.severe} previous={o.previous.severe} />}</strong><span>{t('Oldingi davr: {count}', { count: o ? formatNumber(o.previous.severe) : '…' })}</span></div>
        </button>
        <button type="button" className={cx('gm-ukpi gm-ukpi--btn', state === 'open' && 'is-on')} onClick={() => setState('open')}>
          <span className="gm-ukpi__icon gm-errs2__ic--amber"><Bug size={24} /></span>
          <div><small>{t('Hal qilinmagan')}</small><strong>{o ? formatNumber(o.current.open) : '…'}{o && <Delta current={o.current.open} previous={o.previous.open} />}</strong><span>{t('Oldingi davr: {count}', { count: o ? formatNumber(o.previous.open) : '…' })}</span></div>
        </button>
        <div className="gm-ukpi">
          <span className="gm-ukpi__icon gm-errs2__ic--blue"><Users size={24} /></span>
          <div><small>{t('Ta’sirlangan foydalanuvchilar')}</small><strong>{o ? formatNumber(o.current.affectedUsers) : '…'}{o && <Delta current={o.current.affectedUsers} previous={o.previous.affectedUsers} />}</strong><span>{t('Oldingi davr: {count}', { count: o ? formatNumber(o.previous.affectedUsers) : '…' })}</span></div>
        </div>
      </div>

      <div className="gm-errs2__row">
        <section className="gm-ul__panel gm-errs2__dyn">
          <header className="gm-errs2__head">
            <h2>{t('Xatolar dinamikasi')}</h2>
            <span className="gm-errs2__legend"><i className="is-err" />{t('Jiddiy')} <i className="is-warn" />{t('Ogohlantirish')}</span>
          </header>
          {o ? <DynamicsChart series={o.series} /> : <PageLoader />}
        </section>
        <section className="gm-ul__panel gm-errs2__cats">
          <h2>{t('Xatolik kategoriyalari')}</h2>
          <div className="gm-errs2__catgrid">
            {categoryCards.map((card) => (
              <button key={card.key} type="button" className="gm-errs2__cat" onClick={card.apply}>
                <span className={cx('gm-errs2__caticon', `gm-errs2__ic--${card.tone}`)}>{card.icon}</span>
                <small>{card.label}</small>
                <strong>{formatNumber(card.value)} <em>{share(card.value)}%</em></strong>
                <span>{card.hint}</span>
              </button>
            ))}
          </div>
          <h3>{t('HTTP kodlari')}</h3>
          <div className="gm-errs2__codes">
            {o?.codes.length === 0 && <small className="gm-errs2__empty">{t('HTTP xatolari yo‘q.')}</small>}
            {o?.codes.map((code) => (
              <button key={code.status} type="button" className={cx(statusFilter === String(code.status) && 'is-on')} title={`${statusName(code.status)} · ${code.count}`} onClick={() => { setStatusFilter(statusFilter === String(code.status) ? '' : String(code.status)); setStatusClass(''); }}>
                {code.status}<span>{code.count}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="gm-ul__panel">
        <div className="gm-ul__toolbar">
          <label className="gm-ul__search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Xato kodi, xabar yoki endpoint bo‘yicha qidirish...')} aria-label={t('Qidirish')} autoComplete="off" />
          </label>
          <label className="gm-ul__select">
            <span>{t('Jiddiylik')}</span>
            <select value={severity} onChange={(event) => setSeverity(event.target.value as '' | 'ERROR' | 'WARNING')}>
              <option value="">{t('Barchasi')}</option>
              <option value="ERROR">{t('Jiddiy')}</option>
              <option value="WARNING">{t('Ogohlantirish')}</option>
            </select>
          </label>
          <label className="gm-ul__select">
            <span>{t('Holat')}</span>
            <select value={state} onChange={(event) => setState(event.target.value as '' | 'open' | 'resolved')}>
              <option value="">{t('Barchasi')}</option>
              <option value="open">{t('Hal qilinmagan')}</option>
              <option value="resolved">{t('Yechilgan')}</option>
            </select>
          </label>
          <label className="gm-ul__select">
            <span>{t('Manba')}</span>
            <select value={source} onChange={(event) => setSource(event.target.value as '' | 'SERVER' | 'CLIENT')}>
              <option value="">{t('Barchasi')}</option>
              <option value="SERVER">{t('Server')}</option>
              <option value="CLIENT">{t('Veb / ilova')}</option>
            </select>
          </label>
          <Button variant="ghost" onClick={reset} disabled={!dirty}>
            <RotateCcw size={15} aria-hidden="true" /> {t('Tozalash')}
          </Button>
        </div>

        <div className="gm-ul__bulk">
          <label className="gm-ul__check">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.fingerprint)))} disabled={items.length === 0} />
            <span>{selected.size > 0 ? t('Tanlandi: {count}', { count: selected.size }) : t('Barchasini tanlash')}</span>
          </label>
          <Button size="sm" variant="secondary" disabled={selected.size === 0} loading={resolve.isPending} onClick={() => void resolveSelected(true)}><Check size={15} aria-hidden="true" /> {t('Hal qilindi deb belgilash')}</Button>
          <Button size="sm" variant="ghost" disabled={selected.size === 0} onClick={() => void resolveSelected(false)}><RotateCcw size={15} aria-hidden="true" /> {t('Qayta ochish')}</Button>
        </div>

        {groups.isLoading && <PageLoader label={t('Xatolar yuklanmoqda…')} />}
        {groups.isError && <Alert tone="danger">{getErrorMessage(groups.error)}</Alert>}
        {data && items.length === 0 && <EmptyState icon={<Check size={26} />} title={t('Xato topilmadi')} description={dirty ? t('Filtrlarni o‘zgartirib ko‘ring.') : t('Tanlangan davrda xato qayd etilmagan.')} />}

        {items.length > 0 && (
          <div className={cx('gm-ul__table', groups.isFetching && 'is-loading')}>
            <table>
              <thead>
                <tr>
                  <th className="gm-ul__c-check" />
                  <th className="gm-ul__c-num">#</th>
                  <th>{t('Jiddiylik')}</th>
                  <th>{t('Kod')}</th>
                  <th>{t('Xato / xabar')}</th>
                  <th className="gm-ul__c-phone">{t('Endpoint')}</th>
                  <th><button type="button" onClick={() => sortBy('count')}>{t('Takrorlanish')}{mark('count')}</button></th>
                  <th className="gm-ul__c-orders"><button type="button" onClick={() => sortBy('users')}>{t('Foydalanuvchilar')}{mark('users')}</button></th>
                  <th><button type="button" onClick={() => sortBy('last')}>{t('Oxirgi marta')}{mark('last')}</button></th>
                  <th>{t('Holat')}</th>
                  <th className="gm-ul__c-act">{t('Amallar')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => {
                  const severe = row.severity === 'ERROR';
                  return (
                    <tr key={row.fingerprint} className={cx(openFp === row.fingerprint && 'is-open', selected.has(row.fingerprint) && 'is-selected')} onClick={() => setOpenFp(row.fingerprint)}>
                      <td className="gm-ul__c-check" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(row.fingerprint)} onChange={() => toggle(row.fingerprint)} aria-label={t('{name} ni tanlash', { name: statusName(row.status, row.kind) })} />
                      </td>
                      <td className="gm-ul__c-num">{(page - 1) * pageSize + index + 1}</td>
                      <td><span className={cx('gm-errs2__sev', severe ? 'is-err' : 'is-warn')}>{severe ? <AlertOctagon size={13} /> : <AlertTriangle size={13} />} {severe ? t('Jiddiy') : t('Ogohlantirish')}</span></td>
                      <td><strong className="gm-errs2__codecell">{row.status ?? '—'}</strong></td>
                      <td>
                        <div className="gm-ntf__text">
                          <strong>{statusName(row.status, row.kind)}</strong>
                          <small title={row.message}>{row.message}</small>
                        </div>
                      </td>
                      <td className="gm-ul__c-phone"><code className="gm-errs2__path" title={whereOf(row)}>{whereOf(row)}</code></td>
                      <td><b>{formatNumber(row.count)}</b></td>
                      <td className="gm-ul__c-orders"><span className="gm-errs2__users">{row.platform === 'android' || row.platform === 'ios' ? <Smartphone size={14} /> : <Users size={14} />} {row.users}</span></td>
                      <td><span className="gm-ul__date">{formatDate(row.lastSeenAt)}<small>{formatTime(row.lastSeenAt)}</small></span></td>
                      <td><Badge tone={row.resolved ? 'success' : 'danger'}>{row.resolved ? t('Yechilgan') : t('Hal qilinmagan')}</Badge></td>
                      <td className="gm-ul__c-act" onClick={(event) => event.stopPropagation()}>
                        <span className="gm-ul__acts">
                          <button type="button" aria-label={t('Ko‘rish')} title={t('Ko‘rish')} onClick={() => setOpenFp(row.fingerprint)}><Eye size={16} /></button>
                          <Dropdown
                            triggerClassName="gm-ul__more"
                            label={t('Boshqa amallar')}
                            trigger={<MoreHorizontal size={17} />}
                            items={[
                              { label: t('Batafsil'), icon: <Eye size={16} />, onSelect: () => setOpenFp(row.fingerprint) },
                              row.resolved
                                ? { label: t('Qayta ochish'), icon: <RotateCcw size={16} />, onSelect: () => resolve.mutate({ fingerprint: row.fingerprint, value: false }) }
                                : { label: t('Hal qilindi deb belgilash'), icon: <Check size={16} />, onSelect: () => resolve.mutate({ fingerprint: row.fingerprint, value: true }) },
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
            <span>{t('Jami: {total} ta xatolik guruhi (turi)', { total: formatNumber(data.total) })} · {o ? t('{count} ta hodisa', { count: formatNumber(o.current.total) }) : ''}</span>
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

      {openFp && <ErrorDrawer fingerprint={openFp} onClose={() => setOpenFp(null)} />}
    </div>
  );
}
