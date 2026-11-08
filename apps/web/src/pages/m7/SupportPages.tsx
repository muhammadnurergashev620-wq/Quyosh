import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LifeBuoy, Paperclip, Send, Star } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { calcService } from '@/features/calc/calc.service';
import { dealsService } from '@/features/deals/deals.service';
import { m7Service, uploadMedia } from '@/features/m7/m7.service';
import { tr } from '@/features/m7/i18n-text';
import type { TicketStatus } from '@/features/m7/types';
import { useMe } from '@/features/session/hooks/useMe';
import { useAuthStore } from '@/store/auth.store';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { t } from '@/i18n';
import { ArticleCardView } from './KnowledgePages';
import '@/features/shop/shop.css';
import '@/features/deals/deals.css';
import '@/features/m7/m7.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Tab } from '@/components/ui/Tabs';

export const CATEGORY_LABEL: Record<string, string> = {
  ACCOUNT: t('Akkaunt va kirish'), CALCULATOR: t('Kalkulyator'), REQUEST_QUOTE: t('So‘rov va takliflar'), INSTALLATION: t('Montaj'),
  SHOP: t('Do‘kon kabineti'), TECHNICAL: t('Texnik xato'), SECURITY: t('Xavfsizlik'), OTHER: t('Boshqa'),
};
export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: t('Ochiq'), tone: 'primary' }, IN_PROGRESS: { label: t('Ko‘rib chiqilmoqda'), tone: 'primary' }, WAITING_USER: { label: t('Javobingiz kutilmoqda'), tone: 'warning' },
  RESOLVED: { label: t('Hal qilindi'), tone: 'success' }, CLOSED: { label: t('Yopilgan'), tone: 'neutral' },
};

