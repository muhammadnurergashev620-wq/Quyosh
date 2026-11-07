import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { calcService } from '@/features/calc/calc.service';
import { sum, sumShort } from '@/features/calc/labels';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate, formatPercent } from '@/lib/format';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/calc/calc.css';

/** U8.12: kredit kalkulyatori — mahsulotlarni tanlab solishtirish. */
export function FinancingPage() {
  const reference = useQuery({ queryKey: ['calc', 'reference'], queryFn: calcService.reference, staleTime: 10 * 60_000 });
  const [cost, setCost] = useState('60000000');
  const [down, setDown] = useState('15000000');
  const [saving, setSaving] = useState('');
  const [term, setTerm] = useState(24);
  const [picked, setPicked] = useState<string[]>([]);
  const products = reference.data?.financing ?? [];
  const chosen = picked.length ? products.filter((p) => picked.includes(p.id)) : products.slice(0, 2);
  const minPct = Math.max(0, ...chosen.map((p) => Number(p.minDownPaymentPct)));
  const minDown = Math.ceil(Number(cost) * minPct);
  const downTooLow = Number(cost) > 0 && minDown > 0 && (Number(down) || 0) < minDown;
  const run = useMutation({
    mutationFn: () => Promise.all((picked.length ? picked : products.slice(0, 2).map((p) => p.id)).map(async (productId) => {
      const product = products.find((p) => p.id === productId)!;
      const terms = product.allowedTerms.length ? product.allowedTerms : [term];
      const result = await calcService.financing({ initialCost: Number(cost), downPayment: Number(down) || 0, productId, termMonths: terms.includes(term) ? term : terms[0]!, monthlySaving: saving ? new Array(12).fill(Number(saving)) : undefined });
      return { product, result };
    })),
  });
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Kredit kalkulyatori')}</h1><p>{t('Tizim narxi va tejash bo‘yicha oylik to‘lovni solishtiring.')}</p></div></div>
      <section className="qs-card qs-form">
        <div className="qs-form__row">
          <Input label={t('Tizim narxi, so‘m')} inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ''))} />
          <Input label={t('Boshlang‘ich to‘lov, so‘m')} inputMode="numeric" value={down} onChange={(e) => setDown(e.target.value.replace(/\D/g, ''))}
            error={downTooLow ? t('Kamida {p} % — {s}', { p: Math.round(minPct * 100), s: sum(minDown) }) : undefined} />
          <Input label={t('Oylik tejash (ixtiyoriy), so‘m')} inputMode="numeric" value={saving} onChange={(e) => setSaving(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="qs-chips">{[6, 12, 18, 24, 36].map((n) => <button key={n} type="button" className={cx('qs-chip', term === n && 'is-on')} onClick={() => setTerm(n)}>{t('{n} oy', { n })}</button>)}</div>
        <div className="qs-choice">
          {products.map((p) => (
            <button key={p.id} type="button" className={cx(picked.includes(p.id) && 'is-on')} onClick={() => setPicked((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id].slice(-3)))}>
              <strong>{p.providerName}</strong>
              <small>{formatPercent(Number(p.annualRate), 1)} · {p.allowedTerms.join(', ')} {t('oy')} · {t('min. {p} %', { p: Math.round(Number(p.minDownPaymentPct) * 100) })}</small>
              {p.verifiedAt && <small>{t('Manba tekshirilgan: {d}', { d: formatDate(p.verifiedAt) })}</small>}
            </button>
          ))}
        </div>
        {!products.length && <Alert tone="info">{t('Hozircha tasdiqlangan moliyalashtirish mahsuloti yo‘q.')}</Alert>}
        <div className="qs-form__actions">
          {downTooLow && <Button variant="secondary" onClick={() => setDown(String(minDown))}>{t('Eng kam summani qo‘yish')}</Button>}
          <Button loading={run.isPending} disabled={!products.length || !Number(cost) || downTooLow} onClick={() => run.mutate()}>{t('Hisoblash')}</Button></div>
        {run.isError && <Alert tone="danger">{getErrorMessage(run.error)}</Alert>}
      </section>
      {run.data && (
        <div className="qs-grid-3">
          {run.data.map(({ product, result }) => (
            <section key={product.id} className="qs-card">
              <h2>{product.providerName}</h2>
              <dl className="qs-dl">
                <dt>{t('Oylik to‘lov')}</dt><dd><b>{result.firstPayment === result.lastPayment ? sum(result.firstPayment) : `${sumShort(result.firstPayment)} → ${sumShort(result.lastPayment)}`}</b></dd>
                <dt>{t('Jami to‘lov')}</dt><dd>{sum(result.totalPaid)}</dd>
                <dt>{t('Ortiqcha to‘lov')}</dt><dd>{sum(result.overpayment)}</dd>
                {saving && <><dt>{t('Cho‘ntakdan (oyiga)')}</dt><dd>{sum(result.schedule[0]?.net ?? 0)}</dd><dt>{t('Tejash qoplaydigan oy')}</dt><dd>{result.breakEvenMonth ? t('{n}-oy', { n: result.breakEvenMonth }) : '—'}</dd></>}
              </dl>
            </section>
          ))}
        </div>
      )}
      <Alert tone="info">{t('Bu taxminiy hisob. Yakuniy shartlarni bank yoki sotuvchi belgilaydi; platforma kredit bermaydi va tasdiqlamaydi.')}</Alert>
    </div>
  );
}
