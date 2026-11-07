import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { sum } from '@/features/calc/labels';
import { cx } from '@/lib/utils';
import { formatDate, formatDecimal, formatRelativeTime } from '@/lib/format';
import { t } from '@/i18n';
import { dealsService } from '../deals.service';
import { days, ITEM_TYPE, months, num } from '../labels';
import type { QuoteView } from '../types';
import { SelectMenu } from '@/components/ui/SelectMenu';

/** Revision snapshot va joriy taklif uchun yagona ko‘rinish (farqlarni solishtirish uchun). */
export interface QuoteSnap {
  total: string; equipmentSubtotal: string; installationSubtotal: string; deliveryCost: string; otherCosts: string; discountAmount: string;
  vatIncluded: boolean; vatRate: string; vatAmount: string; systemPowerKw: string | null;
  warrantyEquipmentMonths: number | null; warrantyInstallationMonths: number | null; warrantyText: string | null;
  durationDays: number | null; includedScope: string | null; excludedScope: string | null; validUntil: string | null;
  exchangeRateUsd: string | null; exchangeRateDate: string | null;
  items: Array<{ itemType: string; title: string; quantity: string; unitPrice: string; lineTotal: string }>;
  financingOptions: Array<{ providerName: string; annualRate: string; termMonths: number; monthlyPayment?: number | null }>;
}

const s = (v: unknown) => (v === null || v === undefined ? null : String(v));

function snapOf(q: QuoteView): QuoteSnap {
  return {
    total: String(q.total), equipmentSubtotal: String(q.equipmentSubtotal), installationSubtotal: String(q.installationSubtotal), deliveryCost: String(q.deliveryCost),
    otherCosts: String(q.otherCosts), discountAmount: String(q.discountAmount), vatIncluded: q.vatIncluded, vatRate: String(q.vatRate), vatAmount: String(q.vatAmount),
    systemPowerKw: s(q.systemPowerKw), warrantyEquipmentMonths: q.warrantyEquipmentMonths, warrantyInstallationMonths: q.warrantyInstallationMonths, warrantyText: q.warrantyText,
    durationDays: q.durationDays, includedScope: q.includedScope, excludedScope: q.excludedScope, validUntil: q.validUntil?.slice(0, 10) ?? null,
    exchangeRateUsd: s(q.exchangeRateUsd), exchangeRateDate: q.exchangeRateDate?.slice(0, 10) ?? null,
    items: q.items.map((i) => ({ itemType: i.itemType, title: i.titleSnapshot, quantity: String(i.quantity), unitPrice: String(i.unitPrice), lineTotal: String(i.lineTotal) })),
    financingOptions: q.financingOptions.map((f) => ({ providerName: f.providerName, annualRate: String(f.annualRate), termMonths: f.termMonths, monthlyPayment: f.monthlyPayment })),
  };
}

/** O‘zgargan qiymat: sun-100 fon, eski qiymat chizilgan (U9.5). */
function Diff({ now, before, render }: { now: unknown; before?: unknown; render: (v: never) => ReactNode }) {
  const changed = before !== undefined && String(before ?? '') !== String(now ?? '');
  if (!changed) return <>{now === null || now === undefined ? '—' : render(now as never)}</>;
  return (
    <span>
      <span className="qs-diff-old">{before === null || before === undefined || before === '' ? '—' : render(before as never)}</span>
      <span className="qs-diff">{now === null || now === undefined ? '—' : render(now as never)}</span>
    </span>
  );
}

const money = (v: string) => sum(num(v));
const qty = (v: string) => formatDecimal(num(v), 3);

