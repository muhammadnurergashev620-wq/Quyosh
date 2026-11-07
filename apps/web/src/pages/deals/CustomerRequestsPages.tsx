import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Download, Eye, Lock, MessageCircle, Plus, Scale, Star } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { kw, SYSTEM_TYPE, sum, sumShort, years } from '@/features/calc/labels';
import { dealsService } from '@/features/deals/deals.service';
import { BADGE_TEXT, days, months, num, QUOTE_STATUS, REQUEST_STATUS, responseTime, SHOP_REPLY_STATUS } from '@/features/deals/labels';
import { QuoteWithRevisions } from '@/features/deals/components/QuoteDetails';
import { RequestWizard } from '@/features/deals/components/RequestWizard';
import { publicShopsService } from '@/features/catalog/public-shops.service';
import type { CompareRow, QuoteRequestDetail } from '@/features/deals/types';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatDateTime, formatDecimal, formatNumber, formatRating } from '@/lib/format';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/deals/deals.css';

const shopInitial = (name: string) => name.trim().charAt(0).toUpperCase();
const isExpiring = (validUntil: string | null | undefined, status: string) => !!validUntil && ['SENT', 'VIEWED'].includes(status) && new Date(validUntil).getTime() - Date.now() <= 48 * 3_600_000;

/** U10.4: so‘rovlar va takliflar ro‘yxati. */
export function CustomerRequestsPage() {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('yangi') === '1');
  const list = useQuery({ queryKey: ['quote-requests'], queryFn: dealsService.myRequests, refetchInterval: 30_000 });
  const preset = { calculationId: params.get('hisob') ?? undefined, shopId: params.get('dokon') ?? undefined };
  if (list.isLoading) return <PageLoader />;
  if (list.isError) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('So‘rov va takliflar')}</h1><p>{t('Bir so‘rov bilan 5 tagacha do‘kondan taklif oling va solishtiring.')}</p></div>
        <div className="qs-page__actions"><Button onClick={() => setOpen(true)}><Plus size={16} /> {t('Taklif so‘rash')}</Button></div>
      </div>
      {!list.data?.length ? (
        <EmptyState icon={<ClipboardList size={30} />} title={t('Hali so‘rov yo‘q')} description={t('Hisob natijasidan yoki do‘kon sahifasidan taklif so‘rashingiz mumkin.')} action={<Button onClick={() => setOpen(true)}>{t('Taklif so‘rash')}</Button>} />
      ) : (
        <div className="qs-req-list">
          {list.data.map((r) => (
            <Link key={r.id} to={`/mijoz/sorovlar/${r.id}`} className="qs-req-card">
              <div>
                <h3>№{r.number} · {r.title}</h3>
                <div className="qs-req-card__meta">
                  <span>{SYSTEM_TYPE[r.systemType].title}{r.requiredCapacityKw ? ` · ${kw(num(r.requiredCapacityKw))}` : ''}</span>
                  <span>{formatDate(r.createdAt)}</span>
                  <span>{r.shops.map((s) => s.shop.name).join(', ')}</span>
                </div>
              </div>
              <div className="qs-req-card__side">
                <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                <small className="qs-muted">{r.quoteCount ? t('{n} ta taklif · {s} dan', { n: r.quoteCount, s: sumShort(num(r.minTotal)) }) : t('Taklif hali yo‘q')}</small>
                {r.unread > 0 && <span className="qs-unread" aria-label={t('{n} ta o‘qilmagan', { n: r.unread })}>{r.unread}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <RequestWizard open={open} preset={preset} onClose={() => { setOpen(false); if (params.has('yangi')) setParams({}, { replace: true }); }} />
    </div>
  );
}

/** U10.4: do‘kon qo‘shish (jami 5 gacha, so‘rov OPEN). */
function AddShopsModal({ request, open, onClose, onDone }: { request: QuoteRequestDetail; open: boolean; onClose: () => void; onDone: () => void }) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const shops = useQuery({ queryKey: ['public-shops', search], queryFn: () => publicShopsService.list({ search: search || undefined }), enabled: open });
  const room = request.limits.maxShops - request.shops.length;
  const add = useMutation({ mutationFn: () => dealsService.addShops(request.id, picked), onSuccess: () => { setPicked([]); onDone(); onClose(); } });
  const existing = new Set(request.shops.map((s) => s.shop.id));
  return (
    <Modal open={open} onClose={onClose} title={t('Do‘kon qo‘shish')} footer={<Button disabled={!picked.length} loading={add.isPending} onClick={() => add.mutate()}>{t('Qo‘shish ({n})', { n: picked.length })}</Button>}>
      <div className="qs-form">
        <small className="qs-muted">{t('Yana {n} ta do‘kon qo‘shish mumkin.', { n: room })}</small>
        <input className="qs-input-sm" placeholder={t('Do‘kon nomi')} aria-label={t('Qidirish')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="qs-pick-list">
          {(shops.data?.items ?? []).filter((s) => !existing.has(s.id)).map((s) => {
            const on = picked.includes(s.id);
            return (
              <div key={s.id} className={cx('qs-pick', on && 'is-on')}>
                <div><strong>{s.name}</strong><small><Star size={12} /> {formatRating(s.ratingAvg)} ({s.ratingCount})</small></div>
                <Button size="sm" variant={on ? 'secondary' : 'primary'} disabled={!on && picked.length >= room} onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== s.id) : [...cur, s.id]))}>{on ? t('Olib tashlash') : t('Tanlash')}</Button>
              </div>
            );
          })}
        </div>
        {add.isError && <Alert tone="danger">{getErrorMessage(add.error)}</Alert>}
      </div>
    </Modal>
  );
}

