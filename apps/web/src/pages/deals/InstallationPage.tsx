import { ErrorState } from '@/components/ui/ErrorState';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, ClipboardCheck, MessageCircle, PartyPopper, Wrench } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/Button.helpers';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { kw, SYSTEM_TYPE, sum } from '@/features/calc/labels';
import { Stars } from '@/features/deals/components/QuoteDetails';
import { useCurrentShop } from '@/features/shop/current-shop';
import { dealsService } from '@/features/deals/deals.service';
import { INSTALLATION_STATUS, months, num, TIMELINE } from '@/features/deals/labels';
import type { ChecklistAnswer, ChecklistTemplateItem, InstallationStatus, InstallationView } from '@/features/deals/types';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/format';
import { contentText, t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/deals/deals.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TabBar } from '@/components/ui/Tabs';

const ORDER: InstallationStatus[] = ['AGREED', 'SITE_VISIT_SCHEDULED', 'INSTALLATION_SCHEDULED', 'INSTALLED', 'CONFIRMED'];
const i18n = (value: Record<string, string> | undefined) => contentText(value);

/** U9.8: vertikal timeline — har bosqichda sana, kim belgiladi, izoh. */
function Timeline({ view }: { view: InstallationView }) {
  const reached = ORDER.indexOf(view.status);
  return (
    <ol className="qs-steps-v">
      {TIMELINE.map((step, i) => {
        const event = [...view.history].reverse().find((h) => h.status === step.status);
        const done = reached > i || view.status === 'CONFIRMED';
        const current = reached === i && view.status !== 'CONFIRMED';
        if (step.status === 'SITE_VISIT_SCHEDULED' && !event && reached > i) return null;
        return (
          <li key={step.status} className={cx(done && 'is-done', current && 'is-current')}>
            <i aria-hidden />
            <div>
              <strong>{step.label}</strong>
              {event && <small>{formatDateTime(event.at)} · {event.side === 'SHOP' ? t('do‘kon') : event.side === 'CUSTOMER' ? t('siz') : event.side === 'ADMIN' ? t('admin') : t('tizim')}{event.note ? ` · ${event.note}` : ''}</small>}
              {step.status === 'INSTALLATION_SCHEDULED' && view.scheduledDate && !event?.note && <small> · {formatDate(view.scheduledDate)}</small>}
            </div>
          </li>
        );
      })}
      {(view.status === 'DISPUTED' || view.status === 'CANCELLED') && (
        <li className="is-current"><i aria-hidden /><div><strong>{INSTALLATION_STATUS[view.status].label}</strong><small>{view.disputeReason ?? view.cancelReason ?? ''}</small></div></li>
      )}
    </ol>
  );
}

