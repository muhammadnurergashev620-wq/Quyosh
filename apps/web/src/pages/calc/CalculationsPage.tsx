import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { calcService } from '@/features/calc/calc.service';
import { kw, kwh, LIMITING, sumShort, SYSTEM_TYPE, years } from '@/features/calc/labels';
import type { SavedCalculationRow } from '@/features/calc/types';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate } from '@/lib/utils';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/calc/calc.css';

/** U10.3: hisoblar ro‘yxati; 2–3 tasini belgilab solishtirish. */
export function CalculationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['calculations'], queryFn: calcService.list });
  const [selected, setSelected] = useState<string[]>([]);
  const archive = useMutation({ mutationFn: (id: string) => calcService.archive(id), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['calculations'] }) });
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length < 3 ? [...current, id] : current));
  if (list.isLoading) return <PageLoader />;
  if (list.isError) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Hisoblarim')}</h1><p>{t('Saqlangan hisoblar o‘zgarmaydi; yangi tarif bilan «Qayta hisoblash» yangi yozuv yaratadi.')}</p></div>
        <div className="qs-page__actions">
          {selected.length >= 2 && <Button variant="secondary" onClick={() => navigate(`/mijoz/hisoblar/solishtirish?ids=${selected.join(',')}`)}>{t('Solishtirish ({n})', { n: selected.length })}</Button>}
          <Link className="gm-button gm-button--primary gm-button--md" to="/mijoz/kalkulyator"><Plus size={16} /> {t('Yangi hisob')}</Link>
        </div>
      </div>
      {!list.data?.length ? (
        <EmptyState icon={<BarChart3 size={30} />} title={t('Hali hisob saqlanmagan')} action={<Link className="gm-button gm-button--primary gm-button--md" to="/mijoz/kalkulyator">{t('Hisoblash')}</Link>} />
      ) : (
        <div className="qs-table-wrap">
          <table className="qs-table">
            <thead><tr><th /><th>{t('Hisob')}</th><th>{t('Tizim')}</th><th className="qs-right">{t('Oylik tejash')}</th><th className="qs-right">{t('Narx')}</th><th className="qs-right">{t('Qoplanish')}</th><th /></tr></thead>
            <tbody>
              {list.data.map((row) => (
                <tr key={row.id}>
                  <td><input type="checkbox" aria-label={t('Solishtirishga')} checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /></td>
                  <td>
                    <div className="qs-cell-title">
                      <Link to={`/mijoz/natija/${row.id}`}><strong>{row.title || (row.site?.title ?? t('Hisob'))}</strong></Link>
                      <small>{formatDate(row.createdAt)} · {row.mode === 'QUICK' ? t('Tez') : t('Batafsil')} · {row.modelVersion}</small>
                      {row.outdated && <Badge tone="warning">{t('Eski tarif/model bilan · Qayta hisoblash')}</Badge>}
                    </div>
                  </td>
                  <td>{kw(row.systemPowerKw)} · {SYSTEM_TYPE[row.systemType].title}</td>
                  <td className="qs-right qs-num">{row.monthlySaving === null ? '—' : sumShort(row.monthlySaving)}</td>
                  <td className="qs-right qs-num">{sumShort(row.initialCost)}</td>
                  <td className="qs-right qs-num">{row.simplePaybackYears === null ? '—' : years(row.simplePaybackYears)}</td>
                  <td className="qs-right"><Button size="sm" variant="ghost" onClick={() => archive.mutate(row.id)}>{t('Arxivlash')}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const ROWS: Array<[string, (row: SavedCalculationRow) => string]> = [
  [t('Tizim turi'), (r) => SYSTEM_TYPE[r.systemType].title],
  [t('Quvvat'), (r) => kw(r.systemPowerKw)],
  [t('Panellar'), (r) => String(r.panelCount)],
  [t('Akkumulyator'), (r) => (r.batteryKwh ? `${r.batteryKwh} kWh` : '—')],
  [t('Yillik ishlab chiqarish'), (r) => kwh(r.annualGenerationKwh)],
  [t('O‘zini ta’minlash'), (r) => `${Math.round(r.selfSufficiency * 100)} %`],
  [t('Oylik tejash'), (r) => (r.monthlySaving === null ? '—' : sumShort(r.monthlySaving))],
  [t('Narx'), (r) => sumShort(r.initialCost)],
  [t('Qoplanish'), (r) => (r.simplePaybackYears === null ? '—' : years(r.simplePaybackYears))],
  ['NPV', (r) => (r.npv === null ? '—' : sumShort(r.npv))],
  [t('Cheklovchi omil'), (r) => LIMITING[r.limitingFactor]],
];

export function CompareCalculationsPage() {
  const [params] = useSearchParams();
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const compare = useQuery({ queryKey: ['calculations', 'compare', ids], queryFn: () => calcService.compare(ids), enabled: ids.length >= 2 });
  if (compare.isLoading) return <PageLoader />;
  if (compare.isError || !compare.data) return <Alert tone="danger">{getErrorMessage(compare.error)}</Alert>;
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Hisoblarni solishtirish')}</h1></div></div>
      <div className="qs-table-wrap">
        <table className="qs-table qs-compare">
          <thead><tr><th />{compare.data.map((row) => <th key={row.id}><Link to={`/mijoz/natija/${row.id}`}>{row.title || formatDate(row.createdAt)}</Link></th>)}</tr></thead>
          <tbody>
            {ROWS.map(([label, get]) => {
              const values = compare.data.map(get);
              const differs = new Set(values).size > 1;
              return <tr key={label}><th scope="row">{label}</th>{values.map((v, i) => <td key={i} className={cx('qs-num', differs && 'is-diff')}>{v}</td>)}</tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
