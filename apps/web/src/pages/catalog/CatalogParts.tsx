import { Checkbox } from '@/components/ui/Checkbox';
import { Link, useNavigate } from 'react-router-dom';
import { BatteryCharging, Cable, Grid3x3, Package, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCompare } from '@/features/catalog/compare-store';
import { keySpecs, sum } from '@/features/catalog/format';
import type { CatalogItem } from '@/features/catalog/types';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';

/** Rasm yuklanmagan modellar uchun kategoriya belgisi (bosh saytda foto ishlatilmaydi — U1.4). */
export function CategoryGlyph({ slug, size = 48 }: { slug: string; size?: number }) {
  if (slug === 'quyosh-panellari') return <Grid3x3 size={size} strokeWidth={1.4} aria-hidden="true" />;
  if (slug === 'invertorlar') return <Zap size={size} strokeWidth={1.4} aria-hidden="true" />;
  if (slug === 'akkumulyatorlar') return <BatteryCharging size={size} strokeWidth={1.4} aria-hidden="true" />;
  if (slug === 'kabel-va-himoya') return <Cable size={size} strokeWidth={1.4} aria-hidden="true" />;
  return <Package size={size} strokeWidth={1.4} aria-hidden="true" />;
}

export function ProductCard({ item }: { item: CatalogItem }) {
  const compare = useCompare();
  const pushToast = useAppStore((s) => s.pushToast);
  const inCompare = compare.items.some((entry) => entry.id === item.id);
  return (
    <Link to={`/mijoz/mahsulotlar/${item.slug}`} className="qs-pcard">
      <div className="qs-pcard__media"><CategoryGlyph slug={item.category.slug} /></div>
      <span className="qs-pcard__compare" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          inline
          label={t('Solishtirish')}
          checked={inCompare}
          onChange={() => {
            if (!compare.toggle({ id: item.id, slug: item.slug, label: `${item.brand} ${item.model}` })) pushToast(t('Bir vaqtda 4 tagacha mahsulot solishtiriladi'), 'info');
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </span>
      <div className="qs-pcard__body">
        <span className="qs-pcard__brand">{item.brand}</span>
        <span className="qs-pcard__name">{item.model}</span>
        <ul className="qs-pcard__specs">{keySpecs(item).slice(0, 3).map((line) => <li key={line}>{line}</li>)}</ul>
        <div className="qs-pcard__price">
          {item.minPriceUzs ? (
            <>
              <strong>{t('{price} dan', { price: sum(item.minPriceUzs) })}</strong>
              <small>{t('{n} ta taklif', { n: item.offerCount })}{item.inStock ? ` · ${t('mavjud')}` : ''}</small>
            </>
          ) : (
            <small>{t('Narx so‘rov orqali')}</small>
          )}
        </div>
      </div>
    </Link>
  );
}

export function CompareBar() {
  const navigate = useNavigate();
  const { items, remove, clear } = useCompare();
  if (items.length === 0) return null;
  return (
    <div className="qs-comparebar" role="region" aria-label={t('Solishtirish')}>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.label}
            <button type="button" aria-label={t('{name} ni olib tashlash', { name: item.label })} onClick={() => remove(item.id)}><X size={14} /></button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" onClick={clear}>{t('Tozalash')}</Button>
      <Button size="sm" disabled={items.length < 2} onClick={() => navigate('/mijoz/solishtirish')}>{t('Solishtirish ({n})', { n: items.length })}</Button>
    </div>
  );
}