/** U9.2, U10.4: so‘rov sahifasi — do‘konlar qatorlari, kontaktni ochish, takliflar, solishtirish. */
export function CustomerRequestDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const request = useQuery({ queryKey: ['quote-request', id], queryFn: () => dealsService.request(id), refetchInterval: 20_000 });
  const [reveal, setReveal] = useState<QuoteRequestDetail['shops'][number] | null>(null);
  const [closing, setClosing] = useState(false);
  const [adding, setAdding] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['quote-request', id] });
  const revealM = useMutation({ mutationFn: (shopId: string) => dealsService.revealContact(id, shopId), onSuccess: () => { setReveal(null); refresh(); } });
  const closeM = useMutation({ mutationFn: () => dealsService.closeRequest(id), onSuccess: () => { setClosing(false); refresh(); void queryClient.invalidateQueries({ queryKey: ['quote-requests'] }); } });
  if (request.isLoading) return <PageLoader />;
  if (request.isError || !request.data) return <Alert tone="danger">{getErrorMessage(request.error)}</Alert>;
  const r = request.data;
  const quotes = r.shops.filter((s) => s.quote);
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div>
          <h1>№{r.number} · {r.title}</h1>
          <p>{SYSTEM_TYPE[r.systemType].title}{r.requiredCapacityKw ? ` · ${kw(num(r.requiredCapacityKw))}` : ''} · {formatDate(r.createdAt)}</p>
        </div>
        <div className="qs-page__actions">
          <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
          {quotes.length >= 2 && <Button variant="secondary" onClick={() => navigate(`/mijoz/sorovlar/${id}/solishtirish`)}><Scale size={16} /> {t('Takliflarni solishtirish')}</Button>}
          {r.status === 'OPEN' && <Button variant="ghost" onClick={() => setClosing(true)}>{t('So‘rovni yopish')}</Button>}
        </div>
      </div>
      {r.calculation?.brief && (
        <div className="qs-card">
          <header><h2>{t('Hisob xulosasi')}</h2><Link to={`/mijoz/natija/${r.calculation.id}`}>{t('Hisobni ochish')}</Link></header>
          <dl className="qs-quote-card__facts">
            {r.calculation.brief.systemPowerKw != null && <div><dt>{t('Quvvat')}</dt><dd>{kw(r.calculation.brief.systemPowerKw)}</dd></div>}
            {r.calculation.brief.annualGenerationKwh != null && <div><dt>{t('Yillik ishlab chiqarish')}</dt><dd>{formatNumber(Math.round(r.calculation.brief.annualGenerationKwh))} kWh</dd></div>}
            {r.calculation.brief.initialCost != null && <div><dt>{t('Taxminiy narx')}</dt><dd>{sumShort(r.calculation.brief.initialCost)}</dd></div>}
            {r.calculation.brief.simplePaybackYears != null && <div><dt>{t('O‘zini oqlash')}</dt><dd>{years(r.calculation.brief.simplePaybackYears)}</dd></div>}
          </dl>
        </div>
      )}
      <div className="qs-card">
        <header><h2>{t('Do‘konlar')}</h2><small className="qs-muted">{t('{n} / {max}', { n: r.shops.length, max: r.limits.maxShops })}</small>{r.status === 'OPEN' && r.shops.length < r.limits.maxShops && <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus size={14} /> {t('Do‘kon qo‘shish')}</Button>}</header>
        {r.shops.map((s) => (
          <div key={s.id} className="qs-shop-row">
            <div className="qs-shop-row__logo" aria-hidden>{shopInitial(s.shop.name)}</div>
            <div className="qs-shop-row__body">
              <div className="qs-shop-row__title">
                <Link to={`/mijoz/dokonlar/${s.shop.slug}`}><strong>{s.shop.name}</strong></Link>
                <Badge tone={SHOP_REPLY_STATUS[s.status].tone}>{SHOP_REPLY_STATUS[s.status].label}</Badge>
                {s.contactRevealedAt && <Badge tone="neutral">{t('Kontakt ochilgan · {d}', { d: formatDate(s.contactRevealedAt) })}</Badge>}
              </div>
              <small className="qs-muted"><Star size={12} /> {formatRating(s.shop.ratingAvg)} ({s.shop.ratingCount}){responseTime(s.shop.avgResponseMinutes) ? ` · ${responseTime(s.shop.avgResponseMinutes)}` : ''}</small>
              {s.declineReason && <small>{t('Rad etish sababi')}: {s.declineReason}</small>}
              {s.quote && (
                <div className={cx('qs-quote-card', s.quote.status === 'EXPIRED' && 'is-expired')}>
                  <div className="qs-page__actions" style={{ justifyContent: 'space-between' }}>
                    <span className="qs-quote-card__total">{sum(num(s.quote.total))}</span>
                    <span className="qs-page__actions">
                      {isExpiring(s.quote.validUntil, s.quote.status) && <Badge tone="warning">{t('Muddati tugayapti')}</Badge>}
                      {s.quote.currentRevision > 1 && !s.quote.viewedAt && <Badge tone="primary">{t('Yangilandi')}</Badge>}
                      <Badge tone={QUOTE_STATUS[s.quote.status].tone}>{QUOTE_STATUS[s.quote.status].label}</Badge>
                    </span>
                  </div>
                  <dl className="qs-quote-card__facts">
                    {s.quote.systemPowerKw && <div><dt>{t('Quvvat')}</dt><dd>{kw(num(s.quote.systemPowerKw))}</dd></div>}
                    {s.quote.systemPowerKw && <div><dt>{t('1 kVt narxi')}</dt><dd>{sumShort(num(s.quote.total) / num(s.quote.systemPowerKw))}</dd></div>}
                    <div><dt>{t('Kafolat (uskuna / montaj)')}</dt><dd>{months(s.quote.warrantyEquipmentMonths)} / {months(s.quote.warrantyInstallationMonths)}</dd></div>
                    <div><dt>{t('Montaj muddati')}</dt><dd>{days(s.quote.durationDays)}</dd></div>
                    <div><dt>{t('Amal qiladi')}</dt><dd>{formatDate(s.quote.validUntil)}</dd></div>
                  </dl>
                </div>
              )}
            </div>
            <div className="qs-shop-row__actions">
              {s.quote && <Button size="sm" onClick={() => navigate(`/mijoz/takliflar/${s.quote!.id}`)}><Eye size={15} /> {t('Batafsil')}</Button>}
              {s.quote?.installation && <Button size="sm" variant="secondary" onClick={() => navigate(`/mijoz/montajlar/${s.quote!.installation!.id}`)}>{t('Montaj')}</Button>}
              <Button size="sm" variant="secondary" onClick={() => navigate(`/mijoz/chat/${s.id}`)}><MessageCircle size={15} /> {t('Yozish')}{s.unread ? <span className="qs-unread">{s.unread}</span> : null}</Button>
              {!s.contactRevealedAt && r.status === 'OPEN' && <Button size="sm" variant="ghost" onClick={() => setReveal(s)}><Lock size={15} /> {t('Kontaktni ochish')}</Button>}
            </div>
          </div>
        ))}
      </div>
      <AddShopsModal request={r} open={adding} onClose={() => setAdding(false)} onDone={refresh} />
      <ConfirmDialog
        open={!!reveal}
        title={t('Kontaktni ochish')}
        description={t('{shop} sizga qo‘ng‘iroq qila oladi va aniq manzilni ko‘radi. O‘lchov uchrashuvini tasdiqlash yoki taklifni tanlash ham kontaktni avtomatik ochadi.', { shop: reveal?.shop.name ?? '' })}
        confirmLabel={t('Ochish')}
        loading={revealM.isPending}
        onConfirm={() => reveal && revealM.mutate(reveal.shop.id)}
        onCancel={() => setReveal(null)}
      />
      <ConfirmDialog
        open={closing}
        title={t('So‘rovni yopish')}
        description={t('Do‘konlar endi taklif yubora olmaydi, yuborilgan takliflar rad etilgan deb belgilanadi.')}
        confirmLabel={t('Yopish')}
        tone="danger"
        loading={closeM.isPending}
        onConfirm={() => closeM.mutate()}
        onCancel={() => setClosing(false)}
      />
      {(revealM.isError || closeM.isError) && <Alert tone="danger">{getErrorMessage(revealM.error ?? closeM.error)}</Alert>}
    </div>
  );
}

