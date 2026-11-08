import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, FileText, Plus, Save } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonAnchor } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { m7Service } from '@/features/m7/m7.service';
import { Markdown } from '@/features/m7/Markdown';
import { tr } from '@/features/m7/i18n-text';
import type { ArticleType, CtaType, I18n } from '@/features/m7/types';
import { useMe } from '@/features/session/hooks/useMe';
import { REGIONS } from '@/lib/regions';
import { env } from '@/lib/env';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { t } from '@/i18n';
import { CATEGORY_LABEL, TICKET_STATUS } from './SupportPages';
import { TYPE_LABEL } from './KnowledgePages';
import '@/features/shop/shop.css';
import '@/features/m7/m7.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Tab, TabBar } from '@/components/ui/Tabs';

const QUEUE_LABEL: Record<string, string> = {
  models: t('ProductModel takliflari'), reviews: t('Moderatsiyadagi sharhlar'),
  complaints: t('Shikoyatlar'), disputes: t('E’tirozli montajlar'), support: t('Yordam murojaatlari'), tariffs: t('Muddati yaqin tariflar'),
};

/** U12.1: navbatlar — admin faqat o‘z huquqidagilarini ko‘radi; SLA buzilayotganlar qizil. */
export function AdminQueues() {
  const me = useMe();
  const q = useQuery({ queryKey: ['admin-queues'], queryFn: m7Service.adminQueues, refetchInterval: 60_000 });
  if (!q.data || !me.data) return null;
  const allowed = (p: string) => !!me.data!.isSuperAdmin || (me.data!.adminPermissions ?? []).includes(p);
  return (
    <section className="qs-mt-5">
      <h2>{t('Navbatlar')}</h2>
      <div className="qs-kpi-grid">
        {q.data.queues.filter((x) => allowed(x.permission)).map((x) => (
          <Link key={x.key} className="qs-kpi" to={x.to}>
            <small>{QUEUE_LABEL[x.key] ?? x.key}</small>
            <strong>{x.count}</strong>
            {!!x.breaching && <small className="qs-sla is-breach">{t('{n} ta SLA buzilgan', { n: x.breaching })}</small>}
          </Link>
        ))}
        {q.data.exchangeRate && <div className="qs-kpi"><small>{t('USD kursi (MB)')}</small><strong>{formatNumber(Math.round(Number(q.data.exchangeRate.rateToUzs)))}</strong><small className={cx(q.data.exchangeRate.stale && 'qs-sla is-breach')}>{formatDate(q.data.exchangeRate.rateDate)}{q.data.exchangeRate.stale ? ` · ${t('eskirgan')}` : ''}</small></div>}
      </div>
    </section>
  );
}

const dur = (m: number) => (m >= 60 ? t('{h} soat {m} daq', { h: Math.floor(m / 60), m: m % 60 }) : t('{n} daq', { n: m }));
const slaClass = (s?: string) => (s === 'BREACHED' ? 'is-breach' : s === 'AT_RISK' ? 'is-risk' : 'is-ok');

