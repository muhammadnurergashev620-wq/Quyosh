import { useCallback, useState } from 'react';
import type { DragEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Clock, FileText, Kanban, List, Lock, MapPin, Phone, StickyNote, XCircle } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { kw, SYSTEM_TYPE, sum, sumShort } from '@/features/calc/labels';
import { ChatPanel } from '@/features/deals/components/ChatPanel';
import { dealsService } from '@/features/deals/deals.service';
import { DECLINE_PRESETS, LEAD_STATUS, num, PIPELINE, QUOTE_STATUS } from '@/features/deals/labels';
import type { PipelineStage, RequestShopStatus, ShopLeadRow } from '@/features/deals/types';
import { useCurrentShop } from '@/features/shop/current-shop';
import { useShopMembers } from '@/features/shop/hooks';
import { REGIONS } from '@/lib/regions';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/deals/deals.css';
import { QuoteBuilder } from './QuoteBuilder';

const region = (code: string | null) => REGIONS.find((r) => r.code === code)?.name ?? null;
const TABS: Array<{ key: RequestShopStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: t('Barchasi') },
  { key: 'SENT', label: t('Yangi') },
  { key: 'VIEWED', label: t('Ko‘rilgan') },
  { key: 'CLARIFICATION_REQUESTED', label: t('Javob kutilmoqda') },
  { key: 'QUOTED', label: t('Taklif yuborilgan') },
  { key: 'SELECTED', label: t('Tanlangan') },
  { key: 'DECLINED', label: t('Rad etilgan') },
];
const STAGES: PipelineStage[] = ['NEW', 'CONTACTED', 'SITE_VISIT', 'PROPOSAL', 'WON', 'LOST'];

/** Javob vaqti taymeri: 24 soatdan oshsa diqqat toni (U11.3). */
function ResponseTimer({ row }: { row: ShopLeadRow }) {
  if (row.firstResponseAt) return null;
  const hours = (Date.now() - new Date(row.sentAt).getTime()) / 3_600_000;
  return <Badge tone={hours >= 24 ? 'warning' : 'neutral'}><Clock size={12} /> {formatRelativeTime(row.sentAt)}</Badge>;
}

function LeadCard({ row, onOpen, draggable, onDragStart, menu }: { row: ShopLeadRow; onOpen: () => void; draggable?: boolean; onDragStart?: (e: DragEvent) => void; menu?: React.ReactNode }) {
  const r = row.request;
  return (
    <article className="qs-req-card" draggable={draggable} onDragStart={onDragStart} style={{ cursor: 'pointer' }} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }} tabIndex={0} aria-label={t('So‘rov №{n}', { n: r.number })}>
      <div>
        <h3>{r.customerFirstName ?? t('Mijoz')} · №{r.number}</h3>
        <div className="qs-req-card__meta">
          {region(r.regionCode) && <span><MapPin size={12} /> {region(r.regionCode)}</span>}
          <span>{r.requiredCapacityKw ? `${kw(num(r.requiredCapacityKw))} · ` : ''}{SYSTEM_TYPE[r.systemType].title}</span>
          <span>{formatDateTime(row.sentAt)}</span>
          {row.assignedMember && <span>{t('Mas’ul: {n}', { n: row.assignedMember.name })}</span>}
        </div>
      </div>
      <div className="qs-req-card__side" onClick={(e) => e.stopPropagation()}>
        <Badge tone={LEAD_STATUS[row.status].tone}>{LEAD_STATUS[row.status].label}</Badge>
        <ResponseTimer row={row} />
        {row.unread > 0 && <span className="qs-unread">{row.unread}</span>}
        {row.quote && <small className="qs-muted">{sumShort(num(row.quote.total))}</small>}
        {menu}
      </div>
    </article>
  );
}