/** U9.5, U9.7: taklif — batafsil, revisionlar, PDF, tanlash/rad etish. */
export function CustomerQuotePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const quote = useQuery({ queryKey: ['quote', id], queryFn: () => dealsService.quote(id) });
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [lang, setLang] = useState<'uz' | 'oz' | 'ru' | 'en'>('uz');
  const accept = useMutation({
    mutationFn: () => dealsService.acceptQuote(id),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['quote-requests'] });
      navigate(`/mijoz/montajlar/${res.installationId}`);
    },
  });
  const reject = useMutation({ mutationFn: () => dealsService.rejectQuote(id, reason.trim() || undefined), onSuccess: () => { setRejecting(false); void quote.refetch(); } });
  if (quote.isLoading) return <PageLoader />;
  if (quote.isError || !quote.data) return <Alert tone="danger">{getErrorMessage(quote.error)}</Alert>;
  const q = quote.data;
  const open = ['SENT', 'VIEWED'].includes(q.status) && q.request.status === 'OPEN';
  const expired = q.status === 'EXPIRED';
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div>
          <h1>{q.shop.name}</h1>
          <p><Link to={`/mijoz/sorovlar/${q.requestId}`}>{t('So‘rov №{n}', { n: q.request.number })}</Link> · {t('Tahrir {n}', { n: q.currentRevision })} · {formatDateTime(q.sentAt)}</p>
        </div>
        <div className="qs-page__actions">
          <Badge tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</Badge>
          {isExpiring(q.validUntil, q.status) && <Badge tone="warning">{t('Muddati tugayapti · {d}', { d: formatDate(q.validUntil) })}</Badge>}
        </div>
      </div>
      {expired && <Alert tone="warning">{t('Taklif muddati o‘tgan.')} <Link to={`/mijoz/sorovlar/${q.requestId}`}>{t('Do‘kondan yangilashni so‘rash')}</Link></Alert>}
      <div className="qs-card">
        <div className="qs-page__actions" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="qs-quote-card__total">{sum(num(q.total))}</span>
          {q.pricePerKw && <span className="qs-muted">{t('1 kVt: {s}', { s: sumShort(q.pricePerKw) })}</span>}
        </div>
        <QuoteWithRevisions quote={q} />
      </div>
      <div className="qs-page__actions">
        {open && <Button onClick={() => setAccepting(true)}>{t('Tanlash')}</Button>}
        {open && <Button variant="ghost" onClick={() => setRejecting(true)}>{t('Rad etish')}</Button>}
        <select className="qs-select" aria-label={t('PDF tili')} value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
          <option value="uz">O‘zbekcha</option><option value="oz">Ўзбекча</option><option value="ru">Русский</option><option value="en">English</option>
        </select>
        <Button variant="secondary" onClick={() => void dealsService.quotePdf(q.id, lang, q.request.number)}><Download size={15} /> PDF</Button>
        {q.installation && <Button variant="secondary" onClick={() => navigate(`/mijoz/montajlar/${q.installation!.id}`)}>{t('Montajga o‘tish')}</Button>}
      </div>
      <Modal
        open={accepting}
        onClose={() => setAccepting(false)}
        title={t('Do‘konni tanlash')}
        footer={<Button loading={accept.isPending} onClick={() => accept.mutate()}>{t('Tasdiqlash')}</Button>}
      >
        <p>{t('Siz {shop} bilan ishlashni tanladingiz. Bu shartnoma yoki to‘lov emas — keyingi qadamlarni do‘kon bilan kelishasiz.', { shop: q.shop.name })}</p>
        <p className="qs-muted">{t('Boshqa do‘konlarga avtomatik xabar boradi, kontaktingiz shu do‘konga ochiladi.')}</p>
        {accept.isError && <Alert tone="danger">{getErrorMessage(accept.error)}</Alert>}
      </Modal>
      <Modal open={rejecting} onClose={() => setRejecting(false)} title={t('Taklifni rad etish')} footer={<Button variant="danger" loading={reject.isPending} onClick={() => reject.mutate()}>{t('Rad etish')}</Button>}>
        <Textarea label={t('Sabab (ixtiyoriy)')} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}

