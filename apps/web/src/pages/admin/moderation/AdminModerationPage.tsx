import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Stars } from '@/features/deals/components/QuoteDetails';
import { adminDealsService } from '@/features/deals/deals.service';
import { sum } from '@/features/calc/labels';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/deals/deals.css';

const FLAG_TEXT: Record<string, string> = {
  SELF_REVIEW: t('O‘z do‘koniga sharh'),
  SHARED_DEVICE_WITH_SHOP: t('Do‘kon a’zosi bilan bir qurilma/IP'),
  NEW_ACCOUNT: t('Yangi akkaunt'),
  FAST_CONFIRM: t('Juda tez tasdiqlangan'),
  BURST: t('Qisqa vaqtda ko‘p sharh'),
  DUPLICATE_TEXT: t('Matn boshqa sharhga o‘xshash'),
  SAME_IP_CLUSTER: t('Bir IP dan bir necha akkaunt'),
  CONTACT_IN_TEXT: t('Matnda telefon/havola'),
};
type Tab = 'reviews' | 'complaints' | 'disputes' | 'settings';

function Reviews() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'PENDING' | 'PUBLISHED' | 'HIDDEN'>('PENDING');
  const list = useQuery({ queryKey: ['admin-reviews', status], queryFn: () => adminDealsService.reviews(status) });
  const act = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: 'PUBLISHED' | 'HIDDEN' }) => adminDealsService.moderate(id, decision), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }) });
  return (
    <>
      <div className="qs-tabs">{(['PENDING', 'PUBLISHED', 'HIDDEN'] as const).map((s) => <button key={s} type="button" className={cx(status === s && 'is-on')} onClick={() => setStatus(s)}>{s === 'PENDING' ? t('Tekshiruvda') : s === 'PUBLISHED' ? t('E’lon qilingan') : t('Yashirilgan')}</button>)}</div>
      {list.isLoading ? <PageLoader /> : !list.data?.length ? <EmptyState icon={<ShieldAlert size={30} />} title={t('Ro‘yxat bo‘sh')} /> : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Sharh')}</th><th>{t('Do‘kon')}</th><th>{t('Muallif')}</th><th>{t('Risk')}</th><th /></tr></thead>
            <tbody>
              {list.data.map((r) => (
                <tr key={r.id}>
                  <td><div className="qs-cell-title"><Stars value={r.rating} />{r.comment && <span>{r.comment}</span>}<small>{formatDateTime(r.createdAt)}</small></div></td>
                  <td>{r.shop.name}</td>
                  <td><div className="qs-cell-title"><strong>{[r.user.firstName, r.user.lastName].filter(Boolean).join(' ')}</strong><small>{r.user.phone} · {t('akkaunt: {d}', { d: formatDateTime(r.user.createdAt) })}</small></div></td>
                  <td><div className="qs-cell-title"><Badge tone={r.riskScore >= 40 ? 'danger' : r.riskScore > 0 ? 'warning' : 'success'}>{r.riskScore}</Badge>{r.riskFlags.map((f) => <small key={f}>{FLAG_TEXT[f] ?? f}</small>)}</div></td>
                  <td className="qs-right">
                    <div className="qs-page__actions" style={{ justifyContent: 'flex-end' }}>
                      {r.moderationStatus !== 'PUBLISHED' && !r.riskFlags.includes('SELF_REVIEW') && <Button size="sm" onClick={() => act.mutate({ id: r.id, decision: 'PUBLISHED' })}>{t('E’lon qilish')}</Button>}
                      {r.moderationStatus !== 'HIDDEN' && <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: r.id, decision: 'HIDDEN' })}>{t('Yashirish')}</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {act.isError && <Alert tone="danger">{getErrorMessage(act.error)}</Alert>}
    </>
  );
}

function Complaints() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED' | 'REJECTED'>('OPEN');
  const list = useQuery({ queryKey: ['admin-complaints', status], queryFn: () => adminDealsService.complaints(status) });
  const act = useMutation({ mutationFn: ({ id, s }: { id: string; s: 'RESOLVED' | 'REJECTED' }) => adminDealsService.resolveComplaint(id, s), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-complaints'] }) });
  return (
    <>
      <div className="qs-tabs">{(['OPEN', 'RESOLVED', 'REJECTED'] as const).map((s) => <button key={s} type="button" className={cx(status === s && 'is-on')} onClick={() => setStatus(s)}>{s === 'OPEN' ? t('Ochiq') : s === 'RESOLVED' ? t('Hal qilingan') : t('Rad etilgan')}</button>)}</div>
      {list.isLoading ? <PageLoader /> : !list.data?.length ? <EmptyState icon={<ShieldAlert size={30} />} title={t('Ro‘yxat bo‘sh')} /> : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Obyekt')}</th><th>{t('Sabab')}</th><th>{t('Tafsilot')}</th><th>{t('Sana')}</th><th /></tr></thead>
            <tbody>
              {list.data.map((c) => (
                <tr key={c.id}>
                  <td><div className="qs-cell-title"><strong>{c.targetType}</strong><small className="qs-mono">{c.targetId.slice(0, 8)}</small>{!c.reporterId && <Badge tone="warning">{t('Avtomatik')}</Badge>}</div></td>
                  <td>{c.reason}</td>
                  <td style={{ maxWidth: 380 }}>{c.details ?? '—'}</td>
                  <td>{formatDateTime(c.createdAt)}</td>
                  <td className="qs-right">{c.status === 'OPEN' && <div className="qs-page__actions" style={{ justifyContent: 'flex-end' }}><Button size="sm" onClick={() => act.mutate({ id: c.id, s: 'RESOLVED' })}>{t('Hal qilindi')}</Button><Button size="sm" variant="ghost" onClick={() => act.mutate({ id: c.id, s: 'REJECTED' })}>{t('Rad etish')}</Button></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Disputes() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['admin-disputes'], queryFn: adminDealsService.disputes });
  const [target, setTarget] = useState<{ id: string; decision: 'CONFIRMED' | 'CANCELLED' } | null>(null);
  const [note, setNote] = useState('');
  const act = useMutation({ mutationFn: () => adminDealsService.resolveDispute(target!.id, target!.decision, note.trim()), onSuccess: () => { setTarget(null); setNote(''); void queryClient.invalidateQueries({ queryKey: ['admin-disputes'] }); } });
  return (
    <>
      {list.isLoading ? <PageLoader /> : !list.data?.length ? <EmptyState icon={<ShieldAlert size={30} />} title={t('Ochiq e’tiroz yo‘q')} /> : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th>{t('Montaj')}</th><th>{t('Mijoz')}</th><th>{t('Sabab')}</th><th /></tr></thead>
            <tbody>
              {list.data.map((d) => (
                <tr key={d.id}>
                  <td><div className="qs-cell-title"><strong>{d.shop.name} · №{d.quote.request.number}</strong><small>{sum(Number(d.quote.total))} · {formatDateTime(d.updatedAt)}</small></div></td>
                  <td>{[d.user.firstName, d.user.lastName].filter(Boolean).join(' ')}<br /><small className="qs-muted">{d.user.phone}</small></td>
                  <td style={{ maxWidth: 380 }}>{d.disputeReason}</td>
                  <td className="qs-right"><div className="qs-page__actions" style={{ justifyContent: 'flex-end' }}><Button size="sm" onClick={() => setTarget({ id: d.id, decision: 'CONFIRMED' })}>{t('Qabul qilingan deb belgilash')}</Button><Button size="sm" variant="ghost" onClick={() => setTarget({ id: d.id, decision: 'CANCELLED' })}>{t('Bekor qilish')}</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!target} onClose={() => setTarget(null)} title={target?.decision === 'CONFIRMED' ? t('Montajni qabul qilingan deb belgilash') : t('Montajni bekor qilish')} footer={<Button disabled={note.trim().length < 3} loading={act.isPending} onClick={() => act.mutate()}>{t('Saqlash')}</Button>}>
        <Textarea label={t('Qaror izohi (ikkala tomonga ko‘rinadi)')} required value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
        {act.isError && <Alert tone="danger">{getErrorMessage(act.error)}</Alert>}
      </Modal>
    </>
  );
}

const SETTING_FIELDS: Array<[string, string]> = [
  ['pendingThreshold', t('Tekshiruvga tushish chegarasi (ball)')],
  ['newAccountDays', t('Yangi akkaunt (kun)')],
  ['fastConfirmHours', t('Tez tasdiq (soat)')],
  ['burstCount', t('Sharhlar portlashi (24 soatda)')],
  ['duplicateSimilarity', t('Matn o‘xshashligi (0..1)')],
  ['ipClusterAccounts', t('Bir IP dan akkauntlar')],
  ['autoComplaintBlockedCount', t('Avto-shikoyat: rad etilganlar (30 kunda)')],
];

function Settings() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ['moderation-settings'], queryFn: adminDealsService.settings });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const rules = { ...data.data!.rules } as Record<string, unknown> & { scores: Record<string, number> };
      const scores = { ...rules.scores };
      for (const [k, v] of Object.entries(draft)) {
        if (k.startsWith('score:')) scores[k.slice(6)] = Number(v);
        else rules[k] = Number(v);
      }
      return adminDealsService.saveSettings({ ...rules, scores });
    },
    onSuccess: () => { setDraft({}); void queryClient.invalidateQueries({ queryKey: ['moderation-settings'] }); },
  });
  if (data.isLoading || !data.data) return <PageLoader />;
  const r = data.data.rules;
  const val = (k: string, v: unknown) => draft[k] ?? String(v);
  return (
    <div className="qs-card">
      <header><h2>{t('Moderatsiya chegaralari')}</h2><small className="qs-muted">{t('Versiya {v}', { v: data.data.version })}</small></header>
      <div className="qs-form">
        <div className="qs-form__row">{SETTING_FIELDS.map(([k, label]) => <Input key={k} label={label} inputMode="decimal" value={val(k, r[k])} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />)}</div>
        <h3 style={{ margin: 0, fontSize: 15 }}>{t('Belgilar bali')}</h3>
        <div className="qs-form__row">{Object.entries(r.scores).map(([k, v]) => <Input key={k} label={FLAG_TEXT[k] ?? k} inputMode="numeric" value={val(`score:${k}`, v)} onChange={(e) => setDraft((d) => ({ ...d, [`score:${k}`]: e.target.value }))} />)}</div>
        <div className="qs-form__actions"><Button disabled={!Object.keys(draft).length} loading={save.isPending} onClick={() => save.mutate()}>{t('Yangi versiyani saqlash')}</Button></div>
        {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
      </div>
    </div>
  );
}

/** Admin (REVIEWS huquqi): sharhlar moderatsiyasi, shikoyatlar, montaj e’tirozlari, sozlamalar. */
export function AdminModerationPage() {
  const [tab, setTab] = useState<Tab>('reviews');
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Sharhlar va shikoyatlar')}</h1><p>{t('Risk belgilari sababi faqat adminga ko‘rinadi (TZ 13.4).')}</p></div></div>
      <div className="qs-tabs" role="tablist">
        {([['reviews', t('Sharhlar')], ['complaints', t('Shikoyatlar')], ['disputes', t('Montaj e’tirozlari')], ['settings', t('Sozlamalar')]] as Array<[Tab, string]>).map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={cx(tab === k && 'is-on')} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === 'reviews' && <Reviews />}
      {tab === 'complaints' && <Complaints />}
      {tab === 'disputes' && <Disputes />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}