/** U11.3: kelgan so‘rovlar — ro‘yxat (status tablari) va pipeline (kanban). */
export function ShopRequestsPage({ quotedOnly = false }: { quotedOnly?: boolean }) {
  const { shopId, can } = useCurrentShop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const view = params.get('korinish') === 'pipeline' ? 'pipeline' : 'list';
  const [tab, setTab] = useState<RequestShopStatus | 'ALL'>(quotedOnly ? 'QUOTED' : 'ALL');
  const [mine, setMine] = useState(false);
  const list = useQuery({
    queryKey: ['shop-requests', shopId, view === 'list' ? tab : 'ALL', mine],
    queryFn: () => dealsService.shopRequests(shopId!, { status: view === 'list' && tab !== 'ALL' ? tab : undefined, assigned: mine ? 'mine' : undefined }),
    enabled: !!shopId,
    refetchInterval: 20_000,
  });
  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: PipelineStage }) => dealsService.updateLead(shopId!, id, { pipelineStage: stage }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shop-requests', shopId] }),
  });
  if (!shopId || list.isLoading) return <PageLoader />;
  if (list.isError) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  const items = list.data?.items ?? [];
  const open = (id: string) => navigate(`/dokon/sorovlar/${id}`);
  const canMove = can('requests.assign');
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{quotedOnly ? t('Takliflar') : t('So‘rovlar')}</h1><p>{t('Tez javob reytingingizni oshiradi: o‘rtacha javob vaqti profilingizda ko‘rinadi.')}</p></div>
        <div className="qs-page__actions">
          <label className="qs-check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {t('Faqat menga tayinlangan')}</label>
          <div className="qs-tabs" role="tablist" aria-label={t('Ko‘rinish')}>
            <button type="button" role="tab" aria-selected={view === 'list'} className={cx(view === 'list' && 'is-on')} onClick={() => setParams({})}><List size={15} /> {t('Ro‘yxat')}</button>
            <button type="button" role="tab" aria-selected={view === 'pipeline'} className={cx(view === 'pipeline' && 'is-on')} onClick={() => setParams({ korinish: 'pipeline' })}><Kanban size={15} /> {t('Pipeline')}</button>
          </div>
        </div>
      </div>
      {view === 'list' ? (
        <>
          <div className="qs-tabs" role="tablist">
            {TABS.map((tb) => <button key={tb.key} type="button" role="tab" aria-selected={tab === tb.key} className={cx(tab === tb.key && 'is-on')} onClick={() => setTab(tb.key)}>{tb.label}</button>)}
          </div>
          {!items.length ? (
            <EmptyState icon={<ClipboardList size={30} />} title={t('So‘rov yo‘q')} description={t('Xizmat hududingizni va katalogni to‘ldiring — mijozlar sizni xaritada va qidiruvda topadi.')} />
          ) : (
            <div className="qs-req-list">{items.map((row) => <LeadCard key={row.id} row={row} onOpen={() => open(row.id)} />)}</div>
          )}
        </>
      ) : (
        <div className="qs-kanban">
          {STAGES.map((stage) => (
            <section
              key={stage}
              className="qs-kanban__col"
              aria-label={PIPELINE[stage]}
              onDragOver={(e) => canMove && e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/plain');
                if (id && canMove) move.mutate({ id, stage });
              }}
            >
              <h2>{PIPELINE[stage]} <span>{items.filter((i) => i.pipelineStage === stage).length}</span></h2>
              {items.filter((i) => i.pipelineStage === stage).map((row) => (
                <LeadCard
                  key={row.id}
                  row={row}
                  onOpen={() => open(row.id)}
                  draggable={canMove}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', row.id)}
                  menu={canMove ? (
                    <select className="qs-select" style={{ height: 30, fontSize: 12.5 }} aria-label={t('Bosqich')} value={row.pipelineStage} onChange={(e) => move.mutate({ id: row.id, stage: e.target.value as PipelineStage })}>
                      {STAGES.map((s) => <option key={s} value={s}>{PIPELINE[s]}</option>)}
                    </select>
                  ) : undefined}
                />
              ))}
            </section>
          ))}
        </div>
      )}
      {move.isError && <Alert tone="danger">{getErrorMessage(move.error)}</Alert>}
    </div>
  );
}