const GROUPS: Array<{ title: string; rows: Array<[string, (q: CompareRow) => string]> }> = [
  { title: t('Narx'), rows: [[t('Jami'), (q) => sum(num(q.total))], [t('1 kVt narxi'), (q) => (q.pricePerKw ? sumShort(q.pricePerKw) : '—')], [t('Chegirma'), (q) => (num(q.discountAmount) ? sumShort(num(q.discountAmount)) : '—')], [t('O‘zini oqlash'), (q) => (q.paybackRange ? t('{a}–{b} yil', { a: formatDecimal(q.paybackRange[0], 1), b: formatDecimal(q.paybackRange[1], 1) }) : '—')]] },
  { title: t('Uskuna'), rows: [[t('Quvvat'), (q) => (q.systemPowerKw ? kw(num(q.systemPowerKw)) : '—')], [t('Tarkib'), (q) => q.items.filter((i) => i.itemType === 'EQUIPMENT').map((i) => `${i.titleSnapshot} × ${num(i.quantity)}`).join('; ') || '—']] },
  { title: t('Montaj va muddat'), rows: [[t('Montaj'), (q) => sumShort(num(q.installationSubtotal))], [t('Muddat'), (q) => days(q.durationDays)], [t('Amal qiladi'), (q) => formatDate(q.validUntil)]] },
  { title: t('Kafolat'), rows: [[t('Uskuna'), (q) => months(q.warrantyEquipmentMonths)], [t('Montaj'), (q) => months(q.warrantyInstallationMonths)]] },
  { title: t('Moliyalashtirish'), rows: [[t('Variant'), (q) => q.financingOptions.map((f) => `${f.providerName}${f.monthlyPayment ? `: ${sumShort(f.monthlyPayment)}/${t('oy')}` : ''}`).join('; ') || '—']] },
  { title: t('Do‘kon'), rows: [[t('Reyting'), (q) => `${formatRating(q.shop.ratingAvg)} (${q.shop.ratingCount})`], [t('Javob tezligi'), (q) => responseTime(q.shop.avgResponseMinutes) ?? '—']] },
];

