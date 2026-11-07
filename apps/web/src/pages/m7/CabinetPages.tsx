import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BellRing, Calculator, CalendarClock, CheckCircle2, ClipboardList, Download, MessageCircle, Plus, Sun, Zap } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { kw, monthShort, SYSTEM_TYPE, sumShort } from '@/features/calc/labels';
import type { SystemType } from '@/features/calc/types';
import { dealsService } from '@/features/deals/deals.service';
import { m7Service } from '@/features/m7/m7.service';
import type { Reminder, SystemDetail } from '@/features/m7/types';
import { useMe } from '@/features/session/hooks/useMe';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatNumber } from '@/lib/format';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/deals/deals.css';
import '@/features/m7/m7.css';

const REMINDER_LABEL: Record<Reminder['type'], string> = { CLEANING: t('Panellarni tozalash'), INSPECTION: t('Yillik ko‘rik'), WARRANTY_EXPIRY: t('Kafolat tugashi') };
const n0 = (v: number) => formatNumber(Math.round(v));
const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`;

/** U10.1: mijoz bosh paneli — avval kutilayotgan amallar. */
export function CustomerDashboardPage() {
  const me = useMe();
  const d = useQuery({ queryKey: ['customer-dashboard'], queryFn: m7Service.customerDashboard });
  if (d.isLoading) return <PageLoader />;
  if (d.isError || !d.data) return <Alert tone="danger">{getErrorMessage(d.error)}</Alert>;
  const x = d.data;
  const hour = new Date().getHours();
  const hello = hour < 11 ? t('Xayrli tong') : hour < 18 ? t('Xayrli kun') : t('Xayrli kech');
  const actionLink = (a: (typeof x.actions)[number]) =>
    a.kind === 'QUOTE' ? { to: `/mijoz/takliflar/${a.id}`, text: t('{s} taklif yubordi — ko‘ring', { s: a.title ?? '' }), button: t('Ko‘rish') }
    : a.kind === 'ACCEPT_INSTALLATION' ? { to: `/mijoz/montajlar/${a.id}`, text: t('{s}: montajni qabul qiling', { s: a.title ?? '' }), button: t('Chek-list') }
    : a.kind === 'SITE_VISIT' ? { to: `/mijoz/chat/${a.id}`, text: t('{s} o‘lchov vaqtini taklif qildi', { s: a.title ?? '' }), button: t('Vaqt tanlash') }
    : { to: `/mijoz/tizimim/${a.id}`, text: t('{p} oyi ishlab chiqarishini kiriting', { p: a.period ?? '' }), button: t('Kiritish') };
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1><Sun size={24} color="var(--qs-color-accent)" /> {hello}{me.data?.firstName ? `, ${me.data.firstName}` : ''}!</h1></div></div>
      {x.empty ? (
        <EmptyState icon={<Calculator size={30} />} title={t('Birinchi hisobingizni qiling')} description={t('Manzil va oylik sarfingiz bo‘yicha quvvat, narx va tejashni 1–2 daqiqada bilib oling.')} action={<Link className="gm-button gm-button--primary gm-button--md" to="/mijoz/kalkulyator">{t('Hisoblash')}</Link>} />
      ) : (
        <>
          <section className="qs-card">
            <h2>{t('Sizdan kutilayotgan amallar')}</h2>
            {!x.actions.length ? <p className="qs-muted qs-line"><CheckCircle2 size={15} /> {t('Hozircha hammasi joyida.')}</p> : (
              <div className="qs-req-list">
                {x.actions.map((a) => { const l = actionLink(a); return <div key={`${a.kind}-${a.id}`} className="qs-pick"><span>{l.text}</span><Link className="gm-button gm-button--primary gm-button--sm" to={l.to}>{l.button}</Link></div>; })}
              </div>
            )}
          </section>
          <div className="qs-grid-2">
            <section className="qs-card">
              <header><h2>{t('Ochiq so‘rovlar')}</h2><Link to="/mijoz/sorovlar">{t('Hammasi')}</Link></header>
              {!x.openRequests.length ? (
                <div className="qs-mini-empty"><p className="qs-muted">{t('Ochiq so‘rov yo‘q. Hisob natijasidan do‘konlarga so‘rov yuborib, narx takliflarini oling.')}</p><Link className="gm-button gm-button--secondary gm-button--sm" to="/mijoz/hisoblar">{t('Hisoblarimdan so‘rov yuborish')}</Link></div>
              ) : x.openRequests.map((r) => <p key={r.id} className="qs-line"><Link to={`/mijoz/sorovlar/${r.id}`}>№{r.number} · {r.title}</Link> <Badge tone={r.quotes ? 'success' : 'neutral'}>{t('{n} ta taklif', { n: r.quotes })}</Badge></p>)}
            </section>
            <section className="qs-card">
              <header><h2>{t('Oxirgi hisoblar')}</h2><Link to="/mijoz/hisoblar">{t('Hammasi')}</Link></header>
              {x.calculations.map((c) => <p key={c.id} className="qs-line"><Link to={`/mijoz/natija/${c.id}`}>{c.title || formatDate(c.createdAt)}</Link> <small className="qs-muted">{c.systemPowerKw ? kw(c.systemPowerKw) : ''}{c.monthlySaving !== null ? ` · ${t('oyiga {s}', { s: sumShort(c.monthlySaving) })}` : ''}</small></p>)}
            </section>
          </div>
          {x.system && (
            <section className="qs-card">
              <header><h2><Zap size={17} /> {x.system.title ?? t('O‘rnatilgan tizim')}</h2><Link to={`/mijoz/tizimim/${x.system.id}`}>{t('Ochish')}</Link></header>
              <div className="qs-kpi-grid">
                <div className="qs-kpi"><small>{t('Quvvat')}</small><strong>{kw(Number(x.system.systemPowerKw))}</strong></div>
                <div className="qs-kpi"><small>{t('Bu oy prognozi')}</small><strong>{x.system.expectedThisMonthKwh ? `${n0(x.system.expectedThisMonthKwh)} kWh` : <span className="qs-muted qs-kpi-note">{t('Ma’lumot yo‘q')}</span>}</strong></div>
                <div className="qs-kpi"><small>{t('Oxirgi kiritilgan')}</small>{x.system.lastReading ? <><strong>{`${n0(x.system.lastReading.generatedKwh)} kWh`}</strong><small>{x.system.lastReading.period}</small></> : <Link to={`/mijoz/tizimim/${x.system.id}`} className="qs-kpi-cta">{t('Ko‘rsatkichni kiriting')}</Link>}</div>
              </div>
            </section>
          )}
          {!!x.reminders.length && (
            <section className="qs-card">
              <h2><BellRing size={17} /> {t('Yaqin eslatmalar')}</h2>
              {x.reminders.map((r) => <p key={r.id} style={{ margin: '6px 0' }}><Link to={`/mijoz/tizimim/${r.installedSystemId}`}>{REMINDER_LABEL[r.type]}</Link> · {formatDate(r.nextAt)}</p>)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Platformadan tashqari o‘rnatilgan tizimni qo‘shish. */
function AddSystemModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ title: '', power: '', type: 'ON_GRID' as SystemType, date: '', eqMonths: '', instMonths: '' });
  const add = useMutation({
    mutationFn: () => m7Service.addSystem({
      title: f.title.trim(), systemPowerKw: Number(f.power.replace(',', '.')), systemType: f.type, installedAt: f.date,
      warranties: [...(f.eqMonths ? [{ component: t('Uskuna'), months: Number(f.eqMonths) }] : []), ...(f.instMonths ? [{ component: t('Montaj'), months: Number(f.instMonths) }] : [])],
    }),
    onSuccess: (s) => { onClose(); navigate(`/mijoz/tizimim/${s.id}`); },
  });
  return (
    <Modal open={open} onClose={onClose} title={t('Tizim qo‘shish')} footer={<Button disabled={!f.title.trim() || !f.power || !f.date} loading={add.isPending} onClick={() => add.mutate()}>{t('Saqlash')}</Button>}>
      <div className="qs-form">
        <p className="qs-muted" style={{ margin: 0 }}>{t('Platformadan tashqarida o‘rnatilgan tizimni qo‘shib, ishlab chiqarish va eslatmalarni kuzating.')}</p>
        <Input label={t('Nomi')} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t('Masalan: Uy tomi')} />
        <div className="qs-form__row">
          <Input label={t('Quvvat')} suffix={t('kVt')} inputMode="decimal" value={f.power} onChange={(e) => setF({ ...f, power: e.target.value.replace(/[^\d.,]/g, '') })} />
          <Input label={t('O‘rnatilgan sana')} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </div>
        <div className="qs-segment" role="radiogroup" aria-label={t('Tizim turi')}>
          {(['ON_GRID', 'HYBRID', 'OFF_GRID'] as SystemType[]).map((st) => <button key={st} type="button" role="radio" aria-checked={f.type === st} className={cx(f.type === st && 'is-on')} onClick={() => setF({ ...f, type: st })}>{SYSTEM_TYPE[st].title}</button>)}
        </div>
        <div className="qs-form__row">
          <Input label={t('Uskuna kafolati')} suffix={t('oy')} inputMode="numeric" value={f.eqMonths} onChange={(e) => setF({ ...f, eqMonths: e.target.value.replace(/\D/g, '') })} />
          <Input label={t('Montaj kafolati')} suffix={t('oy')} inputMode="numeric" value={f.instMonths} onChange={(e) => setF({ ...f, instMonths: e.target.value.replace(/\D/g, '') })} />
        </div>
        {add.isError && <Alert tone="danger">{getErrorMessage(add.error)}</Alert>}
      </div>
    </Modal>
  );
}

export function SystemsPage() {
  const [open, setOpen] = useState(false);
  const list = useQuery({ queryKey: ['systems'], queryFn: m7Service.systems });
  if (list.isLoading) return <PageLoader />;
  if (list.isError) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('O‘rnatilgan tizimlar')}</h1><p>{t('Ishlab chiqarish, kafolatlar va xizmat eslatmalari.')}</p></div><div className="qs-page__actions"><Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} /> {t('Tizim qo‘shish')}</Button></div></div>
      {!list.data?.length ? <EmptyState icon={<Zap size={30} />} title={t('Hali tizim yo‘q')} description={t('Montaj qabul qilingach, tizim shu yerda paydo bo‘ladi. Boshqa joyda o‘rnatilgan tizimni qo‘lda qo‘shishingiz mumkin.')} /> : (
        <div className="qs-req-list">
          {list.data.map((s) => (
            <Link key={s.id} to={`/mijoz/tizimim/${s.id}`} className="qs-req-card">
              <div><h3>{s.title ?? s.shop?.name ?? t('Tizim')}</h3><div className="qs-req-card__meta"><span>{kw(Number(s.systemPowerKw))} · {SYSTEM_TYPE[s.systemType].title}</span><span>{t('O‘rnatilgan: {d}', { d: formatDate(s.installedAt) })}</span>{s.shop && <span>{s.shop.name}</span>}</div></div>
              <div className="qs-req-card__side">
                {s.lastReading?.deviation != null && Math.abs(s.lastReading.deviation) > 0.2 && <Badge tone="warning"><AlertTriangle size={12} /> {pct(s.lastReading.deviation)}</Badge>}
                {s.nextReminder && <small className="qs-muted">{REMINDER_LABEL[s.nextReminder.type]} · {formatDate(s.nextReminder.nextAt)}</small>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <AddSystemModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

/** Oxirgi 12 oy: prognoz (soya band) va haqiqiy (nuqta). Jadval muqobili bilan. */
function ProductionChart({ s }: { s: SystemDetail }) {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1));
      const period = d.toISOString().slice(0, 7);
      const reading = s.readings.find((r) => r.period === period);
      return { period, month: d.getUTCMonth() + 1, expected: s.expectedMonthlyKwh?.[d.getUTCMonth()] ?? null, actual: reading?.generatedKwh ?? null, alert: reading?.alert ?? false };
    });
  }, [s]);
  const max = Math.max(1, ...months.map((m) => Math.max(m.expected ?? 0, m.actual ?? 0)));
  const [table, setTable] = useState(false);
  return (
    <>
      <div className="qs-prod-chart" role="img" aria-label={t('Oylik ishlab chiqarish: prognoz va haqiqiy')}>
        {months.map((m) => (
          <div key={m.period} title={`${m.period}: ${t('prognoz')} ${m.expected ?? '—'} kWh, ${t('haqiqiy')} ${m.actual ?? '—'} kWh`}>
            {m.expected !== null && <span className="band" style={{ height: `${(m.expected / max) * 100}%` }} />}
            {m.actual !== null && <span className={cx('dot', m.alert && 'is-alert')} style={{ bottom: `${(m.actual / max) * 100}%` }} />}
            <small>{monthShort(m.month)}</small>
          </div>
        ))}
      </div>
      <div className="qs-prod-legend"><span><i /> {t('Prognoz')}</span><span><i className="dot" /> {t('Kiritilgan')}</span><button type="button" className="gm-link" onClick={() => setTable(!table)}>{table ? t('Jadvalni yashirish') : t('Jadval ko‘rinishi')}</button></div>
      {table && (
        <div className="qs-table-wrap" style={{ marginTop: 10 }}>
          <table className="qs-table"><thead><tr><th>{t('Oy')}</th><th className="qs-right">{t('Prognoz, kWh')}</th><th className="qs-right">{t('Haqiqiy, kWh')}</th></tr></thead>
            <tbody>{months.map((m) => <tr key={m.period}><td>{m.period}</td><td className="qs-right qs-num">{m.expected === null ? '—' : n0(m.expected)}</td><td className="qs-right qs-num">{m.actual === null ? '—' : n0(m.actual)}</td></tr>)}</tbody></table>
        </div>
      )}
    </>
  );
}

/** U10.5: o‘rnatilgan tizim. */
export function SystemPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const s = useQuery({ queryKey: ['system', id], queryFn: () => m7Service.system(id) });
  const lastMonth = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const [period, setPeriod] = useState(lastMonth);
  const [mode, setMode] = useState<'kwh' | 'meter'>('kwh');
  const [value, setValue] = useState('');
  const add = useMutation({
    mutationFn: () => m7Service.addReading(id, { period, ...(mode === 'kwh' ? { generatedKwh: Number(value.replace(',', '.')) } : { meterReading: Number(value.replace(',', '.')) }) }),
    onSuccess: (r) => { queryClient.setQueryData(['system', id], r.system); setValue(''); },
  });
  const rem = useMutation({ mutationFn: ({ rid, action }: { rid: string; action: 'DONE' | 'SNOOZE' | 'DISABLE' | 'ENABLE' }) => m7Service.reminder(id, rid, action), onSuccess: () => void s.refetch() });
  if (s.isLoading) return <PageLoader />;
  if (s.isError || !s.data) return <Alert tone="danger">{getErrorMessage(s.error)}</Alert>;
  const x = s.data;
  const lastAlert = [...x.readings].reverse().find((r) => r.alert);
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{x.title ?? x.shop?.name ?? t('O‘rnatilgan tizim')}</h1><p>{kw(Number(x.systemPowerKw))} · {SYSTEM_TYPE[x.systemType].title} · {t('O‘rnatilgan: {d}', { d: formatDate(x.installedAt) })}{x.shop ? ` · ${x.shop.name}` : ''}</p></div>
        <div className="qs-page__actions">{x.requestShopId && <Link className="gm-button gm-button--secondary gm-button--md" to={`/mijoz/chat/${x.requestShopId}`}><MessageCircle size={16} /> {t('Do‘konga yozish')}</Link>}</div>
      </div>
      {lastAlert && lastAlert.deviation !== null && (
        <Alert tone="warning" title={t('{p}: ishlab chiqarish prognozdan {d} farq qildi', { p: lastAlert.period, d: pct(lastAlert.deviation) })}>
          {t('Sabablari: chang, yangi soya, invertor xatosi yoki bulutli havo.')} <Link to="/mijoz/bilim/xizmat-korsatish/ishlab-chiqarish-kamaysa">{t('Nima qilish kerak')}</Link>
        </Alert>
      )}
      <section className="qs-card">
        <h2>{t('Ishlab chiqarish')}</h2>
        {x.expectedMonthlyKwh ? <ProductionChart s={x} /> : <p className="qs-muted">{t('Bu tizim uchun prognoz yo‘q — kiritilgan ko‘rsatkichlar jadvalda ko‘rinadi.')}</p>}
        <div className="qs-form" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0 }}>{t('Oy ko‘rsatkichini kiritish')}</h3>
          <div className="qs-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'kwh'} className={cx(mode === 'kwh' && 'is-on')} onClick={() => setMode('kwh')}>{t('Ishlab chiqarilgan kWh')}</button>
            <button type="button" role="tab" aria-selected={mode === 'meter'} className={cx(mode === 'meter' && 'is-on')} onClick={() => setMode('meter')}>{t('Hisoblagich ko‘rsatkichi')}</button>
          </div>
          <div className="qs-form__row" style={{ alignItems: 'end' }}>
            <Input label={t('Oy')} type="month" value={period} max={new Date().toISOString().slice(0, 7)} onChange={(e) => setPeriod(e.target.value)} />
            <Input label={mode === 'kwh' ? 'kWh' : t('Ko‘rsatkich')} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))} />
            <Button disabled={!value} loading={add.isPending} onClick={() => add.mutate()}>{t('Saqlash')}</Button>
          </div>
          {add.isError && <Alert tone="danger">{getErrorMessage(add.error)}</Alert>}
          {add.data && <Alert tone={add.data.reading.alert ? 'warning' : 'success'}>{add.data.reading.expectedKwh ? t('{a} kWh · prognoz {e} kWh ({d})', { a: n0(add.data.reading.generatedKwh), e: n0(add.data.reading.expectedKwh), d: pct(add.data.reading.deviation ?? 0) }) : t('Saqlandi: {a} kWh', { a: n0(add.data.reading.generatedKwh) })}</Alert>}
        </div>
      </section>
      <div className="qs-grid-2 qs-grid-top">
        <section className="qs-card">
          <h2>{t('Komponentlar va kafolatlar')}</h2>
          {x.components.length > 0 && <ul className="qs-list">{x.components.map((c, i) => <li key={i}>{c.title} × {c.quantity}</li>)}</ul>}
          {x.warranties.map((w) => (
            <div key={w.id} style={{ margin: '10px 0' }}>
              <div className="qs-page__actions" style={{ justifyContent: 'space-between' }}><strong>{w.component}</strong><small className={cx(w.expiringSoon ? 'qs-sla is-risk' : 'qs-muted')}>{w.daysLeft > 0 ? t('{n} kun qoldi · {d}', { n: w.daysLeft, d: formatDate(w.endsAt) }) : t('Tugagan')}</small></div>
              <div className={cx('qs-warranty-bar', w.expiringSoon && 'is-soon')}><span style={{ width: `${Math.max(0, Math.min(100, (w.daysLeft / (w.months * 30.4)) * 100))}%` }} /></div>
            </div>
          ))}
          {!x.warranties.length && <p className="qs-muted">{t('Kafolat ma’lumoti yo‘q')}</p>}
        </section>
        <section className="qs-card">
          <h2><CalendarClock size={17} /> {t('Eslatmalar')}</h2>
          {x.reminders.map((r) => (
            <div key={r.id} className="qs-pick" style={{ marginBottom: 8, opacity: r.active ? 1 : 0.55 }}>
              <div><strong>{REMINDER_LABEL[r.type]}</strong><small>{r.active ? formatDate(r.nextAt) : t('O‘chirilgan')}{r.intervalDays ? ` · ${t('har {n} kun', { n: r.intervalDays })}` : ''}</small></div>
              <div className="qs-page__actions">
                {r.active ? <>
                  <Button size="sm" variant="secondary" onClick={() => rem.mutate({ rid: r.id, action: 'DONE' })}>{t('Bajarildi')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => rem.mutate({ rid: r.id, action: 'SNOOZE' })}>{t('7 kunga surish')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => rem.mutate({ rid: r.id, action: 'DISABLE' })}>{t('O‘chirish')}</Button>
                </> : <Button size="sm" variant="ghost" onClick={() => rem.mutate({ rid: r.id, action: 'ENABLE' })}>{t('Yoqish')}</Button>}
              </div>
            </div>
          ))}
        </section>
      </div>
      <section className="qs-card">
        <h2><ClipboardList size={17} /> {t('Hujjatlar')}</h2>
        <div className="qs-page__actions">
          {x.quoteId && <Button variant="secondary" onClick={() => void dealsService.quotePdf(x.quoteId!, 'uz', 0)}><Download size={15} /> {t('Taklif PDF')}</Button>}
          {x.installationId && <Link className="gm-button gm-button--secondary gm-button--md" to={`/mijoz/montajlar/${x.installationId}`}>{t('Montaj va chek-list')}</Link>}
          {!x.quoteId && !x.installationId && <p className="qs-muted" style={{ margin: 0 }}>{t('Qo‘lda qo‘shilgan tizim uchun hujjatlar yo‘q.')}</p>}
        </div>
        {x.checklist && <p className="qs-muted">{t('Chek-list: {ok} OK, {issue} muammo', { ok: x.checklist.filter((c) => c.status === 'OK').length, issue: x.checklist.filter((c) => c.status === 'ISSUE').length })}</p>}
      </section>
    </div>
  );
}