/** U11.3: so‘rov sahifasi — chapda mijoz/hisob (kontakt siyosati), o‘rtada chat, o‘ngda amallar va ichki izohlar. */
export function ShopRequestDetailPage() {
  const { rsId = '' } = useParams();
  const { shopId, can } = useCurrentShop();
  const queryClient = useQueryClient();
  const lead = useQuery({ queryKey: ['shop-lead', shopId, rsId], queryFn: () => dealsService.shopRequest(shopId!, rsId), enabled: !!shopId, refetchInterval: 20_000 });
  const members = useShopMembers(shopId, can('requests.assign'));
  const [note, setNote] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [preset, setPreset] = useState(DECLINE_PRESETS[0]!);
  const [declineNote, setDeclineNote] = useState('');
  const [builder, setBuilder] = useState(false);
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['shop-lead', shopId, rsId] });
    void queryClient.invalidateQueries({ queryKey: ['shop-requests', shopId] });
  }, [queryClient, shopId, rsId]);
  const update = useMutation({ mutationFn: (body: Parameters<typeof dealsService.updateLead>[2]) => dealsService.updateLead(shopId!, rsId, body), onSuccess: refresh });
  const addNote = useMutation({ mutationFn: () => dealsService.addNote(shopId!, rsId, note.trim()), onSuccess: () => { setNote(''); refresh(); } });
  const decline = useMutation({ mutationFn: () => dealsService.decline(shopId!, rsId, [preset, declineNote.trim()].filter(Boolean).join(': ')), onSuccess: () => { setDeclineOpen(false); refresh(); } });
  if (!shopId || lead.isLoading) return <PageLoader />;
  if (lead.isError || !lead.data) return <Alert tone="danger">{getErrorMessage(lead.error)}</Alert>;
  const l = lead.data;
  const r = l.request;
  const openForQuote = r.status === 'OPEN' && ['SENT', 'VIEWED', 'CLARIFICATION_REQUESTED', 'QUOTED'].includes(l.status);
  const c = l.calculation;
  if (builder) return <QuoteBuilder lead={l} onClose={() => { setBuilder(false); refresh(); }} />;
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{l.customer.firstName ?? t('Mijoz')} · №{r.number}</h1><p>{region(r.regionCode) ?? t('Hudud ko‘rsatilmagan')} · {formatDateTime(l.sentAt)}</p></div>
        <div className="qs-page__actions">
          <Badge tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Badge>
          {l.quote ? (
            <Button variant="secondary" onClick={() => setBuilder(true)}><FileText size={15} /> {t('Taklif')} · {sumShort(num(l.quote.total))} <Badge tone={QUOTE_STATUS[l.quote.status].tone}>{QUOTE_STATUS[l.quote.status].label}</Badge></Button>
          ) : (
            openForQuote && can('quote.draft') && <Button onClick={() => setBuilder(true)}><FileText size={15} /> {t('Taklif tayyorlash')}</Button>
          )}
          {l.quote?.installation && <Link className="gm-button gm-button--secondary gm-button--md" to={`/dokon/montajlar/${l.quote.installation.id}`}>{t('Montaj')}</Link>}
          {['SENT', 'VIEWED', 'CLARIFICATION_REQUESTED'].includes(l.status) && <Button variant="ghost" onClick={() => setDeclineOpen(true)}><XCircle size={15} /> {t('Rad etish')}</Button>}
        </div>
      </div>
      <div className="qs-lead">
        <aside className="qs-page" style={{ gap: 'var(--qs-space-4)' }}>
          <div className="qs-card">
            <h2>{t('Mijoz')}</h2>
            {l.customer.revealed ? (
              <dl className="qs-dl">
                <div><dt>{t('Ism')}</dt><dd>{[l.customer.firstName, l.customer.lastName].filter(Boolean).join(' ')}</dd></div>
                <div><dt>{t('Telefon')}</dt><dd>{l.customer.phone ? <a href={`tel:${l.customer.phone}`}><Phone size={13} /> {l.customer.phone}</a> : '—'}</dd></div>
                {l.customer.email && <div><dt>Email</dt><dd>{l.customer.email}</dd></div>}
                {l.site?.address && <div><dt>{t('Manzil')}</dt><dd>{l.site.address}</dd></div>}
                {l.site?.location && <div><dt>{t('Xarita')}</dt><dd><a href={`https://www.google.com/maps?q=${l.site.location.lat},${l.site.location.lon}`} target="_blank" rel="noreferrer">{l.site.location.lat.toFixed(5)}, {l.site.location.lon.toFixed(5)}</a></dd></div>}
              </dl>
            ) : (
              <>
                <p style={{ margin: 0 }}><strong>{l.customer.firstName ?? t('Mijoz')}</strong></p>
                <p className="qs-lock"><Lock size={14} /> {t('Mijoz kontaktni hali ochmagan — yozishma orqali bog‘laning')}</p>
              </>
            )}
          </div>
          <div className="qs-card">
            <h2>{t('So‘rov')}</h2>
            <dl className="qs-dl">
              <div><dt>{t('Tizim')}</dt><dd>{SYSTEM_TYPE[r.systemType].title}{r.requiredCapacityKw ? ` · ${kw(num(r.requiredCapacityKw))}` : ''}</dd></div>
              <div><dt>{t('Ehtiyojlar')}</dt><dd>{[r.batteryNeeded && t('akkumulyator'), r.installationNeeded && t('montaj'), r.financingInterest && t('kredit')].filter(Boolean).join(', ') || '—'}</dd></div>
              {c?.annualLoadKwh != null && <div><dt>{t('Yillik iste’mol')}</dt><dd>{Math.round(c.annualLoadKwh).toLocaleString('ru-RU')} kWh</dd></div>}
              {(c?.usableAreaM2 ?? l.site?.usableAreaM2) ? <div><dt>{t('Foydali maydon')}</dt><dd>{Math.round(num(c?.usableAreaM2 ?? l.site?.usableAreaM2))} m²</dd></div> : null}
              {c?.systemPowerKw != null && <div><dt>{t('Hisob: quvvat')}</dt><dd>{kw(c.systemPowerKw)}{c.batteryKwh ? ` · ${c.batteryKwh} kWh` : ''}</dd></div>}
              {c?.initialCost != null && <div><dt>{t('Hisob: taxminiy narx')}</dt><dd>{sum(c.initialCost)}</dd></div>}
            </dl>
            {r.notes && <p style={{ marginBottom: 0 }}>«{r.notes}»</p>}
          </div>
        </aside>
        <ChatPanel
          rsId={l.id}
          side="SHOP"
          visits={l.siteVisits}
          onActivity={refresh}
          canWrite={can('messages.write')}
          canAsk={['SENT', 'VIEWED'].includes(l.status)}
          context={<><strong>{SYSTEM_TYPE[r.systemType].title}{r.requiredCapacityKw ? ` · ${kw(num(r.requiredCapacityKw))}` : ''}</strong><Badge tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Badge>{l.quote && <span>{t('Taklif')}: {sum(num(l.quote.total))}</span>}</>}
        />
        <aside className="qs-page" style={{ gap: 'var(--qs-space-4)' }}>
          <div className="qs-card">
            <h2>{t('Lead')}</h2>
            <div className="qs-form">
              <label className="gm-field__label" htmlFor="stage">{t('Bosqich')}</label>
              <select id="stage" className="qs-select" disabled={!can('requests.assign')} value={l.pipelineStage} onChange={(e) => update.mutate({ pipelineStage: e.target.value as PipelineStage })}>
                {STAGES.map((s) => <option key={s} value={s}>{PIPELINE[s]}</option>)}
              </select>
              <label className="gm-field__label" htmlFor="assignee">{t('Mas’ul xodim')}</label>
              <select id="assignee" className="qs-select" disabled={!can('requests.assign')} value={l.assignedMember?.id ?? ''} onChange={(e) => update.mutate(e.target.value ? { assignedMemberId: e.target.value } : { unassign: true })}>
                <option value="">{t('Tayinlanmagan')}</option>
                {(members.data?.members ?? []).map((m) => <option key={m.id} value={m.id}>{[m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.phone}</option>)}
                {l.assignedMember && !members.data && <option value={l.assignedMember.id}>{l.assignedMember.name}</option>}
              </select>
            </div>
          </div>
          <div className="qs-card qs-notes">
            <h2><StickyNote size={16} /> {t('Ichki izohlar')}</h2>
            <small className="qs-muted">{t('Faqat do‘kon xodimlariga ko‘rinadi.')}</small>
            {l.notes.map((n) => <p key={n.id} className="qs-note"><span>{n.body}</span><small>{n.author ?? ''} · {formatDateTime(n.createdAt)}</small></p>)}
            <Textarea label={t('Yangi izoh')} value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" disabled={!note.trim()} loading={addNote.isPending} onClick={() => addNote.mutate()}>{t('Saqlash')}</Button>
          </div>
        </aside>
      </div>
      {update.isError && <Alert tone="danger">{getErrorMessage(update.error)}</Alert>}
      <Modal open={declineOpen} onClose={() => setDeclineOpen(false)} title={t('So‘rovni rad etish')} footer={<Button variant="danger" loading={decline.isPending} onClick={() => decline.mutate()}>{t('Rad etish')}</Button>}>
        <div className="qs-form">
          <div className="qs-chips" role="radiogroup" aria-label={t('Sabab')}>
            {DECLINE_PRESETS.map((p) => <button key={p} type="button" role="radio" aria-checked={preset === p} className={cx('qs-chip', preset === p && 'is-on')} onClick={() => setPreset(p)}>{p}</button>)}
          </div>
          <Textarea label={t('Izoh (ixtiyoriy)')} value={declineNote} maxLength={800} onChange={(e) => setDeclineNote(e.target.value)} />
          <small className="qs-muted">{t('Sabab mijozga ko‘rinadi.')}</small>
          {decline.isError && <Alert tone="danger">{getErrorMessage(decline.error)}</Alert>}
        </div>
      </Modal>
    </div>
  );
}
