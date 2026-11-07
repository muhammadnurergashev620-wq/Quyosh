import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import './system.css';

/** Breadcrumb (desktop): oxirgi element — joriy sahifa. */
export function Breadcrumb({ items }: { items: Array<{ label: ReactNode; to?: string }> }) {
  return (
    <nav className="gm-crumbs" aria-label={t('Sahifa yo‘li')}>
      <ol>
        {items.map((item, i) => (
          <li key={i}>
            {item.to && i < items.length - 1 ? <Link to={item.to}>{item.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{item.label}</span>}
            {i < items.length - 1 && <ChevronRight aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Sahifalash: ‹ 1 2 … 9 › — joriy sahifa primary. */
export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  const list: Array<number | '…'> = [];
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p);
    else if (list[list.length - 1] !== '…') list.push('…');
  }
  return (
    <nav className="gm-pager" aria-label={t('Sahifalar')}>
      <button type="button" className="gm-pager__btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t('Oldingi sahifa')}><ChevronLeft aria-hidden="true" /></button>
      {list.map((p, i) => (p === '…' ? <span key={`e${i}`} className="gm-pager__gap">…</span> : (
        <button key={p} type="button" className={cx('gm-pager__btn', p === page && 'is-on')} aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>{p}</button>
      )))}
      <button type="button" className="gm-pager__btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={t('Keyingi sahifa')}><ChevronRight aria-hidden="true" /></button>
    </nav>
  );
}