/** U9.9: chek-list — OK / Muammo bor / Tegishli emas; "Muammo bor" — izoh majburiy; majburiy rasm — kamera. */
function Checklist({ view, onDone }: { view: InstallationView; onDone: () => void }) {
  const template = view.checklist?.items ?? [];
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswer>>(() => Object.fromEntries((view.checklist?.result ?? []).map((a) => [a.code, a])));
  const [uploading, setUploading] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const timer = useRef<number>();
  const save = useMutation({ mutationFn: (items: ChecklistAnswer[]) => dealsService.saveChecklist(view.id, items) });
  const list = useMemo(() => Object.values(answers), [answers]);

  // Avtosaqlash (sahifadan chiqib ketsa ham javoblar yo‘qolmaydi).
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save.mutate(list), 700);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const evaluation = save.data?.evaluation ?? view.checklist?.evaluation;
  const set = (code: string, patch: Partial<ChecklistAnswer>) => setAnswers((cur) => ({ ...cur, [code]: { code, status: cur[code]?.status ?? 'OK', ...cur[code], ...patch } }));
  const missingLocal = template.filter((item) => item.required && !answers[item.code]).map((item) => item.code);
  const localErrors = template.flatMap((item) => {
    const a = answers[item.code];
    if (!a) return [];
    const out: string[] = [];
    if (a.status === 'ISSUE' && !a.comment?.trim()) out.push(t('«{x}» — muammoni yozing', { x: i18n(item.titleI18n) }));
    if (item.photoRequired && a.status !== 'NA' && !a.photoFileIds?.length) out.push(t('«{x}» — rasm majburiy', { x: i18n(item.titleI18n) }));
    if (item.photoRequired && a.status === 'NA') out.push(t('«{x}» — bu bandni o‘tkazib bo‘lmaydi', { x: i18n(item.titleI18n) }));
    return out;
  });
  const complete = missingLocal.length === 0 && localErrors.length === 0;
  const hasIssues = list.some((a) => a.status === 'ISSUE');
  const answered = template.filter((i) => answers[i.code]).length;

  async function photo(item: ChecklistTemplateItem, file: File | undefined) {
    if (!file) return;
    setUploading(item.code);
    setError('');
    try {
      const res = await dealsService.upload('Installation', view.id, file);
      set(item.code, { photoFileIds: [...(answers[item.code]?.photoFileIds ?? []), res.id] });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploading(null);
    }
  }

  const finish = () => {
    void queryClient.invalidateQueries({ queryKey: ['installation', view.id] });
    onDone();
  };
  const confirm = useMutation({ mutationFn: async (withIssues: boolean) => { await dealsService.saveChecklist(view.id, list); return dealsService.confirmInstallation(view.id, withIssues); }, onSuccess: finish });
  const fix = useMutation({ mutationFn: async () => { await dealsService.saveChecklist(view.id, list); return dealsService.requestFix(view.id); }, onSuccess: finish });
  const dispute = useMutation({ mutationFn: () => dealsService.dispute(view.id, disputeReason.trim()), onSuccess: () => { setDisputeOpen(false); finish(); } });

  return (
    <div className="qs-card">
      <header><h2><ClipboardCheck size={18} /> {t('Montajni qabul qilish chek-listi')}</h2>{save.isPending && <small className="qs-muted">{t('Saqlanmoqda…')}</small>}</header>
      <ul className="qs-cl">
        {template.map((item) => {
          const a = answers[item.code];
          return (
            <li key={item.code} className={cx(a?.status === 'ISSUE' && 'is-issue')}>
              <div className="qs-cl__head">
                <div>
                  <strong>{i18n(item.titleI18n)}{item.required ? '' : ` (${t('ixtiyoriy')})`}</strong>
                  {item.hintI18n && <small>{i18n(item.hintI18n)}</small>}
                </div>
                <TabBar variant="segmented" role="radiogroup" aria-label={i18n(item.titleI18n)}>
                  {(['OK', 'ISSUE', 'NA'] as const).map((st) => (
                    <button key={st} type="button" role="radio" aria-checked={a?.status === st} className={cx(a?.status === st && 'is-on', st === 'ISSUE' && 'is-issue')} onClick={() => set(item.code, { status: st })}>
                      {st === 'OK' ? t('OK') : st === 'ISSUE' ? t('Muammo bor') : t('Tegishli emas')}
                    </button>
                  ))}
                </TabBar>
              </div>
              {a?.status === 'ISSUE' && <Textarea label={t('Muammoni yozing')} required autoFocus value={a.comment ?? ''} maxLength={2000} onChange={(e) => set(item.code, { comment: e.target.value })} />}
              {(item.photoRequired || a?.status === 'ISSUE') && (
                <div className="qs-page__actions">
                  <label className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                    <Camera size={15} /> {item.photoRequired ? t('Rasmga olish (majburiy)') : t('Rasm qo‘shish')}
                    <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void photo(item, e.target.files?.[0])} />
                  </label>
                  {uploading === item.code && <small className="qs-muted">{t('Yuklanmoqda…')}</small>}
                  {!!a?.photoFileIds?.length && <Badge tone="success">{t('{n} ta rasm', { n: a.photoFileIds.length })}</Badge>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="qs-progress qs-mt-3">
        <div className="qs-progress__bar"><span style={{ width: `${template.length ? (answered / template.length) * 100 : 0}%` }} /></div>
        <strong className="qs-num">{t('{a} / {b} band', { a: answered, b: template.length })}</strong>
      </div>
      {!complete && (
        <Alert tone="info">
          {missingLocal.length > 0 && <p className="qs-m-0">{t('To‘ldirilmagan majburiy bandlar: {n}', { n: missingLocal.length })}</p>}
          {localErrors.map((e) => <p key={e} className="qs-m-0">{e}</p>)}
        </Alert>
      )}
      {evaluation && !evaluation.complete && complete && <small className="qs-muted">{t('Saqlanmoqda…')}</small>}
      {error && <Alert tone="danger">{error}</Alert>}
      {(confirm.isError || fix.isError) && <Alert tone="danger">{getErrorMessage(confirm.error ?? fix.error)}</Alert>}
      <div className="qs-form__actions qs-mt-3">
        {hasIssues ? (
          <>
            <Button variant="ghost" onClick={() => setDisputeOpen(true)}>{t('E’tiroz bildirish')}</Button>
            <Button variant="secondary" loading={fix.isPending} onClick={() => fix.mutate()}><Wrench size={15} /> {t('Do‘kondan tuzatishni so‘rash')}</Button>
            <Button disabled={!complete} loading={confirm.isPending} onClick={() => confirm.mutate(true)}>{t('Baribir qabul qilish')}</Button>
          </>
        ) : (
          <Button disabled={!complete} loading={confirm.isPending} onClick={() => confirm.mutate(false)}><CheckCircle2 size={16} /> {t('Tasdiqlash')}</Button>
        )}
      </div>
      {fix.isSuccess && <Alert tone="success">{t('Do‘konga yozishmada xabar yuborildi. Tuzatilgach chek-listni qayta tekshiring.')}</Alert>}
      <Modal open={disputeOpen} onClose={() => setDisputeOpen(false)} title={t('E’tiroz bildirish')} footer={<Button variant="danger" disabled={disputeReason.trim().length < 5} loading={dispute.isPending} onClick={() => dispute.mutate()}>{t('Yuborish')}</Button>}>
        <p className="qs-muted">{t('E’tirozni admin ko‘rib chiqadi. Chek-listdagi rasmlar va izohlar ham unga ko‘rinadi.')}</p>
        <Textarea label={t('Sabab')} required value={disputeReason} maxLength={2000} onChange={(e) => setDisputeReason(e.target.value)} />
        {dispute.isError && <Alert tone="danger">{getErrorMessage(dispute.error)}</Alert>}
      </Modal>
    </div>
  );
}

/** U9.10: sharh — faqat qabul qilingan montajdan keyin; yuborishdan oldin ko‘rinish. */
function ReviewForm({ view, onDone }: { view: InstallationView; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [preview, setPreview] = useState(false);
  const create = useMutation({ mutationFn: () => dealsService.createReview(view.id, rating, comment.trim() || undefined), onSuccess: onDone });
  if (create.isSuccess) {
    return <Alert tone="success">{create.data.moderationStatus === 'PUBLISHED' ? t('Sharhingiz e’lon qilindi') : t('Sharhingiz tekshiruvdan keyin chiqadi')}</Alert>;
  }
  return (
    <div className="qs-card">
      <h2>{t('{shop} haqida sharh', { shop: view.shop.name })}</h2>
      {preview ? (
        <div className="qs-review">
          <Stars value={rating} />
          {comment.trim() && <p className="qs-m-0 qs-pre-line">{comment.trim()}</p>}
          <small className="qs-muted">{t('Sharh ostida ismingiz va tizim quvvati ko‘rsatiladi.')}</small>
          <div className="qs-form__actions"><Button variant="ghost" onClick={() => setPreview(false)}>{t('Tahrirlash')}</Button><Button loading={create.isPending} onClick={() => create.mutate()}>{t('Yuborish')}</Button></div>
        </div>
      ) : (
        <div className="qs-form">
          <Stars value={rating} onChange={setRating} />
          <Textarea label={t('Izoh (ixtiyoriy)')} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} hint={t('{n} / 2000', { n: comment.length })} />
          <div className="qs-form__actions"><Button disabled={rating < 1} onClick={() => setPreview(true)}>{t('Ko‘rib chiqish')}</Button></div>
        </div>
      )}
      {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
    </div>
  );
}

/** Do‘kon amallari (U11.5): sana belgilash, "Montaj bajarildi", bekor qilish. */
function ShopActions({ view }: { view: InstallationView }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(view.scheduledDate?.slice(0, 10) ?? '');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const act = useMutation({
    mutationFn: (body: Parameters<typeof dealsService.updateInstallation>[1]) => dealsService.updateInstallation(view.id, body),
    onSuccess: () => { setCancelOpen(false); void queryClient.invalidateQueries({ queryKey: ['installation', view.id] }); },
  });
  const canSchedule = ['AGREED', 'SITE_VISIT_SCHEDULED', 'INSTALLATION_SCHEDULED'].includes(view.status);
  return (
    <div className="qs-card">
      <h2>{t('Montaj amallari')}</h2>
      {canSchedule && (
        <div className="qs-form__row qs-items-end">
          <Input label={t('Montaj sanasi')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button variant="secondary" disabled={!date} loading={act.isPending} onClick={() => act.mutate({ action: 'SCHEDULE', scheduledDate: date })}>{view.status === 'INSTALLATION_SCHEDULED' ? t('Sanani o‘zgartirish') : t('Sanani belgilash')}</Button>
        </div>
      )}
      <div className="qs-form__actions qs-mt-3">
        {canSchedule && <Button variant="ghost" onClick={() => setCancelOpen(true)}>{t('Bekor qilish')}</Button>}
        {view.status === 'INSTALLATION_SCHEDULED' && <Button loading={act.isPending} onClick={() => act.mutate({ action: 'MARK_INSTALLED' })}>{t('Montaj bajarildi')}</Button>}
      </div>
      {view.status === 'INSTALLED' && <Alert tone="info">{t('Mijoz chek-listni to‘ldirib, montajni qabul qilishi kutilmoqda.')}</Alert>}
      {act.isError && <Alert tone="danger">{getErrorMessage(act.error)}</Alert>}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('Montajni bekor qilish')} footer={<Button variant="danger" disabled={!reason.trim()} loading={act.isPending} onClick={() => act.mutate({ action: 'CANCEL', reason: reason.trim() })}>{t('Bekor qilish')}</Button>}>
        <Textarea label={t('Sabab')} required value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}

/** U9.8–U9.10 (mijoz) va U11.5 (do‘kon): montaj sahifasi. */
export function InstallationPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const view = useQuery({ queryKey: ['installation', id], queryFn: () => dealsService.installation(id), refetchInterval: 30_000 });
  const [celebrate, setCelebrate] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const cancel = useMutation({ mutationFn: () => dealsService.updateInstallation(id, { action: 'CANCEL', reason: reason.trim() }), onSuccess: () => { setCancelOpen(false); void view.refetch(); } });
  if (view.isLoading) return <PageLoader />;
  if (view.isError || !view.data) return <ErrorState error={view.error} onRetry={() => void view.refetch()} />;
  const v = view.data;
  const customer = v.side === 'CUSTOMER';
  const chatLink = v.requestShopId ? (customer ? `/mijoz/chat/${v.requestShopId}` : `/dokon/sorovlar/${v.requestShopId}`) : null;
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div>
          <h1>{t('Montaj')} · {customer ? v.shop.name : `№${v.quote.request.number}`}</h1>
          <p>{v.quote.systemType ? SYSTEM_TYPE[v.quote.systemType].title : ''}{v.quote.systemPowerKw ? ` · ${kw(num(v.quote.systemPowerKw))}` : ''} · {sum(num(v.quote.total))}</p>
        </div>
        <div className="qs-page__actions">
          <StatusBadge map={INSTALLATION_STATUS} status={v.status} />
          {chatLink && <ButtonLink variant="secondary" to={chatLink}><MessageCircle size={16} /> {t('Yozishma')}</ButtonLink>}
          <ButtonLink variant="ghost" to={customer ? `/mijoz/takliflar/${v.quote.id}` : `/dokon/sorovlar/${v.requestShopId ?? ''}`}>{t('Taklif')}</ButtonLink>
        </div>
      </div>
      {customer && v.status === 'INSTALLED' && <Alert tone="warning" title={t('Do‘kon montaj bajarilganini bildirdi')}>{t('Tekshirib, chek-list orqali qabul qiling. Muammo bo‘lsa — yozing yoki e’tiroz bildiring.')}</Alert>}
      {celebrate && (
        <div className="qs-card qs-text-center">
          <PartyPopper size={44} color="var(--qs-color-accent)" />
          <h2>{t('Tabriklaymiz! Tizimingiz qabul qilindi')}</h2>
          <p className="qs-muted">{t('O‘rnatilgan tizim kartasi yaratildi — kafolat muddatlari va ishlab chiqarishni shu yerda kuzatasiz.')}</p>
        </div>
      )}
      <div className="qs-grid-2" style={{ alignItems: 'start' }}>
        <div className="qs-card"><h2>{t('Holat')}</h2><Timeline view={v} /></div>
        <div className="qs-page qs-gap-4">
          {!customer && <ShopActions view={v} />}
          {!customer && v.customer && (
            <div className="qs-card">
              <h2>{t('Mijoz')}</h2>
              <dl className="qs-dl"><div><dt>{t('Ism')}</dt><dd>{[v.customer.firstName, v.customer.lastName].filter(Boolean).join(' ')}</dd></div><div><dt>{t('Telefon')}</dt><dd>{v.customer.phone ? <a href={`tel:${v.customer.phone}`}>{v.customer.phone}</a> : '—'}</dd></div></dl>
            </div>
          )}
          <div className="qs-card">
            <h2>{t('Kafolat')}</h2>
            <dl className="qs-dl"><div><dt>{t('Uskuna')}</dt><dd>{months(v.quote.warrantyEquipmentMonths)}</dd></div><div><dt>{t('Montaj')}</dt><dd>{months(v.quote.warrantyInstallationMonths)}</dd></div></dl>
            {v.installedSystem && <p className="qs-muted qs-mb-0">{t('O‘rnatilgan tizim: {p}, {d}', { p: kw(num(v.installedSystem.systemPowerKw)), d: formatDate(v.installedSystem.installedAt) })}</p>}
          </div>
          {customer && ['AGREED', 'SITE_VISIT_SCHEDULED', 'INSTALLATION_SCHEDULED'].includes(v.status) && <Button variant="ghost" onClick={() => setCancelOpen(true)}>{t('Montajni bekor qilish')}</Button>}
        </div>
      </div>
      {customer && v.status === 'INSTALLED' && v.checklist && <Checklist view={v} onDone={() => { setCelebrate(true); void view.refetch(); }} />}
      {!customer && v.checklist && ['INSTALLED', 'CONFIRMED', 'DISPUTED'].includes(v.status) && v.checklist.result.length > 0 && (
        <div className="qs-card">
          <h2>{t('Chek-list natijasi')}</h2>
          <ul className="qs-cl">
            {v.checklist.items.map((item) => {
              const a = v.checklist!.result.find((r) => r.code === item.code);
              return <li key={item.code} className={cx(a?.status === 'ISSUE' && 'is-issue')}><div className="qs-cl__head"><div><strong>{i18n(item.titleI18n)}</strong>{a?.comment && <small>{a.comment}</small>}</div><Badge tone={a?.status === 'ISSUE' ? 'warning' : a?.status === 'OK' ? 'success' : 'neutral'}>{a ? (a.status === 'OK' ? 'OK' : a.status === 'ISSUE' ? t('Muammo bor') : t('Tegishli emas')) : '—'}</Badge></div></li>;
            })}
          </ul>
        </div>
      )}
      {customer && v.status === 'CONFIRMED' && !v.review && <ReviewForm view={v} onDone={() => void queryClient.invalidateQueries({ queryKey: ['installation', id] })} />}
      {v.review && (
        <div className="qs-card">
          <h2>{t('Sharh')}</h2>
          <div className="qs-review">
            <Stars value={v.review.rating} />
            {v.review.comment && <p className="qs-m-0">{v.review.comment}</p>}
            {customer && v.review.moderationStatus === 'PENDING' && <small className="qs-muted">{t('Sharhingiz tekshiruvdan keyin chiqadi')}</small>}
            {v.review.reply && <div className="qs-review__reply"><strong>{v.shop.name}:</strong> {v.review.reply.body}</div>}
          </div>
        </div>
      )}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('Montajni bekor qilish')} footer={<Button variant="danger" disabled={!reason.trim()} loading={cancel.isPending} onClick={() => cancel.mutate()}>{t('Bekor qilish')}</Button>}>
        <Textarea label={t('Sabab')} required value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
        {cancel.isError && <Alert tone="danger">{getErrorMessage(cancel.error)}</Alert>}
      </Modal>
    </div>
  );
}

/** Mijoz: montajlar ro‘yxati. */
export function CustomerInstallationsPage() {
  return <InstallationsList side="CUSTOMER" shopId={null} />;
}

/** Do‘kon (U11.5): montajlar ro‘yxati. */
export function ShopInstallationsPage() {
  const { shopId } = useCurrentShop();
  if (!shopId) return <PageLoader />;
  return <InstallationsList side="SHOP" shopId={shopId} />;
}

function InstallationsList({ side, shopId }: { side: 'CUSTOMER' | 'SHOP'; shopId: string | null }) {
  const list = useQuery({ queryKey: ['installations', side, shopId], queryFn: () => (side === 'SHOP' && shopId ? dealsService.shopInstallations(shopId) : dealsService.installations()) });
  if (list.isLoading) return <PageLoader />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  const base = side === 'SHOP' ? '/dokon/montajlar' : '/mijoz/montajlar';
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Montajlar')}</h1><p>{side === 'SHOP' ? t('Tanlangan takliflaringiz bo‘yicha montajlar.') : t('Tanlangan do‘konlar bilan montaj jarayoni.')}</p></div></div>
      {!list.data?.length ? (
        <EmptyState icon={<Wrench size={30} />} title={t('Hali montaj yo‘q')} description={side === 'SHOP' ? t('Mijoz taklifingizni tanlaganda montaj shu yerda paydo bo‘ladi.') : t('Taklifni tanlaganingizdan keyin montaj shu yerda kuzatiladi.')} />
      ) : (
        <div className="qs-req-list">
          {list.data.map((row) => (
            <Link key={row.id} className="qs-req-card" to={`${base}/${row.id}`}>
              <div>
                <h3>{side === 'SHOP' ? [row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ') || t('Mijoz') : row.shop.name} · №{row.quote.request.number}</h3>
                <div className="qs-req-card__meta">
                  <span>{row.quote.systemPowerKw ? kw(num(row.quote.systemPowerKw)) : ''}</span>
                  <span>{sum(num(row.quote.total))}</span>
                  {row.scheduledDate && <span>{t('Montaj: {d}', { d: formatDate(row.scheduledDate) })}</span>}
                </div>
              </div>
              <div className="qs-req-card__side"><StatusBadge map={INSTALLATION_STATUS} status={row.status} /></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