/** U9.6: takliflarni solishtirish — belgilar faqat haqiqiy taqqoslashdan, "Faqat farqlar" mobilda default. */
export function CompareQuotesPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const data = useQuery({ queryKey: ['quote-compare', id], queryFn: () => dealsService.compare(id) });
  const [diffOnly, setDiffOnly] = useState(() => window.matchMedia?.('(max-width: 720px)').matches ?? false);
  if (data.isLoading) return <PageLoader />;
  if (data.isError || !data.data) return <Alert tone="danger">{getErrorMessage(data.error)}</Alert>;
  const quotes = data.data.quotes;
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Takliflarni solishtirish')}</h1><p><Link to={`/mijoz/sorovlar/${id}`}>{t('So‘rov №{n}', { n: data.data.request.number })}</Link> · {t('O‘zini oqlash muddati sizning hisobingiz bo‘yicha, taklif narxi bilan qayta hisoblangan.')}</p></div>
        <label className="qs-check"><input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} /> {t('Faqat farqlarni ko‘rsatish')}</label>
      </div>
      {quotes.length < 2 && <Alert tone="info">{t('Solishtirish uchun kamida 2 ta taklif kerak.')}</Alert>}
      <div className="qs-compare">
        <table>
          <thead>
            <tr>
              <th />
              {quotes.map((q) => (
                <th key={q.id}>
                  <div className="qs-compare__head">
                    <strong>{q.shop.name}</strong>
                    <span className="qs-num">{sum(num(q.total))}</span>
                    <span className="qs-chips">{q.badges.map((b) => <Badge key={b} tone="success">{BADGE_TEXT[b]}</Badge>)}{q.expiringSoon && <Badge tone="warning">{t('Muddati tugayapti')}</Badge>}</span>
                    {['SENT', 'VIEWED'].includes(q.status) ? <Button size="sm" onClick={() => navigate(`/mijoz/takliflar/${q.id}`)}>{t('Tanlash')}</Button> : <Badge tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</Badge>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => {
              const rows = g.rows.filter(([, fn]) => !diffOnly || new Set(quotes.map(fn)).size > 1);
              if (!rows.length) return null;
              return [
                <tr key={g.title} className="qs-compare__group"><th colSpan={quotes.length + 1}>{g.title}</th></tr>,
                ...rows.map(([label, fn]) => (
                  <tr key={`${g.title}-${label}`}><th scope="row">{label}</th>{quotes.map((q) => <td key={q.id}>{fn(q)}</td>)}</tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