/** U7.7: murojaat yaratish — mavzu yozilganda FAQ tavsiyalari (300 ms), bog‘liq obyekt, 5 tagacha fayl; guest — OTP. */
function NewTicket({ onDone }: { onDone: (r: { id: string; code: string; firstResponseDueAt: string }) => void }) {
  const hasSession = useAuthStore((s) => s.hasSession);
  const me = useMe();
  const [category, setCategory] = useState('OTHER');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [related, setRelated] = useState('');
  const [files, setFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [debounced, setDebounced] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  useEffect(() => { const id = window.setTimeout(() => setDebounced(subject.trim()), 300); return () => window.clearTimeout(id); }, [subject]);
  const suggestions = useQuery({ queryKey: ['support-sugg', debounced], queryFn: () => m7Service.suggestions(debounced), enabled: debounced.length >= 3 });
  const calcs = useQuery({ queryKey: ['calculations'], queryFn: calcService.list, enabled: hasSession });
  const requests = useQuery({ queryKey: ['quote-requests'], queryFn: dealsService.myRequests, enabled: hasSession });
  const installs = useQuery({ queryKey: ['installations', 'CUSTOMER', null], queryFn: () => dealsService.installations(), enabled: hasSession });
  const otp = useMutation({ mutationFn: () => m7Service.guestOtp(phone), onSuccess: (r) => { setCodeSent(true); if (r.developmentCode) setCode(r.developmentCode); } });
  const upload = useMutation({ mutationFn: (f: File) => uploadMedia('SUPPORT_ATTACHMENT', 'User', me.data!.id, f), onSuccess: (r, f) => setFiles((x) => [...x, { id: r.id, name: f.name }]) });
  const create = useMutation({
    mutationFn: () => {
      const [relatedType, relatedId] = related ? related.split(':') : [undefined, undefined];
      return m7Service.createTicket({ category, subject: subject.trim(), body: body.trim(), relatedType, relatedId, attachmentIds: files.map((f) => f.id), ...(hasSession ? {} : { guest: { phone, code, name: name.trim() } }) });
    },
    onSuccess: onDone,
  });
  const ready = subject.trim().length >= 3 && body.trim().length >= 5 && (hasSession || (codeSent && code.length === 6 && name.trim().length >= 2));
  return (
    <div className="qs-form">
      <label className="gm-field__label" htmlFor="cat">{t('Kategoriya')}</label>
      <SelectMenu id="cat" className="qs-select" value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectMenu>
      <Input label={t('Mavzu')} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} required />
      {!!suggestions.data?.length && (
        <Alert tone="info" title={t('Balki bu javob yordam beradi?')}>
          <div className="qs-kcards qs-mt-2">{suggestions.data.slice(0, 3).map((a) => <ArticleCardView key={a.id} a={a} />)}</div>
          <small className="qs-muted">{t('Javob topilmasa — murojaatni baribir yuboring.')}</small>
        </Alert>
      )}
      <Textarea label={t('Tavsif')} value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} required />
      {hasSession && (
        <>
          <label className="gm-field__label" htmlFor="rel">{t('Bog‘liq obyekt (ixtiyoriy)')}</label>
          <SelectMenu id="rel" className="qs-select" value={related} onChange={(e) => setRelated(e.target.value)}>
            <option value="">—</option>
            {calcs.data?.map((c) => <option key={c.id} value={`Calculation:${c.id}`}>{t('Hisob')}: {c.title || formatDateTime(c.createdAt)}</option>)}
            {requests.data?.map((r) => <option key={r.id} value={`QuoteRequest:${r.id}`}>{t('So‘rov №{n}', { n: r.number })}</option>)}
            {installs.data?.map((i) => <option key={i.id} value={`Installation:${i.id}`}>{t('Montaj')}: {i.shop.name}</option>)}
          </SelectMenu>
          <div className="qs-page__actions">
            <label className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              <Paperclip size={14} /> {t('Fayl biriktirish')}
              <input type="file" hidden accept="image/*,application/pdf" disabled={files.length >= 5 || !me.data} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
            </label>
            {files.map((f) => <Badge key={f.id} tone="neutral">{f.name}</Badge>)}
            {upload.isPending && <small className="qs-muted">{t('Yuklanmoqda…')}</small>}
          </div>
        </>
      )}
      {!hasSession && (
        <div className="qs-card">
          <h3 className="qs-mt-0">{t('Telefon raqamingizni tasdiqlang')}</h3>
          <div className="qs-form__row">
            <Input label={t('Telefon')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" />
            <div style={{ alignSelf: 'end' }}><Button variant="secondary" loading={otp.isPending} disabled={phone.replace(/\D/g, '').length < 9} onClick={() => otp.mutate()}>{codeSent ? t('Qayta yuborish') : t('Kod yuborish')}</Button></div>
          </div>
          {codeSent && <div className="qs-form__row"><Input label={t('Kod')} value={code} maxLength={6} inputMode="numeric" onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /><Input label={t('Ismingiz')} value={name} onChange={(e) => setName(e.target.value)} /></div>}
          {otp.isError && <Alert tone="danger">{getErrorMessage(otp.error)}</Alert>}
        </div>
      )}
      {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
      <div className="qs-form__actions"><Button disabled={!ready} loading={create.isPending} onClick={() => create.mutate()}><Send size={15} /> {t('Yuborish')}</Button></div>
    </div>
  );
}

/** U7.7: yordam markazi (guest ham). */
export function HelpCenterPage() {
  const hasSession = useAuthStore((s) => s.hasSession);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ id: string; code: string; firstResponseDueAt: string } | null>(null);
  const [q, setQ] = useState('');
  const faq = useQuery({ queryKey: ['k-list', 'FAQ'], queryFn: () => m7Service.articles({ type: 'FAQ', limit: 8 }) });
  const cats = useQuery({ queryKey: ['k-cats'], queryFn: m7Service.kCategories });
  const search = useQuery({ queryKey: ['support-sugg', q], queryFn: () => m7Service.suggestions(q), enabled: q.trim().length >= 3 });
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Qanday yordam bera olamiz?')}</h1><p>{t('Savolingizga javob qidiring yoki murojaat yuboring — odatda 4 ish soati ichida javob beramiz.')}</p></div>
        <div className="qs-page__actions">
          {hasSession && <ButtonLink variant="secondary" to="/mijoz/murojaatlar">{t('Murojaatlarim')}</ButtonLink>}
          <Button onClick={() => { setDone(null); setOpen(true); }}><LifeBuoy size={16} /> {t('Murojaat yuborish')}</Button>
        </div>
      </div>
      <div className="qs-search-hero"><input aria-label={t('Qidirish')} placeholder={t('Savolingizni yozing')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {q.trim().length >= 3 && (search.data?.length ? <div className="qs-kcards">{search.data.map((a) => <ArticleCardView key={a.id} a={a} />)}</div> : !search.isLoading && <p className="qs-muted">{t('Mos javob topilmadi — murojaat yuboring.')}</p>)}
      <div className="qs-kcats">{cats.data?.map((c) => <Link key={c.id} className="qs-kcat" to={`/mijoz/bilim/${c.slug}`}><strong>{tr(c.nameI18n)}</strong><small>{t('{n} ta material', { n: c.count })}</small></Link>)}</div>
      <section><h2>{t('Ko‘p beriladigan savollar')}</h2><div className="qs-kcards">{faq.data?.items.map((a) => <ArticleCardView key={a.id} a={a} />)}</div></section>
      <Modal open={open} onClose={() => setOpen(false)} title={done ? t('Murojaat qabul qilindi') : t('Murojaat yuborish')} wide>
        {done ? (
          <div className="qs-page qs-items-center qs-text-center">
            <CheckCircle2 size={44} color="var(--qs-color-success)" />
            <h2 className="qs-m-0">{done.code}</h2>
            <p>{t('Birinchi javob muddati: {d} (ish vaqti bo‘yicha).', { d: formatDateTime(done.firstResponseDueAt) })}</p>
            {hasSession ? <ButtonLink to={`/mijoz/murojaatlar/${done.id}`}>{t('Murojaatni ochish')}</ButtonLink> : <p className="qs-muted">{t('Javobni shu telefon raqami bilan kirib ko‘rasiz.')}</p>}
          </div>
        ) : <NewTicket onDone={setDone} />}
      </Modal>
    </div>
  );
}