/** U12.9: yordam navbati — taymer (yashil → sariq 25 % → qizil), filtrlar. */
export function AdminSupportPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [assignee, setAssignee] = useState('');
  const [search, setSearch] = useState('');
  const list = useQuery({ queryKey: ['admin-tickets', status, assignee, search], queryFn: () => m7Service.adminTickets({ status: status || undefined, assignee: assignee || undefined, search: search || undefined }), refetchInterval: 30_000 });
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Yordam navbati')}</h1><p>{t('Birinchi javob muddati ish vaqti bo‘yicha (Du–Ju 09:00–18:00).')}</p></div></div>
      <div className="qs-page__actions">
        <SelectMenu className="qs-select" aria-label={t('Holat')} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t('Faol')}</option>{Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</SelectMenu>
        <SelectMenu className="qs-select" aria-label={t('Mas’ul')} value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">{t('Hammasi')}</option><option value="mine">{t('Menga')}</option><option value="unassigned">{t('Tayinlanmagan')}</option></SelectMenu>
        <input className="qs-input-sm" placeholder={t('Mavzu yoki SUP-raqam')} aria-label={t('Qidirish')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {list.isLoading ? <PageLoader /> : !list.data?.length ? <EmptyState icon={<FileText size={28} />} title={t('Murojaat yo‘q')} /> : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Raqam')}</th><th>{t('Mavzu')}</th><th>{t('Kategoriya')}</th><th>{t('Ustuvorlik')}</th><th>{t('Holat')}</th><th>{t('Birinchi javob')}</th></tr></thead>
            <tbody>
              {list.data.map((x) => (
                <tr key={x.id} className="is-clickable" onClick={() => navigate(`/admin/yordam/${x.id}`)}>
                  <td className="qs-mono">{x.code}</td>
                  <td>{x.subject}</td>
                  <td>{CATEGORY_LABEL[x.category] ?? x.category}</td>
                  <td><Badge tone={x.priority === 'URGENT' ? 'danger' : x.priority === 'HIGH' ? 'warning' : 'neutral'}>{x.priority}</Badge></td>
                  <td><StatusBadge map={TICKET_STATUS} status={x.status} /></td>
                  <td><span className={cx('qs-sla', slaClass(x.sla))}>{x.sla === 'MET' ? t('Javob berilgan') : x.minutesLeft !== null && x.minutesLeft !== undefined ? (x.minutesLeft < 0 ? t('{d} kechikdi', { d: dur(-x.minutesLeft) }) : t('{d} qoldi', { d: dur(x.minutesLeft) })) : '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminTicketPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const me = useMe();
  const tk = useQuery({ queryKey: ['admin-ticket', id], queryFn: () => m7Service.adminTicket(id), refetchInterval: 30_000 });
  const templates = useQuery({ queryKey: ['reply-templates'], queryFn: m7Service.templates });
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const set = (d: unknown) => { queryClient.setQueryData(['admin-ticket', id], d); void queryClient.invalidateQueries({ queryKey: ['admin-tickets'] }); };
  const reply = useMutation({ mutationFn: (status?: string) => m7Service.adminReply(id, { body: text.trim(), internal, status }), onSuccess: (d) => { set(d); setText(''); } });
  const update = useMutation({ mutationFn: (body: Record<string, unknown>) => m7Service.adminUpdateTicket(id, body), onSuccess: set });
  if (tk.isLoading) return <PageLoader />;
  if (tk.isError || !tk.data) return <Alert tone="danger">{getErrorMessage(tk.error)}</Alert>;
  const x = tk.data;
  const relatedLink = x.relatedType === 'Shop' ? `/admin/dokonlar/${x.relatedId}` : null;
  return (
    <div className="qs-page">
      <p><Link to="/admin/yordam">← {t('Yordam navbati')}</Link></p>
      <div className="qs-page__head">
        <div><h1>{x.code} · {x.subject}</h1><p>{CATEGORY_LABEL[x.category] ?? x.category} · {formatDateTime(x.createdAt)}</p></div>
        <div className="qs-page__actions">
          <SelectMenu className="qs-select" aria-label={t('Ustuvorlik')} value={x.priority} onChange={(e) => update.mutate({ priority: e.target.value })}>{['URGENT', 'HIGH', 'NORMAL'].map((p) => <option key={p}>{p}</option>)}</SelectMenu>
          <SelectMenu className="qs-select" aria-label={t('Holat')} value={x.status} onChange={(e) => update.mutate({ status: e.target.value })}>{Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</SelectMenu>
          <Button variant="secondary" onClick={() => update.mutate(x.assigneeId ? { unassign: true } : { assigneeId: me.data?.id })}>{x.assigneeId ? (x.assigneeId === me.data?.id ? t('Menga tayinlangan · olib tashlash') : t('Tayinlashni olib tashlash')) : t('O‘zimga olish')}</Button>
        </div>
      </div>
      <div className="qs-grid-2 qs-grid-main">
        <div className="qs-page qs-gap-3">
          <div className="qs-card qs-ticket-thread">
            {x.messages?.map((m) => m.senderSide === 'SYSTEM'
              ? <div key={m.id} className="qs-msg--system">{m.body} · {formatDateTime(m.createdAt)}</div>
              : <div key={m.id} className={cx('qs-ticket-msg', m.senderSide === 'AGENT' && 'is-mine', m.isInternal && 'is-internal')}><small>{m.senderSide === 'AGENT' ? (m.isInternal ? t('Ichki izoh') : t('Agent')) : t('Foydalanuvchi')} · {formatDateTime(m.createdAt)}</small>{m.body}</div>)}
          </div>
          {x.status !== 'CLOSED' && (
            <div className="qs-card qs-form">
              {!!templates.data?.length && (
                <SelectMenu className="qs-select" aria-label={t('Shablon')} value="" onChange={(e) => { const tpl = templates.data!.find((tp) => tp.id === e.target.value); if (tpl) setText(tr(tpl.bodyI18n)); }}>
                  <option value="">{t('Javob shabloni…')}</option>{templates.data.filter((tp) => tp.active).map((tp) => <option key={tp.id} value={tp.id}>{tr(tp.titleI18n)}</option>)}
                </SelectMenu>
              )}
              <Textarea label={internal ? t('Ichki izoh (foydalanuvchiga ko‘rinmaydi)') : t('Javob')} value={text} maxLength={8000} onChange={(e) => setText(e.target.value)} />
              <label className="qs-check"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> {t('Ichki izoh')}</label>
              <div className="qs-form__actions">
                {!internal && <Button variant="secondary" disabled={!text.trim()} loading={reply.isPending} onClick={() => reply.mutate('RESOLVED')}>{t('Javob va hal qilindi')}</Button>}
                <Button disabled={!text.trim()} loading={reply.isPending} onClick={() => reply.mutate(undefined)}>{internal ? t('Izohni saqlash') : t('Javob berish')}</Button>
              </div>
              {(reply.isError || update.isError) && <Alert tone="danger">{getErrorMessage(reply.error ?? update.error)}</Alert>}
            </div>
          )}
        </div>
        <aside className="qs-card">
          <h2>{t('Ma’lumot')}</h2>
          <dl className="qs-dl">
            <div><dt>{t('Murojaatchi')}</dt><dd>{x.requester ? <Link to={`/admin/foydalanuvchilar/${x.requester.id}`}>{[x.requester.firstName, x.requester.lastName].filter(Boolean).join(' ') || x.requester.phone}</Link> : x.guestContact ?? '—'}</dd></div>
            <div><dt>{t('Birinchi javob muddati')}</dt><dd>{formatDateTime(x.firstResponseDueAt)}</dd></div>
            <div><dt>{t('Javob berilgan')}</dt><dd>{x.firstRespondedAt ? formatDateTime(x.firstRespondedAt) : '—'}</dd></div>
            {x.relatedType && <div><dt>{t('Bog‘liq obyekt')}</dt><dd>{relatedLink ? <Link to={relatedLink}>{x.relatedType}</Link> : `${x.relatedType} · ${x.relatedId?.slice(0, 8)}`}</dd></div>}
            {x.requestIdRef && <div><dt>requestId</dt><dd><Link to={`/admin/errorlar?requestId=${encodeURIComponent(x.requestIdRef)}`}>{x.requestIdRef}</Link></dd></div>}
            {x.satisfaction && <div><dt>{t('Baho')}</dt><dd>{'★'.repeat(x.satisfaction)}</dd></div>}
          </dl>
        </aside>
      </div>
    </div>
  );
}

const LANGS: Array<['uz' | 'oz' | 'ru' | 'en', string]> = [['uz', 'O‘zbekcha'], ['oz', 'Ўзбекча'], ['ru', 'Русский'], ['en', 'English']];

/** U12.8: kontent — ro‘yxat. */
export function AdminContentPage() {
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['admin-articles'], queryFn: m7Service.adminArticles });
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Bilimlar markazi')}</h1><p>{t('{n} ta material', { n: list.data?.length ?? 0 })}</p></div><div className="qs-page__actions"><Button onClick={() => navigate('/admin/kontent/yangi')}><Plus size={16} /> {t('Yangi material')}</Button></div></div>
      {list.isLoading ? <PageLoader /> : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Sarlavha')}</th><th>{t('Tur')}</th><th>{t('Kategoriya')}</th><th>{t('Tarjima')}</th><th>{t('Holat')}</th><th className="qs-right">{t('Foydali')}</th></tr></thead>
            <tbody>
              {list.data?.map((a) => (
                <tr key={a.id} className="is-clickable" onClick={() => navigate(`/admin/kontent/${a.id}`)}>
                  <td><div className="qs-cell-title"><strong>{tr(a.titleI18n)}</strong><small>/{a.category.slug}/{a.slug}</small></div></td>
                  <td>{TYPE_LABEL[a.articleType]}</td>
                  <td>{tr(a.category.nameI18n)}</td>
                  <td>{(['uz', 'ru'] as const).map((l) => <Badge key={l} tone={a.bodyI18n[l] ? 'success' : 'warning'}>{l}</Badge>)}</td>
                  <td><Badge tone={a.status === 'PUBLISHED' ? 'success' : a.status === 'DRAFT' ? 'neutral' : 'warning'}>{a.status === 'PUBLISHED' ? t('Nashr qilingan') : a.status === 'DRAFT' ? t('Qoralama') : t('Arxiv')}</Badge></td>
                  <td className="qs-right qs-num">{a.helpfulYes} / {a.helpfulNo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** U12.8: maqola muharriri — 3 til tablari (to‘liqlik), Markdown + preview, SEO hisoblagichi, CTA, manbalar, holat. */
export function AdminArticleEditorPage() {
  const { id = '' } = useParams();
  const isNew = id === 'yangi';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cats = useQuery({ queryKey: ['k-cats'], queryFn: m7Service.kCategories });
  const existing = useQuery({ queryKey: ['admin-article', id], queryFn: () => m7Service.adminArticle(id), enabled: !isNew });
  const [lang, setLang] = useState<'uz' | 'oz' | 'ru' | 'en'>('uz');
  const [preview, setPreview] = useState(false);
  const empty = { uz: '', oz: '', ru: '', en: '' };
  const [f, setF] = useState({ slug: '', articleType: 'ARTICLE' as ArticleType, categoryId: '', ctaType: 'NONE' as CtaType, status: 'DRAFT' as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED', sourceUrls: '', tags: '', verifiedAt: '', title: { ...empty } as I18n, summary: { ...empty } as I18n, body: { ...empty } as I18n, seoTitle: { ...empty } as I18n, seoDesc: { ...empty } as I18n });
  useEffect(() => {
    const a = existing.data;
    if (!a) return;
    setF({
      slug: a.slug, articleType: a.articleType, categoryId: a.categoryId, ctaType: a.ctaType, status: a.status, sourceUrls: (a.sourceUrls ?? []).join('\n'), tags: a.tags.join(', '), verifiedAt: a.verifiedAt?.slice(0, 10) ?? '',
      title: { ...empty, ...a.titleI18n }, summary: { ...empty, ...a.summaryI18n }, body: { ...empty, ...a.bodyI18n }, seoTitle: { ...empty, ...(a.seoTitleI18n ?? {}) }, seoDesc: { ...empty, ...(a.seoDescriptionI18n ?? {}) },
    });
  }, [existing.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const clean = (v: I18n) => Object.fromEntries(Object.entries(v).filter(([, x]) => x?.trim()));
  const save = useMutation({
    mutationFn: () => m7Service.saveArticle(isNew ? null : id, {
      slug: f.slug, articleType: f.articleType, categoryId: f.categoryId, ctaType: f.ctaType, status: f.status,
      sourceUrls: f.sourceUrls.split('\n').map((s) => s.trim()).filter(Boolean), tags: f.tags.split(',').map((s) => s.trim()).filter(Boolean), verifiedAt: f.verifiedAt || null,
      titleI18n: clean(f.title), summaryI18n: clean(f.summary), bodyI18n: clean(f.body), seoTitleI18n: clean(f.seoTitle), seoDescriptionI18n: clean(f.seoDesc),
    }),
    onSuccess: (a) => { void queryClient.invalidateQueries({ queryKey: ['admin-articles'] }); if (isNew) navigate(`/admin/kontent/${a.id}`, { replace: true }); },
  });
  const completeness = useMemo(() => Object.fromEntries(LANGS.map(([l]) => [l, [f.title, f.summary, f.body].filter((x) => x[l]?.trim()).length])), [f]);
  if (!isNew && existing.isLoading) return <PageLoader />;
  const setL = (key: 'title' | 'summary' | 'body' | 'seoTitle' | 'seoDesc', v: string) => setF({ ...f, [key]: { ...f[key], [lang]: v } });
  const category = cats.data?.find((c) => c.id === f.categoryId);
  return (
    <div className="qs-page">
      <p><Link to="/admin/kontent">← {t('Bilimlar markazi')}</Link></p>
      <div className="qs-page__head">
        <div><h1>{isNew ? t('Yangi material') : tr(f.title) || f.slug}</h1></div>
        <div className="qs-page__actions">
          {!isNew && category && <ButtonAnchor variant="ghost" href={`${env.customerUrl.replace(/\/mijoz\/?$/, '')}/mijoz/bilim/${category.slug}/${f.slug}`} target="_blank" rel="noreferrer"><Eye size={15} /> {t('Foydalanuvchi sifatida ko‘rish')}</ButtonAnchor>}
          <Button loading={save.isPending} disabled={!f.slug || !f.categoryId || !f.title.uz} onClick={() => save.mutate()}><Save size={15} /> {t('Saqlash')}</Button>
        </div>
      </div>
      {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
      {save.isSuccess && <Alert tone="success">{t('Saqlandi')}</Alert>}
      <div className="qs-grid-2 qs-grid-main">
        <section className="qs-card qs-form">
          <TabBar variant="tabs" role="tablist">
            {LANGS.map(([l, label]) => <Tab key={l} role="tab" aria-selected={lang === l} onClick={() => setLang(l)} selected={lang === l}>{label} <Badge tone={completeness[l] === 3 ? 'success' : l === 'oz' || l === 'en' ? 'neutral' : 'warning'}>{completeness[l]}/3</Badge></Tab>)}
          </TabBar>
          {lang === 'en' && <small className="qs-muted">English text is optional: if empty, the Uzbek text is shown to English readers.</small>}
          {lang === 'oz' && <small className="qs-muted">{t('Kirill matni bo‘sh bo‘lsa, lotin matnidan avtomatik transliteratsiya qilinadi.')}</small>}
          <Input label={t('Sarlavha')} value={f.title[lang] ?? ''} onChange={(e) => setL('title', e.target.value)} />
          <Textarea label={t('Qisqa tavsif')} value={f.summary[lang] ?? ''} onChange={(e) => setL('summary', e.target.value)} />
          <TabBar variant="tabs"><Tab onClick={() => setPreview(false)} selected={!preview}>Markdown</Tab><Tab onClick={() => setPreview(true)} selected={preview}>{t('Ko‘rinish')}</Tab></TabBar>
          {preview ? <div className="qs-card"><Markdown source={f.body[lang] ?? ''} /></div> : <Textarea label={t('Matn (Markdown)')} rows={18} value={f.body[lang] ?? ''} onChange={(e) => setL('body', e.target.value)} />}
          <Input label={t('SEO sarlavha ({n}/60)', { n: (f.seoTitle[lang] ?? '').length })} value={f.seoTitle[lang] ?? ''} onChange={(e) => setL('seoTitle', e.target.value)} />
          <Textarea label={t('SEO tavsif ({n}/160)', { n: (f.seoDesc[lang] ?? '').length })} value={f.seoDesc[lang] ?? ''} onChange={(e) => setL('seoDesc', e.target.value)} />
        </section>
        <aside className="qs-card qs-form">
          <Input label="Slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
          <label className="gm-field__label" htmlFor="acat">{t('Kategoriya')}</label>
          <SelectMenu id="acat" className="qs-select" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}><option value="">—</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{tr(c.nameI18n)}</option>)}</SelectMenu>
          <label className="gm-field__label" htmlFor="atype">{t('Tur')}</label>
          <SelectMenu id="atype" className="qs-select" value={f.articleType} onChange={(e) => setF({ ...f, articleType: e.target.value as ArticleType })}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectMenu>
          <label className="gm-field__label" htmlFor="acta">CTA</label>
          <SelectMenu id="acta" className="qs-select" value={f.ctaType} onChange={(e) => setF({ ...f, ctaType: e.target.value as CtaType })}>{['NONE', 'CALCULATOR', 'OUTAGE', 'FINANCING', 'SHOPS'].map((c) => <option key={c}>{c}</option>)}</SelectMenu>
          <Input label={t('Teglar (vergul bilan)')} value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />
          <Textarea label={t('Manbalar (har qatorda URL)')} value={f.sourceUrls} onChange={(e) => setF({ ...f, sourceUrls: e.target.value })} />
          <Input label={t('Tekshirilgan sana')} type="date" value={f.verifiedAt} onChange={(e) => setF({ ...f, verifiedAt: e.target.value })} />
          <label className="gm-field__label" htmlFor="astatus">{t('Holat')}</label>
          <SelectMenu id="astatus" className="qs-select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as typeof f.status })}><option value="DRAFT">{t('Qoralama')}</option><option value="PUBLISHED">{t('Nashr qilingan')}</option><option value="ARCHIVED">{t('Arxiv')}</option></SelectMenu>
        </aside>
      </div>
    </div>
  );
}

/** U12.10: funnel — davr va hudud filtrlari, har bosqichda konversiya. */
export function AdminReportsPage() {
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [region, setRegion] = useState('');
  const f = useQuery({ queryKey: ['funnel', from, to, region], queryFn: () => m7Service.funnel(`${from}T00:00:00+05:00`, `${to}T23:59:59+05:00`, region || undefined) });
  const LABEL: Record<string, string> = { HOME: t('Bosh sahifa'), CALC_STARTED: t('Hisob boshlandi'), CALC_RESULT: t('Natija'), CALC_SAVED: t('Saqlandi'), REQUEST: t('So‘rov'), QUOTED: t('Taklif'), SELECTED: t('Tanlandi'), INSTALLED: t('Montaj tasdiqlandi') };
  const max = Math.max(1, ...(f.data?.steps ?? []).map((s) => s.count));
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Hisobotlar')}</h1><p>{t('Konversiya funnel’i: veb bosqichlar — noyob tashrifchilar, keyingilari — yozuvlar.')}</p></div>
        <div className="qs-page__actions">
          <input className="qs-input-sm" type="date" aria-label={t('Dan')} value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="qs-input-sm" type="date" aria-label={t('Gacha')} value={to} onChange={(e) => setTo(e.target.value)} />
          <SelectMenu className="qs-select" aria-label={t('Hudud')} value={region} onChange={(e) => setRegion(e.target.value)}><option value="">{t('Barcha hududlar')}</option>{REGIONS.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</SelectMenu>
        </div>
      </div>
      {f.isError && <Alert tone="danger">{getErrorMessage(f.error)}</Alert>}
      {f.isLoading ? <PageLoader /> : (
        <section className="qs-card">
          <div className="qs-hbars">
            {f.data?.steps.map((s) => <div key={s.step} className="qs-hbar"><span>{LABEL[s.step] ?? s.step}</span><div><span style={{ width: `${(s.count / max) * 100}%` }} /></div><strong>{s.count}{s.conversion !== null ? <small className="qs-muted"> · {s.conversion}%</small> : null}</strong></div>)}
          </div>
          <div className="qs-table-wrap qs-mt-4">
            <table className="qs-table"><thead><tr><th>{t('Bosqich')}</th><th className="qs-right">{t('Soni')}</th><th className="qs-right">{t('Oldingidan konversiya')}</th></tr></thead>
              <tbody>{f.data?.steps.map((s) => <tr key={s.step}><td>{LABEL[s.step] ?? s.step}</td><td className="qs-right qs-num">{s.count}</td><td className="qs-right qs-num">{s.conversion === null ? '—' : `${s.conversion} %`}</td></tr>)}</tbody></table>
          </div>
        </section>
      )}
    </div>
  );
}
