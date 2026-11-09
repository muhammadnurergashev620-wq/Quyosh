import { ErrorState } from '@/components/ui/ErrorState';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, Copy, Download, Image as ImageIcon, Monitor, Plus, Smartphone, Eye, Hourglass, Inbox, Send, ShieldCheck, Target, Timer, Trash2, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/Button.helpers';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { kw, SYSTEM_TYPE } from '@/features/calc/labels';
import type { SystemType } from '@/features/calc/types';
import { m7Service, uploadMedia } from '@/features/m7/m7.service';
import type { Project } from '@/features/m7/types';
import { useCurrentShop } from '@/features/shop/current-shop';
import { REGIONS } from '@/lib/regions';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/format';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/deals/deals.css';
import '@/features/m7/m7.css';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Tab, TabBar } from '@/components/ui/Tabs';

const regionName = (code: string) => REGIONS.find((r) => r.code === code)?.name ?? (code === 'unknown' ? t('Ko‘rsatilmagan') : code);
const minutes = (m: number | null) => (m === null ? '—' : m < 60 ? t('{n} daq', { n: m }) : t('{n} soat', { n: Math.round(m / 60) }));
const share = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)} %`);

/** U11.2: KPI (30 kun) va «Bugun javob bering» — SLA bo‘yicha eng eskilari birinchi. */
export function ShopKpis({ shopId }: { shopId: string }) {
  const d = useQuery({ queryKey: ['shop-dashboard', shopId], queryFn: () => m7Service.shopDashboard(shopId), refetchInterval: 60_000 });
  if (!d.data) return null;
  const k = d.data.kpis;
  return (
    <>
      <StatGrid columns={4}>
        <StatCard variant="compact" icon={<Eye />} label={t('Ko‘rishlar (30 kun)')} value={k.views} to="/dokon/analitika" />
        <StatCard variant="compact" icon={<Inbox />} tone="info" label={t('Yangi so‘rovlar')} value={k.newRequests} to="/dokon/sorovlar" />
        <StatCard variant="compact" icon={<Hourglass />} tone="warning" label={t('Javob kutayotganlar')} value={k.waiting} to="/dokon/sorovlar" />
        <StatCard variant="compact" icon={<Send />} label={t('Yuborilgan takliflar')} value={k.quotesSent} to="/dokon/takliflar" />
        <StatCard variant="compact" icon={<Target />} tone="success" label={t('Tanlanish foizi')} value={share(k.selectionRate)} />
        <StatCard variant="compact" icon={<Timer />} label={t('Javob vaqti (median)')} value={minutes(k.medianResponseMinutes)} />
        <StatCard variant="compact" icon={<ShieldCheck />} tone="success" label={t('Muammosiz qabul qilingan')} value={share(k.cleanAcceptanceShare)} to="/dokon/montajlar" />
      </StatGrid>
      {d.data.replyToday.length > 0 && (
        <section className="qs-card">
          <header><h2>{t('Bugun javob bering')}</h2><Link to="/dokon/sorovlar">{t('Hammasi')}</Link></header>
          <div className="qs-req-list">
            {d.data.replyToday.map((r) => (
              <Link key={r.id} to={`/dokon/sorovlar/${r.id}`} className="qs-req-card">
                <div><h3>{r.customerFirstName ?? t('Mijoz')} · №{r.number}</h3><div className="qs-req-card__meta"><span>{SYSTEM_TYPE[r.systemType].title}{r.requiredCapacityKw ? ` · ${kw(Number(r.requiredCapacityKw))}` : ''}</span>{r.regionCode && <span>{regionName(r.regionCode)}</span>}</div></div>
                <div className="qs-req-card__side"><Badge tone={r.overdue ? 'warning' : 'neutral'}>{formatRelativeTime(r.sentAt)}</Badge></div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ProjectForm({ shopId, project, installations, onClose }: { shopId: string; project: Project | null; installations: Array<{ id: string; confirmedAt: string; quote: { systemPowerKw: string | null; request: { number: number } } }>; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [f, setF] = useState({
    title: project?.title ?? '', city: project?.city ?? '', power: project?.systemPowerKw ? String(Number(project.systemPowerKw)) : '', type: (project?.systemType ?? '') as SystemType | '',
    date: project?.completedAt?.slice(0, 10) ?? '', installationId: project?.installationId ?? '', description: project?.description ?? '', published: project?.published ?? true,
  });
  const [images, setImages] = useState(project?.images ?? []);
  const [drag, setDrag] = useState<number | null>(null);
  const upload = useMutation({ mutationFn: (file: File) => uploadMedia('PORTFOLIO', 'Shop', shopId, file), onSuccess: (r) => setImages((x) => [...x, { fileId: r.id, url: null, thumb: null }]) });
  const save = useMutation({
    mutationFn: () => m7Service.saveProject(shopId, project?.id ?? null, {
      title: f.title.trim(), city: f.city.trim() || undefined, systemPowerKw: f.power ? Number(f.power.replace(',', '.')) : undefined, systemType: f.type || undefined,
      completedAt: f.date || undefined, installationId: f.installationId || undefined, description: f.description.trim() || undefined, published: f.published, imageIds: images.map((i) => i.fileId),
    }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['projects', shopId] }); onClose(); },
  });
  const move = (from: number, to: number) => setImages((x) => { const a = [...x]; const [it] = a.splice(from, 1); a.splice(to, 0, it!); return a; });
  return (
    <Modal open onClose={onClose} title={project ? t('Loyihani tahrirlash') : t('Yangi loyiha')} wide footer={<Button disabled={f.title.trim().length < 2} loading={save.isPending} onClick={() => save.mutate()}>{t('Saqlash')}</Button>}>
      <div className="qs-form">
        <Input label={t('Sarlavha')} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <div className="qs-form__row">
          <Input label={t('Shahar')} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <Input label={t('Quvvat')} suffix={t('kVt')} inputMode="decimal" value={f.power} onChange={(e) => setF({ ...f, power: e.target.value.replace(/[^\d.,]/g, '') })} />
          <Input label={t('Sana')} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </div>
        <label className="gm-field__label" htmlFor="ptype">{t('Tizim turi')}</label>
        <SelectMenu id="ptype" className="qs-select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as SystemType })}><option value="">—</option>{(['ON_GRID', 'HYBRID', 'OFF_GRID'] as SystemType[]).map((s) => <option key={s} value={s}>{SYSTEM_TYPE[s].title}</option>)}</SelectMenu>
        <label className="gm-field__label" htmlFor="pinst">{t('Platformadagi montajga bog‘lash («Tasdiqlangan montaj» belgisi)')}</label>
        <SelectMenu id="pinst" className="qs-select" value={f.installationId} onChange={(e) => setF({ ...f, installationId: e.target.value })}><option value="">—</option>{installations.map((i) => <option key={i.id} value={i.id}>№{i.quote.request.number} · {formatDate(i.confirmedAt)}{i.quote.systemPowerKw ? ` · ${kw(Number(i.quote.systemPowerKw))}` : ''}</option>)}</SelectMenu>
        <Textarea label={t('Tavsif')} value={f.description} maxLength={4000} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="qs-thumbs" aria-label={t('Rasmlar (sudrab tartiblang)')}>
          {images.map((img, i) => (
            <figure key={img.fileId} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }}>
              {img.thumb ? <img src={img.thumb} alt="" /> : <div className="qs-thumbs__empty"><ImageIcon size={20} /></div>}
              <Button type="button" variant="secondary" size="sm" iconOnly className="qs-thumbs__remove" aria-label={t('Olib tashlash')} onClick={() => setImages((x) => x.filter((y) => y.fileId !== img.fileId))}><X /></Button>
            </figure>
          ))}
          <label className={buttonClass({ variant: 'secondary', size: 'sm' })} style={{ alignSelf: 'center' }}>
            <Plus size={14} /> {t('Rasm')}
            <input type="file" hidden accept="image/*" multiple onChange={(e) => { Array.from(e.target.files ?? []).slice(0, 20 - images.length).forEach((file) => upload.mutate(file)); e.target.value = ''; }} />
          </label>
        </div>
        {upload.isPending && <small className="qs-muted">{t('Yuklanmoqda…')}</small>}
        <label className="qs-check"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> {t('Profilda ko‘rsatish')}</label>
        {(save.isError || upload.isError) && <Alert tone="danger">{getErrorMessage(save.error ?? upload.error)}</Alert>}
      </div>
    </Modal>
  );
}

/** U11.10: portfolio. */
export function PortfolioPage() {
  const { shopId, can } = useCurrentShop();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['projects', shopId], queryFn: () => m7Service.projects(shopId!), enabled: !!shopId });
  const [edit, setEdit] = useState<Project | null | 'new'>(null);
  const [remove, setRemove] = useState<Project | null>(null);
  const del = useMutation({ mutationFn: (id: string) => m7Service.deleteProject(shopId!, id), onSuccess: () => { setRemove(null); void queryClient.invalidateQueries({ queryKey: ['projects', shopId] }); } });
  if (!shopId || list.isLoading) return <PageLoader />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Portfolio')}</h1><p>{t('Bajarilgan loyihalar profilingizda ko‘rinadi. Platformadagi montajga bog‘langanlari «Tasdiqlangan montaj» belgisini oladi.')}</p></div>{can('portfolio.write') && <div className="qs-page__actions"><Button onClick={() => setEdit('new')}><Plus size={16} /> {t('Loyiha qo‘shish')}</Button></div>}</div>
      {!list.data?.items.length ? <EmptyState icon={<ImageIcon size={30} />} title={t('Hali loyiha yo‘q')} /> : (
        <div className="qs-projects">
          {list.data.items.map((p) => (
            <article key={p.id} className="qs-project">
              {p.images[0]?.url ? <img src={p.images[0].url} alt={p.title} loading="lazy" /> : <div style={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', background: 'var(--qs-color-surface-muted)' }}><ImageIcon /></div>}
              <div>
                <strong>{p.title}</strong>
                <small className="qs-muted">{[p.city, p.systemPowerKw ? kw(Number(p.systemPowerKw)) : null, p.completedAt ? formatDate(p.completedAt) : null].filter(Boolean).join(' · ')}</small>
                <div className="qs-page__actions">
                  {p.installationId && <Badge tone="success"><BadgeCheck size={12} /> {t('Tasdiqlangan montaj')}</Badge>}
                  {!p.published && <Badge tone="neutral">{t('Yashirin')}</Badge>}
                </div>
                {can('portfolio.write') && <div className="qs-page__actions"><Button size="sm" variant="secondary" onClick={() => setEdit(p)}>{t('Tahrirlash')}</Button><Button size="sm" variant="ghost" aria-label={t('O‘chirish')} onClick={() => setRemove(p)}><Trash2 size={14} /></Button></div>}
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && <ProjectForm shopId={shopId} project={edit === 'new' ? null : edit} installations={list.data?.confirmedInstallations ?? []} onClose={() => setEdit(null)} />}
      <ConfirmDialog open={!!remove} title={t('Loyihani o‘chirish')} description={remove?.title ?? ''} tone="danger" confirmLabel={t('O‘chirish')} loading={del.isPending} onConfirm={() => remove && del.mutate(remove.id)} onCancel={() => setRemove(null)} />
    </div>
  );
}

/** U11.13: vidjet konfiguratori — domenlar, rang (kontrast), til, sarlavha; jonli preview va embed kod. */
export function WidgetPage() {
  const { shopId } = useCurrentShop();
  const queryClient = useQueryClient();
  const cfg = useQuery({ queryKey: ['widget', shopId], queryFn: () => m7Service.widget(shopId!), enabled: !!shopId });
  const [domains, setDomains] = useState('');
  const [theme, setTheme] = useState({ primaryColor: '#1d4ed8', title: '', lang: 'uz' as 'uz' | 'oz' | 'ru' | 'en' });
  const [active, setActive] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [copied, setCopied] = useState(false);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    if (!cfg.data) return;
    setDomains(cfg.data.allowedDomains.join('\n'));
    setTheme({ primaryColor: cfg.data.theme.primaryColor, title: cfg.data.theme.title, lang: cfg.data.theme.lang });
    setActive(cfg.data.active);
  }, [cfg.data]);
  const save = useMutation({
    mutationFn: () => m7Service.saveWidget(shopId!, { allowedDomains: domains.split(/[\n,]/).map((d) => d.trim()).filter(Boolean), active, theme }),
    onSuccess: (d) => { queryClient.setQueryData(['widget', shopId], d); setRev((r) => r + 1); },
  });
  if (!shopId || cfg.isLoading) return <PageLoader />;
  if (cfg.isError || !cfg.data) return <ErrorState error={cfg.error} onRetry={() => void cfg.refetch()} />;
  const c = cfg.data;
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Vidjet')}</h1><p>{t('Saytingizga Tez hisob kalkulyatorini qo‘ying — so‘rovlar to‘g‘ridan-to‘g‘ri sizga keladi.')}</p></div><div className="qs-page__actions"><Badge tone={c.active ? 'success' : 'neutral'}>{c.active ? t('Faol') : t('O‘chirilgan')}</Badge></div></div>
      <div className="qs-widget-layout">
        <section className="qs-card qs-form">
          <Textarea label={t('Ruxsat etilgan domenlar (har qatorda bittasi)')} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="example.uz" />
          <small className="qs-muted">{t('Vidjet faqat shu saytlarda ochiladi (CSP frame-ancestors).')}</small>
          <div className="qs-page__actions">
            <input className="qs-swatch" type="color" aria-label={t('Asosiy rang')} value={theme.primaryColor} onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })} />
            <Input label={t('Asosiy rang')} value={theme.primaryColor} onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })} />
          </div>
          {!c.contrast.ok && <Alert tone="warning">{t('Oq matn bilan kontrast {r}:1 (kamida 4,5:1 kerak). Vidjetda yaqin mos rang ishlatiladi:', { r: c.contrast.ratio })} <Button variant="link" onClick={() => setTheme({ ...theme, primaryColor: c.contrast.suggestion! })}>{c.contrast.suggestion}</Button></Alert>}
          <Input label={t('Sarlavha')} value={theme.title} maxLength={80} onChange={(e) => setTheme({ ...theme, title: e.target.value })} />
          <label className="gm-field__label" htmlFor="wlang">{t('Til')}</label>
          <SelectMenu id="wlang" className="qs-select" value={theme.lang} onChange={(e) => setTheme({ ...theme, lang: e.target.value as 'uz' | 'oz' | 'ru' | 'en' })}><option value="uz">O‘zbekcha</option><option value="oz">Ўзбекча</option><option value="ru">Русский</option><option value="en">English</option></SelectMenu>
          <label className="qs-check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t('Vidjet faol')}</label>
          {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
          {save.isSuccess && <Alert tone="success">{t('Saqlandi')}</Alert>}
          <div className="qs-form__actions"><Button loading={save.isPending} onClick={() => save.mutate()}>{t('Saqlash')}</Button></div>
        </section>
        <section className="qs-page qs-gap-3">
          <TabBar variant="tabs" role="tablist">
            <Tab role="tab" aria-selected={device === 'desktop'} onClick={() => setDevice('desktop')} selected={device === 'desktop'}><Monitor size={15} /> Desktop</Tab>
            <Tab role="tab" aria-selected={device === 'mobile'} onClick={() => setDevice('mobile')} selected={device === 'mobile'}><Smartphone size={15} /> {t('Mobil')}</Tab>
          </TabBar>
          <div className={cx('qs-widget-preview', device === 'mobile' && 'is-mobile')}><iframe key={rev} src={c.frameUrl} title={t('Vidjet preview')} /></div>
          <div className="qs-card">
            <header><h2>{t('Embed kodi')}</h2><Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(c.embed); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}><Copy size={14} /> {copied ? t('Nusxalandi') : t('Nusxalash')}</Button></header>
            <code className="qs-code">{c.embed}</code>
            <ol className="qs-list qs-mt-3">
              <li>{t('Yuqorida saytingiz domenini qo‘shing va «Vidjet faol» ni yoqing.')}</li>
              <li>{t('Kodni sahifa HTML’ida vidjet chiqishi kerak bo‘lgan joyga qo‘ying.')}</li>
              <li>{t('Mijoz natijadan keyin telefonini tasdiqlab, faqat sizga so‘rov yuboradi.')}</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}

/** U11.14: analitika — davr (max 366 kun), ko‘rishlar/so‘rovlar, voronka, mahsulotlar, hududlar; CSV; har grafikka jadval. */
export function AnalyticsPage() {
  const { shopId } = useCurrentShop();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [tables, setTables] = useState(false);
  const a = useQuery({ queryKey: ['shop-analytics', shopId, from, to], queryFn: () => m7Service.shopAnalytics(shopId!, `${from}T00:00:00+05:00`, `${to}T23:59:59+05:00`), enabled: !!shopId });
  // Davrdagi har kun (bo‘sh kunlar nol bilan) — bitta kun butun kenglikni egallamasin.
  const days = useMemo(() => {
    const out: Array<{ day: string; views: number; requests: number }> = [];
    const byDay = new Map((a.data?.daily ?? []).map((d) => [d.day, d]));
    for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`) && out.length < 367; d = new Date(d.getTime() + 86_400_000)) {
      const k = d.toISOString().slice(0, 10);
      out.push({ day: k, views: byDay.get(k)?.views ?? 0, requests: byDay.get(k)?.requests ?? 0 });
    }
    return out;
  }, [a.data, from, to]);
  const maxDaily = useMemo(() => Math.max(1, ...days.map((d) => d.requests)), [days]);
  if (!shopId) return <PageLoader />;
  const x = a.data;
  const FUNNEL: Record<string, string> = { REQUESTS: t('So‘rovlar'), VIEWED: t('Ko‘rilgan'), QUOTED: t('Taklif yuborilgan'), SELECTED: t('Tanlangan'), INSTALLED: t('Montaj tasdiqlangan') };
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Analitika')}</h1></div>
        <div className="qs-page__actions">
          <input className="qs-input-sm" type="date" aria-label={t('Dan')} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <input className="qs-input-sm" type="date" aria-label={t('Gacha')} value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          <Button variant="secondary" onClick={() => void m7Service.shopAnalyticsCsv(shopId, `${from}T00:00:00+05:00`, `${to}T23:59:59+05:00`)}><Download size={15} /> CSV</Button>
          <label className="qs-check"><input type="checkbox" checked={tables} onChange={(e) => setTables(e.target.checked)} /> {t('Jadval ko‘rinishi')}</label>
        </div>
      </div>
      {a.isError && <Alert tone="danger">{getErrorMessage(a.error)}</Alert>}
      {a.isLoading || !x ? <PageLoader variant="list" /> : (
        <>
          <div className="qs-kpi-grid">
            <div className="qs-kpi"><small>{t('Ko‘rishlar')}</small><strong>{x.totals.views}</strong></div>
            <div className="qs-kpi"><small>{t('So‘rovlar')}</small><strong>{x.totals.requests}</strong>{x.totals.widgetRequests > 0 && <small>{t('vidjetdan: {n}', { n: x.totals.widgetRequests })}</small>}</div>
            <div className="qs-kpi"><small>{t('Javob vaqti (median)')}</small><strong>{minutes(x.totals.medianResponseMinutes)}</strong></div>
            <div className="qs-kpi"><small>{t('Takliflar → tanlangan')}</small><strong>{x.totals.quotesSent} → {x.totals.selected}</strong></div>
            <div className="qs-kpi"><small>{t('Muammosiz qabul')}</small><strong>{share(x.totals.cleanAcceptanceShare)}</strong></div>
          </div>
          <section className="qs-card">
            <h2>{t('So‘rovlar kunlar bo‘yicha')}</h2>
            {!x.daily.length ? <p className="qs-muted">{t('Bu davrda ma’lumot yo‘q')}</p> : tables ? (
              <div tabIndex={0} role="region" aria-label={t('Jadval')} className="qs-table-wrap"><table className="qs-table"><thead><tr><th>{t('Kun')}</th><th className="qs-right">{t('Ko‘rishlar')}</th><th className="qs-right">{t('So‘rovlar')}</th><th className="qs-right">{t('Javob vaqti')}</th></tr></thead><tbody>{x.daily.map((d) => <tr key={d.day}><td>{d.day}</td><td className="qs-right qs-num">{d.views}</td><td className="qs-right qs-num">{d.requests}</td><td className="qs-right qs-num">{minutes(d.medianResponseMinutes === null ? null : Math.round(d.medianResponseMinutes))}</td></tr>)}</tbody></table></div>
            ) : (
              <div className="qs-vbars" role="img" aria-label={t('So‘rovlar kunlar bo‘yicha')}>{days.map((d) => <span key={d.day} title={`${d.day}: ${d.requests} ${t('so‘rov')}, ${d.views} ${t('ko‘rish')}`} style={{ height: d.requests ? `${(d.requests / maxDaily) * 100}%` : '1px' }} />)}</div>
            )}
          </section>
          <div className="qs-grid-2 qs-grid-top">
            <section className="qs-card">
              <h2>{t('Voronka')}</h2>
              <div className="qs-hbars">{x.funnel.map((f) => <div key={f.step} className="qs-hbar"><span>{FUNNEL[f.step] ?? f.step}</span><div><span style={{ width: `${x.funnel[0]!.count ? (f.count / x.funnel[0]!.count) * 100 : 0}%` }} /></div><strong>{f.count}</strong></div>)}</div>
            </section>
            <section className="qs-card">
              <h2>{t('Hududlar')}</h2>
              {!x.regions.length ? <p className="qs-muted">—</p> : <div className="qs-hbars">{x.regions.map((r) => <div key={r.regionCode} className="qs-hbar"><span>{regionName(r.regionCode)}</span><div><span style={{ width: `${(r.count / x.regions[0]!.count) * 100}%` }} /></div><strong>{r.count}</strong></div>)}</div>}
            </section>
          </div>
          <section className="qs-card">
            <h2>{t('Mahsulotlar bo‘yicha ko‘rishlar')}</h2>
            {!x.products.length ? <p className="qs-muted">{t('Bu davrda ma’lumot yo‘q')}</p> : <div className="qs-hbars">{x.products.map((p) => <div key={p.productModelId} className="qs-hbar"><span>{p.name}</span><div><span style={{ width: `${(p.views / x.products[0]!.views) * 100}%` }} /></div><strong>{p.views}</strong></div>)}</div>}
          </section>
          <p className="qs-muted" style={{ fontSize: 12.5 }}><AlertTriangle size={12} /> {t('Davr 366 kundan oshmaydi. Yangilangan: {d}', { d: formatDateTime(new Date().toISOString()) })}</p>
        </>
      )}
    </div>
  );
}