export function TicketsPage() {
  const list = useQuery({ queryKey: ['tickets'], queryFn: m7Service.tickets });
  if (list.isLoading) return <PageLoader />;
  if (list.isError) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Murojaatlar')}</h1></div><div className="qs-page__actions"><ButtonLink to="/mijoz/yordam">{t('Yangi murojaat')}</ButtonLink></div></div>
      {!list.data?.length ? <EmptyState icon={<LifeBuoy size={30} />} title={t('Murojaat yo‘q')} action={<ButtonLink to="/mijoz/yordam">{t('Yordam markazi')}</ButtonLink>} /> : (
        <div className="qs-req-list">
          {list.data.map((x) => (
            <Link key={x.id} to={`/mijoz/murojaatlar/${x.id}`} className="qs-req-card">
              <div><h3>{x.code} · {x.subject}</h3><div className="qs-req-card__meta"><span>{CATEGORY_LABEL[x.category] ?? x.category}</span><span>{formatRelativeTime(x.lastMessageAt)}</span></div></div>
              <div className="qs-req-card__side"><StatusBadge map={TICKET_STATUS} status={x.status} /></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TicketPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const ticket = useQuery({ queryKey: ['ticket', id], queryFn: () => m7Service.ticket(id), refetchInterval: 20_000 });
  const [text, setText] = useState('');
  const set = (d: unknown) => queryClient.setQueryData(['ticket', id], d);
  const reply = useMutation({ mutationFn: () => m7Service.replyTicket(id, text.trim()), onSuccess: (d) => { set(d); setText(''); } });
  const resolve = useMutation({ mutationFn: () => m7Service.resolveTicket(id), onSuccess: set });
  const reopen = useMutation({ mutationFn: () => m7Service.reopenTicket(id), onSuccess: set });
  const rate = useMutation({ mutationFn: (s: number) => m7Service.rateTicket(id, s), onSuccess: () => void ticket.refetch() });
  if (ticket.isLoading) return <PageLoader />;
  if (ticket.isError || !ticket.data) return <Alert tone="danger">{getErrorMessage(ticket.error)}</Alert>;
  const x = ticket.data;
  const closed = x.status === 'CLOSED';
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{x.code} · {x.subject}</h1><p>{CATEGORY_LABEL[x.category] ?? x.category} · {formatDateTime(x.createdAt)}</p></div>
        <div className="qs-page__actions">
          <StatusBadge map={TICKET_STATUS} status={x.status} />
          {!closed && x.status !== 'RESOLVED' && <Button variant="secondary" loading={resolve.isPending} onClick={() => resolve.mutate()}>{t('Hal bo‘ldi deb belgilash')}</Button>}
          {x.status === 'RESOLVED' && <Button variant="ghost" loading={reopen.isPending} onClick={() => reopen.mutate()}>{t('Qayta ochish')}</Button>}
        </div>
      </div>
      {!x.firstRespondedAt && !closed && <Alert tone="info">{t('Birinchi javob muddati: {d}', { d: formatDateTime(x.firstResponseDueAt) })}</Alert>}
      <div className="qs-card qs-ticket-thread">
        {x.messages?.map((m) => m.senderSide === 'SYSTEM'
          ? <div key={m.id} className="qs-msg--system">{m.body} · {formatDateTime(m.createdAt)}</div>
          : <div key={m.id} className={cx('qs-ticket-msg', m.senderSide === 'USER' && 'is-mine')}><small>{m.senderSide === 'AGENT' ? t('Quyosh yordam') : t('Siz')} · {formatDateTime(m.createdAt)}</small>{m.body}{m.attachmentFileIds.length > 0 && <small><Paperclip size={12} /> {t('{n} ta fayl', { n: m.attachmentFileIds.length })}</small>}</div>)}
      </div>
      {(x.status === 'RESOLVED' || closed) && (
        <div className="qs-card">
          <h2>{t('Javobimizni baholang')}</h2>
          <div className="qs-stars" role="radiogroup" aria-label={t('Baho')}>
            {[1, 2, 3, 4, 5].map((n) => <Tab key={n} role="radio" aria-checked={x.satisfaction === n} onClick={() => rate.mutate(n)} aria-label={t('{n} yulduz', { n })} selected={(x.satisfaction ?? 0) >= n}><Star size={26} fill={(x.satisfaction ?? 0) >= n ? 'currentColor' : 'none'} /></Tab>)}
          </div>
        </div>
      )}
      {!closed && (
        <div className="qs-card qs-form">
          <Textarea label={t('Javob')} value={text} maxLength={8000} onChange={(e) => setText(e.target.value)} />
          <div className="qs-form__actions"><Button disabled={!text.trim()} loading={reply.isPending} onClick={() => reply.mutate()}><Send size={15} /> {t('Yuborish')}</Button></div>
          {reply.isError && <Alert tone="danger">{getErrorMessage(reply.error)}</Alert>}
        </div>
      )}
    </div>
  );
}
