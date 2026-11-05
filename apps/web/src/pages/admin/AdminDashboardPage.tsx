import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Calculator, ClipboardList, FileText, Sparkles, Store, TrendingDown, TrendingUp, Users, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { formatNumber } from '@/lib/utils';
import { regionName } from '@/lib/regions';
import { useDashboardOverview } from '@/features/admin/dashboard/useOverview';
import { demoOverview } from '@/features/admin/dashboard/demo';
import { Bars, Gauge, HBars, Histogram, Scatter, SmoothArea, Wave } from '@/features/admin/dashboard/charts';
import '@/features/admin/dashboard/charts.css';
import './AdminDashboardPage.css';
import { t } from '@/i18n';
import { AdminQueues } from '@/pages/m7/AdminM7Pages';

const PERIODS = [7, 30, 90] as const;
type SeriesKey = 'users' | 'calculations' | 'requests' | 'quotes';

const REQUEST_STATUS: Record<string, string> = { OPEN: t('Ochiq'), CLOSED_SELECTED: t('Tanlandi'), CLOSED_NO_SELECTION: t('Tanlanmadi'), EXPIRED: t('Muddati o‘tgan'), CANCELLED: t('Bekor qilingan') };
const INSTALL_STATUS: Record<string, string> = {
  AGREED: t('Kelishildi'), SITE_VISIT_SCHEDULED: t('O‘lchov belgilandi'), INSTALLATION_SCHEDULED: t('Montaj sanasi belgilandi'), INSTALLED: t('Montaj bajarildi'),
  CONFIRMED: t('Tasdiqlangan'), DISPUTED: t('Nizoli'), CANCELLED: t('Bekor qilingan'),
};
const SYSTEM_TYPE: Record<string, string> = { ON_GRID: t('Tarmoqqa ulangan'), HYBRID: t('Gibrid'), OFF_GRID: t('Avtonom') };
const SHOP_STATUS: Record<string, string> = { ACTIVE: t('Faol'), PENDING_REVIEW: t('Ko‘rib chiqilmoqda'), SUSPENDED: t('To‘xtatilgan'), DRAFT: t('Qoralama') };

const rows = (record: Record<string, number>, labels: Record<string, string>) =>
  Object.entries(record).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ label: labels[key] ?? key, value }));

