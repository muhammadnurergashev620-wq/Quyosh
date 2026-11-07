import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Scale, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { catalogService } from '@/features/catalog/catalog.service';
import { useCompare } from '@/features/catalog/compare-store';
import { SPEC_META, specValue } from '@/features/catalog/format';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/catalog/catalog.css';
import { Chip } from '@/components/ui/Chip';

/** U7.5: solishtirish — ustunlar mahsulotlar, qatorlar xususiyatlar; farqlar va eng yaxshi qiymat belgilanadi. */
export function ComparePage() {
  const { items, remove } = useCompare();
  const [onlyDiff, setOnlyDiff] = useState(false);
  const ids = items.map((item) => item.id);
  const result = useQuery({ queryKey: ['catalog', 'compare', ids], queryFn: () => catalogService.compare(ids), enabled: ids.length >= 2 });

  if (ids.length < 2) {
    return (
      <div className="qs-page">
        <EmptyState icon={<Scale size={30} />} title={t('Solishtirish uchun kamida 2 ta mahsulot tanlang')} action={<Link className="gm-button gm-button--primary gm-button--md" to="/mijoz/mahsulotlar">{t('Katalogga o‘tish')}</Link>} />
      </div>
    );
  }
  if (result.isLoading) return <PageLoader />;
  if (result.isError || !result.data) return <Alert tone="danger">{getErrorMessage(result.error)}</Alert>;
  const rows = result.data.rows.filter((row) => !onlyDiff || row.differs);

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Solishtirish')}</h1><p>{t('★ — eng yaxshi qiymat; rangli katak — farqli qiymat.')}</p></div>
        <label className="qs-check"><input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> {t('Faqat farqlarni ko‘rsatish')}</label>
      </div>
      <div className="qs-table-wrap">
        <table className="qs-table qs-compare">
          <thead>
            <tr>
              <th />
              {result.data.models.map((model) => (
                <th key={model.id}>
                  <div className="qs-cell-title">
                    <Link to={`/mijoz/mahsulotlar/${model.slug}`}><strong>{model.brand} {model.model}</strong></Link>
                    <Chip onClick={() => remove(model.id)}><X size={12} /> {t('Olib tashlash')}</Chip>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{SPEC_META[row.key].label}</th>
                {row.values.map((value, index) => (
                  <td key={index} className={cx('qs-num', row.differs && 'is-diff', row.best.includes(index) && 'is-best')}>{specValue(row.key, value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Alert tone="info">{t('Uskunalar mosligi tekshiruvi kalkulyator bilan birga qo‘shiladi. Bu dastlabki texnik ma’lumot; yakuniy loyihani montajchi tasdiqlaydi.')}</Alert>
    </div>
  );
}