function QuoteBody({ snap, prev }: { snap: QuoteSnap; prev?: QuoteSnap | null }) {
  const p = prev ?? undefined;
  const pItem = (i: number) => p?.items[i];
  return (
    <div className="qs-page" style={{ gap: 'var(--qs-space-4)' }}>
      <div className="qs-table-wrap">
        <table className="qs-table qs-quote-lines">
          <thead><tr><th>{t('Mahsulot / xizmat')}</th><th>{t('Miqdor')}</th><th>{t('Birlik narxi')}</th><th>{t('Jami')}</th></tr></thead>
          <tbody>
            {snap.items.map((item, i) => (
              <tr key={`${item.title}-${i}`}>
                <td><div className="qs-cell-title"><strong><Diff now={item.title} before={pItem(i)?.title} render={(v: string) => v} /></strong><small>{ITEM_TYPE[item.itemType]}</small></div></td>
                <td><Diff now={item.quantity} before={pItem(i)?.quantity} render={qty} /></td>
                <td><Diff now={item.unitPrice} before={pItem(i)?.unitPrice} render={money} /></td>
                <td><Diff now={item.lineTotal} before={pItem(i)?.lineTotal} render={money} /></td>
              </tr>
            ))}
            {p && p.items.length > snap.items.length && p.items.slice(snap.items.length).map((item, i) => (
              <tr key={`old-${i}`}><td colSpan={4}><span className="qs-diff-old">{item.title} — {money(item.lineTotal)}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="qs-sums">
        <div><span>{t('Uskuna')}</span><Diff now={snap.equipmentSubtotal} before={p?.equipmentSubtotal} render={money} /></div>
        <div><span>{t('Montaj')}</span><Diff now={snap.installationSubtotal} before={p?.installationSubtotal} render={money} /></div>
        {(num(snap.deliveryCost) > 0 || num(p?.deliveryCost) > 0) && <div><span>{t('Yetkazish')}</span><Diff now={snap.deliveryCost} before={p?.deliveryCost} render={money} /></div>}
        {(num(snap.otherCosts) > 0 || num(p?.otherCosts) > 0) && <div><span>{t('Qo‘shimcha')}</span><Diff now={snap.otherCosts} before={p?.otherCosts} render={money} /></div>}
        {(num(snap.discountAmount) > 0 || num(p?.discountAmount) > 0) && <div><span>{t('Chegirma')}</span><span>− <Diff now={snap.discountAmount} before={p?.discountAmount} render={money} /></span></div>}
        <div><span>{snap.vatIncluded ? t('shu jumladan QQS {r}%', { r: num(snap.vatRate) }) : t('QQS {r}%', { r: num(snap.vatRate) })}</span><Diff now={snap.vatAmount} before={p?.vatAmount} render={money} /></div>
        <div className="is-total"><span>{t('Jami')}</span><Diff now={snap.total} before={p?.total} render={money} /></div>
      </div>
      <dl className="qs-quote-card__facts">
        <div><dt>{t('Kafolat: uskuna')}</dt><dd><Diff now={snap.warrantyEquipmentMonths} before={p?.warrantyEquipmentMonths} render={months} /></dd></div>
        <div><dt>{t('Kafolat: montaj')}</dt><dd><Diff now={snap.warrantyInstallationMonths} before={p?.warrantyInstallationMonths} render={months} /></dd></div>
        <div><dt>{t('Montaj muddati')}</dt><dd><Diff now={snap.durationDays} before={p?.durationDays} render={days} /></dd></div>
        <div><dt>{t('Amal qiladi')}</dt><dd><Diff now={snap.validUntil} before={p?.validUntil} render={(v: string) => formatDate(v)} /></dd></div>
      </dl>
      <div className="qs-grid-2">
        <div><h3 style={{ margin: '0 0 6px', fontSize: 14 }}>{t('Narxga kiradi')}</h3><p className="qs-scope"><Diff now={snap.includedScope} before={p?.includedScope} render={(v: string) => v} /></p></div>
        <div><h3 style={{ margin: '0 0 6px', fontSize: 14 }}>{t('Narxga kirmaydi')}</h3><p className="qs-scope"><Diff now={snap.excludedScope} before={p?.excludedScope} render={(v: string) => v} /></p></div>
      </div>
      {snap.warrantyText && <div><h3 style={{ margin: '0 0 6px', fontSize: 14 }}>{t('Kafolat shartlari')}</h3><p className="qs-scope">{snap.warrantyText}</p></div>}
      {snap.financingOptions.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>{t('Moliyalashtirish')}</h3>
          <ul className="qs-list">
            {snap.financingOptions.map((f) => (
              <li key={f.providerName}>{f.providerName}: {t('{r}% yillik, {n} oy', { r: formatDecimal(num(f.annualRate) * 100, 2), n: f.termMonths })}{f.monthlyPayment ? ` · ${t('oyiga ≈ {s}', { s: sum(f.monthlyPayment) })}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
      {snap.exchangeRateUsd && <small className="qs-muted">{t('USD narxlar MB kursi bo‘yicha o‘girilgan: 1 USD = {r} so‘m ({d})', { r: formatDecimal(num(snap.exchangeRateUsd), 2), d: snap.exchangeRateDate ?? '' })}</small>}
    </div>
  );
}

/** "Tahrir 3 · 2 kun oldin" tanlagichi + oldingi tahrir bilan farq (U9.5). */
export function QuoteWithRevisions({ quote }: { quote: QuoteView }) {
  const [revision, setRevision] = useState(quote.currentRevision);
  const current = revision === quote.currentRevision;
  const selected = useQuery({ queryKey: ['quote-rev', quote.id, revision], queryFn: () => dealsService.revision(quote.id, revision), enabled: !current && revision > 0 });
  const previous = useQuery({ queryKey: ['quote-rev', quote.id, revision - 1], queryFn: () => dealsService.revision(quote.id, revision - 1), enabled: revision > 1 });
  const snap = current ? snapOf(quote) : (selected.data?.snapshotJson as unknown as QuoteSnap | undefined);
  const prev = revision > 1 ? (previous.data?.snapshotJson as unknown as QuoteSnap | undefined) : undefined;
  return (
    <div className="qs-page" style={{ gap: 'var(--qs-space-3)' }}>
      {quote.revisions.length > 0 && (
        <div className="qs-page__actions">
          <SelectMenu className="qs-select" aria-label={t('Tahrir')} value={revision} onChange={(e) => setRevision(Number(e.target.value))}>
            {quote.revisions.map((r) => <option key={r.revision} value={r.revision}>{t('Tahrir {n} · {ago}', { n: r.revision, ago: formatRelativeTime(r.createdAt) })}</option>)}
          </SelectMenu>
          {revision > 1 && <small className="qs-muted"><span className="qs-diff">{t('o‘zgargan')}</span> — {t('oldingi tahrirga nisbatan')}</small>}
        </div>
      )}
      {snap ? <QuoteBody snap={snap} prev={prev ?? null} /> : <p className="qs-muted">{t('Yuklanmoqda…')}</p>}
    </div>
  );
}

export function Stars({ value, onChange, size = 26 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  if (!onChange) return <span className="qs-stars--static" aria-label={t('{n} / 5', { n: value })}>{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>;
  return (
    <div
      className="qs-stars"
      role="radiogroup"
      aria-label={t('Baho')}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, value + 1)); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(1, value - 1)); }
      }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={t('{n} yulduz', { n })} tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1} className={cx(n <= value && 'is-on')} onClick={() => onChange(n)}>
          <Star size={size} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}
