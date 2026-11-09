import { useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowDown, ArrowUp, Bell, Boxes, Cpu, Database, GitCommit, HardDrive, MemoryStick, RefreshCw, Rocket, Route, Server, ShieldCheck, Siren, Tag, Timer, TriangleAlert, Workflow } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDateTime, formatDecimal, formatNumber } from '@/lib/format';
import { useDevOps } from '@/features/admin/hooks/useAdmin';
import { OpenStreetMapIcon, OsrmIcon, TelegramIcon, YandexMapsIcon } from '@/features/admin/components/BrandIcons';
import { Sparkline, TrafficChart } from '@/features/admin/components/DevOpsCharts';
import type { SparkTone } from '@/features/admin/components/DevOpsCharts';
import type { DevOpsSnapshot, DevOpsWindow, OpsAlert, OpsDeployment } from '@/features/admin/types';
import { apiGet, apiPost } from '@/services/api.client';
import './AdminDevOpsPage.css';
import { t } from '@/i18n';
import { safeExternalUrl } from '@/lib/return-to';
import { Tab } from '@/components/ui/Tabs';

const WINDOW_TABS: Array<{ value: DevOpsWindow; label: string }> = [
  { value: '1h', label: t('1 soat') },
  { value: '24h', label: t('24 soat') },
  { value: '7d', label: t('7 kun') },
  { value: '30d', label: t('30 kun') },
];

type Level = 'good' | 'warning' | 'danger';
const LEVEL_BADGE: Record<Level, { tone: BadgeTone; label: string }> = {
  good: { tone: 'success', label: t('Normal') },
  warning: { tone: 'warning', label: t('Diqqat') },
  danger: { tone: 'danger', label: t('Kritik') },
};
const LEVEL_SPARK: Record<Level, SparkTone> = { good: 'success', warning: 'warning', danger: 'danger' };

const usageLevel = (percent: number): Level => (percent >= 90 ? 'danger' : percent >= 70 ? 'warning' : 'good');

function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (days > 0) return t('{days} kun {hours} soat', { days, hours });
  if (hours > 0) return t('{hours} soat {minutes} daq', { hours, minutes });
  return t('{minutes} daq', { minutes });
}

function Kpi({ icon, label, level, value, sub, footer, children }: { icon: ReactNode; label: string; level: Level; value: ReactNode; sub: ReactNode; footer?: ReactNode; children?: ReactNode }) {
  const badge = LEVEL_BADGE[level];
  return (
    <article className="gm-dkpi">
      <header>
        <span className="gm-dkpi__icon">{icon}</span>
        <h2>{label}</h2>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </header>
      <p className="gm-dkpi__value">{value}</p>
      <p className="gm-dkpi__sub">{sub}</p>
      {children}
      {footer && <p className="gm-dkpi__foot">{footer}</p>}
    </article>
  );
}

function Panel({ icon, title, badge, children, className }: { icon: ReactNode; title: string; badge?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('gm-dpanel', className)}>
      <header>
        <span className="gm-dpanel__icon">{icon}</span>
        <h2>{title}</h2>
        {badge}
      </header>
      {children}
    </section>
  );
}