function Delta({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <em className="nd-kpi__delta nd-kpi__delta--flat">—</em>;
  const up = value >= 0;
  return (
    <em className={up ? 'nd-kpi__delta nd-kpi__delta--up' : 'nd-kpi__delta nd-kpi__delta--down'}>
      {up ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />} {up ? '+' : ''}{value}%
    </em>
  );
}

function Kpi({ to, icon, value, label, delta, note }: { to: string; icon: ReactNode; value: number; label: string; delta?: number | null; note?: string }) {
  return (
    <Link to={to} className="nd-kpi">
      <span className="nd-kpi__icon" aria-hidden="true">{icon}</span>
      <span className="nd-kpi__body">
        <strong>{formatNumber(value, '\u00A0')}</strong>
        <small>{label}</small>
        {note && <small className="nd-kpi__note">{note}</small>}
        {delta !== undefined && <Delta value={delta} />}
      </span>
    </Link>
  );
}

function Card({ title, sub, value, icon, className, children, actions }: { title: string; sub?: string; value?: string | number; icon?: ReactNode; className?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`nd-card ${className ?? ''}`}>
      <header>
        {icon && <span className="nd-card__icon" aria-hidden="true">{icon}</span>}
        {value !== undefined && <strong className="nd-card__value">{typeof value === 'number' ? formatNumber(value, '\u00A0') : value}</strong>}
        <div className="nd-card__title"><h2>{title}</h2>{sub && <small>{sub}</small>}</div>
        {actions && <div className="nd-card__actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** Admin boshqaruv paneli (TZ U12.1): neon uslubdagi katta dashboard — KPI, kunlik grafiklar, taqsimotlar, navbatlar. */
export function AdminDashboardPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [demo, setDemo] = useState(false);
  const [series, setSeries] = useState<SeriesKey>('users');
  const query = useDashboardOverview(days, !demo);
  const data = useMemo(() => (demo ? demoOverview(days) : query.data), [demo, days, query.data]);

  if (!demo && query.isLoading) return <PageLoader />;
  if (!demo && (query.isError || !data)) return <Alert tone="danger">{getErrorMessage(query.error)}</Alert>;
  if (!data) return <PageLoader />;

  const k = data.kpis;
  const d = data.distributions;
  const seriesTabs: Array<[SeriesKey, string]> = [['users', t('Foydalanuvchilar')], ['calculations', t('Hisoblar')], ['requests', t('So‘rovlar')], ['quotes', t('Takliflar')]];
  const seriesValue: Record<SeriesKey, number> = { users: k.users.period, calculations: k.calculations.period, requests: k.requests.period, quotes: k.quotes.period };
  const confirmed = d.installStatus.CONFIRMED ?? 0;
  const confirmedPct = k.installations.total > 0 ? (confirmed / k.installations.total) * 100 : 0;
  const regionItems = d.requestRegion.slice(0, 8).map((item) => ({ label: item.region === 'NONE' ? t('Noma’lum') : regionName(item.region).split(' ')[0]!, value: item.count }));
  const ratingItems = [1, 2, 3, 4, 5].map((rating) => ({ label: `${rating}★`, value: d.ratingDist.find((row) => row.rating === rating)?.count ?? 0 }));
  const ds = (key: keyof typeof data.series) => data.series[key];

  return (
    <div className="qs-dash nd">
      <div className="nd-head">
        <div>
          <h1>{t('Boshqaruv paneli')}</h1>
          <p>{demo ? t('Namuna ma’lumotlar — haqiqiy bazaga tegmaydi') : t('Oxirgi {n} kun bo‘yicha platforma ko‘rsatkichlari', { n: days })}</p>
        </div>
        <div className="nd-head__tools">
          <div className="nd-pills" role="group" aria-label={t('Davr')}>
            {PERIODS.map((p) => <button key={p} type="button" className={p === days ? 'is-on' : ''} onClick={() => setDays(p)}>{p} {t('kun')}</button>)}
          </div>
          <button type="button" className={`nd-demo ${demo ? 'is-on' : ''}`} onClick={() => setDemo((v) => !v)} aria-pressed={demo}><Sparkles size={14} aria-hidden="true" /> {t('Namuna ko‘rinish')}</button>
        </div>
      </div>

      <div className="nd-kpis">
        <Kpi to="/admin/foydalanuvchilar" icon={<Users size={22} />} value={k.users.total} label={t('Foydalanuvchilar')} delta={k.users.delta} note={t('+{n} yangi', { n: formatNumber(k.users.period) })} />
        <Kpi to="/admin/dokonlar" icon={<Store size={22} />} value={k.shops.total} label={t('Do‘konlar')} note={t('{n} faol', { n: k.shops.active })} />
        <Kpi to="/admin/kalkulyator" icon={<Calculator size={22} />} value={k.calculations.total} label={t('Hisoblar')} delta={k.calculations.delta} note={t('+{n} yangi', { n: formatNumber(k.calculations.period) })} />
        <Kpi to="/admin/hisobot" icon={<ClipboardList size={22} />} value={k.requests.total} label={t('So‘rovlar')} delta={k.requests.delta} note={t('+{n} yangi', { n: formatNumber(k.requests.period) })} />
        <Kpi to="/admin/hisobot" icon={<FileText size={22} />} value={k.quotes.total} label={t('Takliflar')} delta={k.quotes.delta} note={t('+{n} yangi', { n: formatNumber(k.quotes.period) })} />
        <Kpi to="/admin/hisobot" icon={<Wrench size={22} />} value={k.installations.total} label={t('Montajlar')} delta={k.installations.delta} note={t('+{n} yangi', { n: formatNumber(k.installations.period) })} />
      </div>

      <div className="nd-grid">
        <Card
          className="nd-a"
          icon={<Activity size={26} />}
          value={seriesValue[series]}
          title={t('Kunlik faollik')}
          sub={t('Oxirgi {n} kun', { n: days })}
          actions={<div className="nd-pills nd-pills--sm" role="group" aria-label={t('Ko‘rsatkich')}>{seriesTabs.map(([key, label]) => <button key={key} type="button" className={key === series ? 'is-on' : ''} onClick={() => setSeries(key)}>{label}</button>)}</div>}
        >
          <SmoothArea values={ds(series)} labels={data.labels} aria={t('Kunlik faollik grafigi')} height={290} />
        </Card>

        <Card className="nd-b" icon={<ClipboardList size={24} />} value={k.requests.total} title={t('So‘rovlar hududlar bo‘yicha')} sub={t('Eng faol hududlar')}>
          {regionItems.length ? <Bars items={regionItems} aria={t('Hududlar bo‘yicha so‘rovlar')} height={190} /> : <p className="nd-empty">{t('Ma’lumot yo‘q')}</p>}
        </Card>

        <Card className="nd-c" icon={<Wrench size={24} />} value={k.installations.total} title={t('Montaj holatlari')} sub={t('Barcha montajlar')}>
          {rows(d.installStatus, INSTALL_STATUS).length ? <HBars rows={rows(d.installStatus, INSTALL_STATUS).slice(0, 6)} max={k.installations.total} /> : <p className="nd-empty">{t('Ma’lumot yo‘q')}</p>}
        </Card>

        <Card className="nd-s" icon={<Wrench size={22} />} value={k.installations.total} title={t('Qabul qilingan montajlar')} sub={t('Chek-list bilan tasdiqlangan ulush')}>
          <Gauge percent={confirmedPct} label={t('tasdiqlangan')} aria={t('Tasdiqlangan montajlar ulushi')} />
        </Card>
        <Card className="nd-s" icon={<Calculator size={22} />} value={k.calculations.period} title={t('Kunlik hisoblar')} sub={t('Oxirgi {n} kun', { n: days })}>
          <Histogram values={ds('calculations')} labels={data.labels} aria={t('Kunlik hisoblar')} />
        </Card>
        <Card className="nd-s" icon={<FileText size={22} />} value={k.quotes.total} title={t('Taklif: quvvat va narx')} sub={t('kVt bo‘yicha narx')}>
          {data.quotePoints.length ? <Scatter points={data.quotePoints.map((p) => ({ x: p.kw, y: p.total, hot: p.status === 'ACCEPTED' }))} xLabel="kW" yLabel="UZS" aria={t('Taklif quvvati va narxi')} /> : <p className="nd-empty">{t('Ma’lumot yo‘q')}</p>}
        </Card>
        <Card className="nd-s" icon={<Users size={22} />} value={k.tickets.open} title={t('Ochiq murojaatlar')} sub={t('Yangi murojaatlar')}>
          <Wave values={ds('tickets')} labels={data.labels} aria={t('Murojaatlar dinamikasi')} />
        </Card>

        <Card className="nd-t" icon={<ClipboardList size={22} />} value={k.requests.total} title={t('So‘rovlar holati')}>
          {rows(d.requestStatus, REQUEST_STATUS).length ? <HBars rows={rows(d.requestStatus, REQUEST_STATUS)} max={k.requests.total} /> : <p className="nd-empty">{t('Ma’lumot yo‘q')}</p>}
        </Card>
        <Card className="nd-t" icon={<Sparkles size={22} />} value={k.reviews.avg ? `${k.reviews.avg}★` : '—'} title={t('Sharhlar reytingi')} sub={t('{n} ta sharh', { n: k.reviews.total })}>
          <Bars items={ratingItems} aria={t('Sharhlar reytingi taqsimoti')} height={170} />
        </Card>
        <Card className="nd-t" icon={<Calculator size={22} />} value={Object.values(d.calcType).reduce((a, b) => a + b, 0)} title={t('Tizim turlari')} sub={t('Hisoblar bo‘yicha')}>
          {rows(d.calcType, SYSTEM_TYPE).length ? <HBars rows={rows(d.calcType, SYSTEM_TYPE)} /> : <p className="nd-empty">{t('Ma’lumot yo‘q')}</p>}
          <h3 className="nd-sub">{t('Do‘konlar holati')}</h3>
          {rows(d.shopStatus, SHOP_STATUS).length ? <HBars rows={rows(d.shopStatus, SHOP_STATUS)} /> : null}
        </Card>
      </div>

      <AdminQueues />
    </div>
  );
}