function Row({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="gm-drow">
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function Delta({ current, previous, lowerIsBetter = false, suffix = '%' }: { current: number; previous: number | null | undefined; lowerIsBetter?: boolean; suffix?: string }) {
  if (previous === null || previous === undefined || previous === 0) return <small className="gm-dstat__delta" title={t('Oldingi davr bilan solishtirib bo‘lmaydi')}>{t('Solishtirish: ma’lumot yetarli emas')}</small>;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return <small className="gm-dstat__delta">{t('O‘zgarishsiz')}</small>;
  const good = lowerIsBetter ? change < 0 : change > 0;
  const Icon = change > 0 ? ArrowUp : ArrowDown;
  return (
    <small className={cx('gm-dstat__delta', good ? 'is-good' : 'is-bad')}>
      <Icon size={12} aria-hidden="true" /> {Math.abs(change)}
      {suffix}
    </small>
  );
}

function externalServices(data: DevOpsSnapshot) {
    const names: Record<string, string> = { geocoder: t('Manzil qidiruvi (geokoder)'), osrm: t('Marshrut serveri (OSRM)') };
  return data.providers.map((item) => {
    const used = item.success + item.failure + item.used > 0;
    const level: Level = item.state === 'OPEN' || (item.usage ?? 0) >= 95 ? 'danger' : item.state === 'HALF_OPEN' || (item.usage ?? 0) >= 80 || (item.successRate !== null && item.successRate < 90) ? 'warning' : 'good';
    return { key: item.key, icon: item.key === 'osrm' ? <OsrmIcon /> : item.provider === 'yandex' ? <YandexMapsIcon /> : item.provider === 'osm' ? <OpenStreetMapIcon /> : <Server size={22} />, name: names[item.key] ?? item.label, provider: item.provider, level, state: item.state, used, item };
  });
}

export function AdminDevOpsPage() {
  const [window, setWindow] = useState<DevOpsWindow>('1h');
  const devops = useDevOps(window);
  const data = devops.data;

  const dangerCount = data?.issues.filter((issue) => issue.level === 'danger').length ?? 0;

  return (
    <div className="gm-devops">
      <header className="gm-devops__head">
        <span className="gm-devops__logo">
          <Boxes size={26} aria-hidden="true" />
        </span>
        <div className="gm-devops__title">
          <h1>DevOps</h1>
          <p>{t('Server monitoring va tizim holati')}</p>
        </div>
        <div className="gm-devops__tools">
          {data && (
            <span className={cx('gm-devops__status', data.issues.length === 0 ? 'is-ok' : dangerCount > 0 ? 'is-bad' : 'is-warn')}>
              <i aria-hidden="true" />
              {data.issues.length === 0 ? t('Tizim normal') : t('{count} ta muammo', { count: data.issues.length })}
            </span>
          )}
          <div className="gm-devops__tabs" role="tablist" aria-label={t('Vaqt oralig‘i')}>
            {WINDOW_TABS.map((tab) => (
              <Tab key={tab.value} role="tab" aria-selected={window === tab.value} onClick={() => setWindow(tab.value)} selected={window === tab.value}>
                {tab.label}
              </Tab>
            ))}
          </div>
          <Button variant="secondary" size="sm" loading={devops.isFetching} onClick={() => void devops.refetch()}>
            <RefreshCw size={15} aria-hidden="true" /> {t('Yangilash')}
          </Button>
        </div>
      </header>

      {devops.isLoading && <PageLoader variant="list" label={t('Tizim holati yuklanmoqda…')} />}
      {devops.isError && <Alert tone="danger">{getErrorMessage(devops.error)}</Alert>}

      {data && (
        <>
          {data.issues.length > 0 && (
            <Alert tone={dangerCount > 0 ? 'danger' : 'warning'} title={t('Muammolar bor')}>
              <ul className="gm-devops-issues">
                {data.issues.map((issue) => (
                  <li key={issue.message}>{issue.message}</li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="gm-devops__kpis">
            <Kpi
              icon={<Cpu size={20} />}
              label="CPU"
              level={usageLevel(data.system.cpuPercent)}
              value={`${data.system.cpuPercent}%`}
              sub={t('Yuklama')}
              footer={t('Yuklama {join} · {cpuCount} yadro', { join: data.system.loadAvg.join(' · '), cpuCount: data.system.cpuCount })}
            >
              <Sparkline values={data.history.map((p) => p.cpu)} tone={LEVEL_SPARK[usageLevel(data.system.cpuPercent)]} max={100} />
            </Kpi>
            <Kpi
              icon={<MemoryStick size={20} />}
              label={t('Xotira (RAM)')}
              level={usageLevel(data.system.usedMemPercent)}
              value={`${data.system.usedMemPercent}%`}
              sub={`${formatDecimal((data.system.totalMemMB - data.system.freeMemMB) / 1024, 2)} GB / ${formatDecimal(data.system.totalMemMB / 1024, 2)} GB`}
            >
              <Sparkline values={data.history.map((p) => p.mem)} tone={LEVEL_SPARK[usageLevel(data.system.usedMemPercent)]} max={100} />
            </Kpi>
            <Kpi
              icon={<HardDrive size={20} />}
              label={t('Disk')}
              level={data.system.disk ? usageLevel(data.system.disk.usedPercent) : 'warning'}
              value={data.system.disk ? `${data.system.disk.usedPercent}%` : '—'}
              sub={data.system.disk ? `${formatNumber(data.system.disk.usedGB)} GB / ${formatNumber(data.system.disk.totalGB)} GB` : t('Disk ma’lumoti o‘qib bo‘lmadi.')}
            >
              <Sparkline values={data.history.map((p) => p.disk).filter((v): v is number => v !== null)} tone="violet" max={100} />
            </Kpi>
            <Kpi
              icon={<Timer size={20} />}
              label={t('Server ishlash vaqti')}
              level="good"
              value={formatDuration(data.system.uptimeSeconds)}
              sub={data.system.hostname}
              footer={t('Ishga tushgan: {at}', { at: formatDateTime(new Date(Date.now() - data.system.uptimeSeconds * 1000).toISOString()) })}
            />
            <Kpi
              icon={<TriangleAlert size={20} />}
              label={t('Server xatolari')}
              level={data.errors.last24h === 0 ? 'good' : data.errors.last24h < 20 ? 'warning' : 'danger'}
              value={`${data.errors.last24h} / ${data.errors.logged24h}`}
              sub={t('Oxirgi 24 soat')}
              footer={t('Oxirgi soatda: {count}', { count: data.errors.lastHour })}
            >
              <Sparkline values={data.errors.series.map((p) => p.count)} tone={data.errors.last24h === 0 ? 'success' : 'danger'} />
            </Kpi>
          </div>

          <div className="gm-devops__cols">
            <Panel icon={<Workflow size={18} />} title={t('Node jarayoni')} badge={<Badge tone="success">Online</Badge>}>
              <Row label={t('Holat')} value={<span className="gm-drow__ok">{t('Ishlayapti')}</span>} />
              <Row label="PID" value={data.process.pid} />
              <Row label={t('Jarayon ishlash vaqti')} value={formatDuration(data.process.uptimeSeconds)} />
              <Row label={t('Xotira (RSS)')} value={`${data.process.rssMB} MB`} />
              <div className="gm-drow gm-drow--heap">
                <span>{t('Heap')}</span>
                <div className="gm-drow__heap">
                  <Sparkline values={data.history.map((p) => p.heapMB)} tone="primary" />
                  <Badge tone={usageLevel(Math.round((data.process.heapUsedMB / data.process.heapLimitMB) * 100)) === 'good' ? 'success' : 'warning'}>
                    {data.process.heapUsedMB} / {data.process.heapLimitMB} MB ({Math.round((data.process.heapUsedMB / data.process.heapLimitMB) * 100)}%)
                  </Badge>
                </div>
              </div>
              <Row label={t('CPU vaqti')} value={`${formatNumber(data.process.cpuUserMs)} ms user · ${formatNumber(data.process.cpuSystemMs)} ms sys`} />
              <Row
                label={t('Nazoratchi')}
                value={{ pm2: 'PM2', systemd: 'systemd', docker: 'Docker', none: t('yo‘q (oddiy jarayon)') }[data.process.supervisor]}
              />
            </Panel>

            <Panel
              icon={<Tag size={18} />}
              title={t('Versiya va bog‘liqliklar')}
              badge={<Badge tone={data.dependencies.database.ok && data.dependencies.redis.ok ? 'success' : 'danger'}>{data.dependencies.database.ok && data.dependencies.redis.ok ? t('Tayyor') : t('Muammo')}</Badge>}
            >
              <Row icon={<GitCommit size={14} aria-hidden="true" />} label={t('Commit')} value={data.version.commit ?? '—'} />
              <Row label={t('Versiya')} value={`v${data.version.appVersion} · ${data.version.environment}`} />
              <Row label={t('Ishga tushgan')} value={formatDateTime(data.version.startedAt)} />
              <Row label="Node.js" value={data.version.nodeVersion} />
              <Row label={t('Tizim')} value={data.system.platform} />
              <Row label={t('Ma’lumotlar bazasi')} value={<Ping ping={data.dependencies.database} />} />
              <Row label="Redis" value={<Ping ping={data.dependencies.redis} />} />
              <Row
                icon={<Bell size={14} aria-hidden="true" />}
                label={t('Telegram ogohlantirish')}
                value={<Badge tone={data.dependencies.telegramAlerting ? 'success' : 'warning'}>{data.dependencies.telegramAlerting ? t('Sozlangan') : t('Sozlanmagan')}</Badge>}
              />
            </Panel>

            <Panel
              icon={<Database size={18} />}
              title={t('Zaxira nusxa')}
              badge={<Badge tone={!data.backup.configured ? 'warning' : data.backup.stale ? 'danger' : 'success'}>{!data.backup.configured ? t('Sozlanmagan') : data.backup.stale ? t('Eskirgan') : t('Muvaffaqiyatli')}</Badge>}
            >
              <div className={cx('gm-dbackup', !data.backup.configured ? 'is-warn' : data.backup.stale ? 'is-bad' : 'is-ok')}>
                <ShieldCheck size={20} aria-hidden="true" />
                <div>
                  <strong>{data.backup.configured ? t('Oxirgi zaxira: {at}', { at: formatDateTime(data.backup.lastAt) }) : t('Zaxira nusxa topilmadi')}</strong>
                  <span>{data.backup.configured ? data.backup.file : data.backup.message}</span>
                </div>
              </div>
              {data.backup.configured && (
                <>
                  <Row label={t('Oxirgi zaxira')} value={data.backup.ageHours !== null ? t('{hours} soat oldin', { hours: data.backup.ageHours }) : '—'} />
                  <Row label={t('Hajmi')} value={data.backup.sizeMB !== null ? `${data.backup.sizeMB} MB` : '—'} />
                  <Row label={t('Saqlangan nusxalar')} value={`${data.backup.count} / ${data.backup.keepDaily}`} />
                </>
              )}
            </Panel>
          </div>

          <div className="gm-devops__cols gm-devops__cols--wide">
            <Panel icon={<Route size={18} />} title={t('Tashqi xizmatlar')}>
              <div className="gm-dsvc">
                {externalServices(data).map((svc) => (
                  <div key={svc.key} className="gm-dsvc__item">
                    <span className="gm-dsvc__icon">{svc.icon}</span>
                    <div>
                      <strong>{svc.name}</strong>
                      <small>
                        {svc.used
                          ? [
                              svc.item.avgLatencyMs !== null && `${t('Murojaat')}: ${svc.item.avgLatencyMs} ms`,
                              svc.item.successRate !== null && `${t('Muvaffaqiyat')}: ${svc.item.successRate}%`,
                              `${t('Bugun')}: ${formatNumber(svc.item.success)} / ${formatNumber(svc.item.failure)} ${t('xato')}`,
                              `${t('Oy')}: ${formatNumber(svc.item.used)}${svc.item.limit ? ` / ${formatNumber(svc.item.limit)} (${svc.item.usage ?? 0}%)` : ''}`,
                              svc.item.lastOkAt && `${t('Oxirgi')}: ${formatDateTime(svc.item.lastOkAt)}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : t('Ishga tushgandan beri hali so‘rov bo‘lmagan')}
                        {svc.item.lastError && <em> · {svc.item.lastError}</em>}
                      </small>
                    </div>
                    <Badge tone={LEVEL_BADGE[svc.level].tone}>{svc.state === 'OPEN' ? t('O‘chirilgan') : svc.state === 'HALF_OPEN' ? t('Tekshirilmoqda') : t('Ishlayapti')}</Badge>
                  </div>
                ))}
                <div className="gm-dsvc__item">
                  <span className="gm-dsvc__icon">
                    <TelegramIcon />
                  </span>
                  <div>
                    <strong>{t('Telegram (operator alertlari)')}</strong>
                    <small>{data.dependencies.telegramAlerting ? t('Ogohlantirishlar yuboriladi') : t('Bot tokeni va chat sozlanmagan')}</small>
                  </div>
                  <Badge tone={data.dependencies.telegramAlerting ? 'success' : 'warning'}>{data.dependencies.telegramAlerting ? t('Sozlangan') : t('Sozlanmagan')}</Badge>
                </div>
              </div>
            </Panel>

            <Panel icon={<Activity size={18} />} title={t('API trafik')}>
              <TrafficChart data={data.traffic} window={window} />
              <div className="gm-dstats">
                <div className="gm-dstat">
                  <span>{t('So‘rovlar/min')}</span>
                  <strong>{formatNumber(data.trafficSummary.perMinute)}</strong>
                  <Delta current={data.trafficSummary.perMinute} previous={data.trafficSummary.previous?.perMinute} />
                </div>
                <div className="gm-dstat">
                  <span>{t('P95 javob vaqti')}</span>
                  <strong>{data.trafficSummary.p95Ms !== null ? `${data.trafficSummary.p95Ms} ms` : '—'}</strong>
                  {data.trafficSummary.p95Ms !== null && <Delta current={data.trafficSummary.p95Ms} previous={data.trafficSummary.previous?.p95Ms} lowerIsBetter />}
                </div>
                <div className="gm-dstat">
                  <span>{t('Xatolar')}</span>
                  <strong>{data.trafficSummary.errorRate}%</strong>
                  <Delta current={data.trafficSummary.errorRate} previous={data.trafficSummary.previous?.errorRate} lowerIsBetter />
                </div>
              </div>
              <div className="gm-dtop">
                <h3>{t('Top endpointlar')}</h3>
                {data.topEndpoints.length === 0 && <p className="gm-dtop__empty">{t('Hali so‘rov qayd etilmagan.')}</p>}
                {data.topEndpoints.map((item) => (
                  <div key={item.route} className="gm-dtop__row">
                    <span>{item.route}</span>
                    <i>
                      <b style={{ width: `${Math.max(3, item.percent)}%` }} />
                    </i>
                    <strong>{item.percent}%</strong>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <OpsEvents />
        </>
      )}
    </div>
  );
}

const SEVERITY_TONE: Record<OpsAlert['severity'], BadgeTone> = { CRITICAL: 'danger', WARNING: 'warning', INFO: 'neutral' };
const DEPLOY_TONE = (status: string): BadgeTone => (status === 'SUCCEEDED' ? 'success' : status === 'FAILED' || status === 'ROLLED_BACK' ? 'danger' : 'warning');

/** Alertmanager alertlari (qabul qilish) va deploy jurnali — /ops/webhooks/* orqali keladi (HMAC imzo). */
function OpsEvents() {
  const queryClient = useQueryClient();
  const alerts = useQuery({ queryKey: ['admin', 'ops', 'alerts'], queryFn: () => apiGet<OpsAlert[]>('/admin/ops/alerts'), refetchInterval: 30_000 });
  const deploys = useQuery({ queryKey: ['admin', 'ops', 'deployments'], queryFn: () => apiGet<OpsDeployment[]>('/admin/ops/deployments'), refetchInterval: 60_000 });
  const ack = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/ops/alerts/${id}/ack`, {}),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'alerts'] }); void queryClient.invalidateQueries({ queryKey: ['admin', 'devops'] }); },
  });
  const open = alerts.data?.filter((a) => a.status === 'FIRING' && !a.acknowledgedAt).length ?? 0;
  return (
    <div className="gm-devops__cols gm-devops__cols--wide">
      <Panel icon={<Siren size={18} />} title={t('Alertlar')} badge={<Badge tone={open ? 'warning' : 'success'}>{open ? t('{n} ta ochiq', { n: open }) : t('Ochiq alert yo‘q')}</Badge>}>
        {alerts.isError && <Alert tone="danger">{getErrorMessage(alerts.error)}</Alert>}
        {!alerts.data?.length && !alerts.isLoading && <p className="gm-dtop__empty">{t('Hali alert kelmagan. Alertmanager webhook: POST /api/v1/ops/webhooks/alertmanager (x-quyosh-signature).')}</p>}
        <div className="gm-dsvc">
          {alerts.data?.slice(0, 12).map((a) => (
            <div key={a.id} className="gm-dsvc__item">
              <span className="gm-dsvc__icon"><TriangleAlert size={20} /></span>
              <div>
                <strong>{a.alertName}</strong>
                <small>
                  {a.summary} · {formatDateTime(a.startsAt)}
                  {a.status === 'RESOLVED' ? ` · ${t('hal bo‘ldi')}${a.endsAt ? ` ${formatDateTime(a.endsAt)}` : ''}` : ''}
                  {a.acknowledgedAt ? ` · ${t('qabul qilindi')} ${formatDateTime(a.acknowledgedAt)}` : ''}
                </small>
              </div>
              <span className="gm-dsvc__actions">
                <Badge tone={a.status === 'RESOLVED' ? 'success' : SEVERITY_TONE[a.severity]}>{a.status === 'RESOLVED' ? 'RESOLVED' : a.severity}</Badge>
                {a.status === 'FIRING' && !a.acknowledgedAt && (
                  <Button size="sm" variant="secondary" loading={ack.isPending && ack.variables === a.id} onClick={() => ack.mutate(a.id)}>{t('Qabul qildim')}</Button>
                )}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel icon={<Rocket size={18} />} title={t('Deploylar')}>
        {deploys.isError && <Alert tone="danger">{getErrorMessage(deploys.error)}</Alert>}
        {!deploys.data?.length && !deploys.isLoading && <p className="gm-dtop__empty">{t('Hali deploy qayd etilmagan. CI webhook: POST /api/v1/ops/webhooks/deploy (x-quyosh-signature).')}</p>}
        <div className="gm-dsvc">
          {deploys.data?.slice(0, 10).map((d) => (
            <div key={d.id} className="gm-dsvc__item">
              <span className="gm-dsvc__icon"><GitCommit size={20} /></span>
              <div>
                <strong>{d.service} · {d.version}</strong>
                <small>
                  {d.environment} · {formatDateTime(d.startedAt)}
                  {d.finishedAt ? ` → ${formatDateTime(d.finishedAt)}` : ''}
                  {d.gitSha ? ` · ${d.gitSha.slice(0, 8)}` : ''}
                  {d.triggeredBy ? ` · ${d.triggeredBy}` : ''}
                  {safeExternalUrl(d.changelogUrl) && <> · <a href={safeExternalUrl(d.changelogUrl)} target="_blank" rel="noreferrer">{t('O‘zgarishlar')}</a></>}
                </small>
              </div>
              <Badge tone={DEPLOY_TONE(d.status)}>{d.status}</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Ping({ ping }: { ping: { ok: boolean; latencyMs: number | null } }) {
  return <Badge tone={ping.ok ? 'success' : 'danger'}>{ping.ok ? `${t('Ulangan')}${ping.latencyMs !== null ? ` · ${ping.latencyMs} ms` : ''}` : t('Ulanmagan')}</Badge>;
}
