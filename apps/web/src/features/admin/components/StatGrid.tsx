import type { CSSProperties, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import { statusLabel } from '@/lib/labels';
import { t } from '@/i18n';

/**
 * Keng ekranda qatorlar to‘liq to‘lishi uchun har bir karta qancha ustunni egallashi (12 ustunli to‘r):
 * 5 ta → 3+2, 7 ta → 4+3, 10 ta → 4+3+3. Yetim karta ham, siqilib ketgan karta ham qolmaydi.
 */
function rowSpans(count: number): number[] {
  const perRow = count <= 4 ? Math.max(1, count) : count % 4 === 0 ? 4 : count % 3 === 0 ? 3 : 4;
  const rows = Math.ceil(count / perRow);
  const spans: number[] = [];
  let left = count;
  for (let row = 0; row < rows; row += 1) {
    const size = Math.ceil(left / (rows - row));
    for (let i = 0; i < size; i += 1) spans.push(12 / size);
    left -= size;
  }
  return spans;
}

export type StatTone = 'ok' | 'warn' | 'danger';

export function StatGrid({ items, balanced = false }: { items: Array<{ label: string; value: string | number; icon?: ReactNode; to?: string; tone?: StatTone; hint?: string }>; balanced?: boolean }) {
  const spans = balanced ? rowSpans(items.length) : [];
  return (
    <div className={balanced ? 'gm-stat-grid gm-stat-grid--bal' : 'gm-stat-grid'}>
      {items.map((item, index) => {
        const long = String(item.value).length > 9;
        const span = balanced ? ({ '--qs-span': spans[index] } as CSSProperties) : undefined;
        const content = (
          <>
            {item.icon && (
              <span className="gm-stat__icon" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span className="gm-stat__value">{item.value}</span>
            <span className="gm-stat__label">{item.label}</span>
            {item.hint && <span className="gm-stat__hint">{item.hint}</span>}
            {item.to && <ChevronRight className="gm-stat__go" size={16} aria-hidden="true" />}
          </>
        );
        return item.to ? (
          <Link key={item.label} to={item.to} className={cx('gm-stat gm-stat--clickable', long && 'gm-stat--long', item.tone && `gm-stat--${item.tone}`)} style={span}>
            {content}
          </Link>
        ) : (
          <div key={item.label} className={cx('gm-stat', long && 'gm-stat--long', item.tone && `gm-stat--${item.tone}`)} style={span}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

interface CountValue {
  count: number;
  amount?: string | number;
}

function toCount(value: unknown): CountValue {
  if (typeof value === 'number') return { count: value };
  if (typeof value === 'object' && value !== null) {
    const { count, amount } = value as { count?: unknown; amount?: unknown };
    return { count: Number(count ?? 0), amount: amount === undefined ? undefined : (amount as string | number) };
  }
  return { count: Number(value ?? 0) };
}

const GOOD = new Set(['COMPLETED', 'VERIFIED', 'ACTIVE', 'SUCCEEDED', 'RESOLVED', 'CONFIRMED']);
const BAD = new Set(['CANCELLED', 'FAILED', 'REJECTED', 'BLOCKED', 'DISPUTED', 'EXPIRED', 'SUSPENDED', 'DELETED', 'DISMISSED', 'REFUNDED']);

function countTone(key: string): 'ok' | 'bad' | 'warn' | 'neutral' {
  if (GOOD.has(key)) return 'ok';
  if (BAD.has(key)) return 'bad';
  if (/PENDING|REVIEW|WAITING|CORRECTION|REPORTED|PROCESSING/.test(key)) return 'warn';
  return 'neutral';
}

/** Holatlar bo‘yicha taqsimot: eng ko‘pi tepada, rangli nuqta (yaxshi/yomon/kutilmoqda), ulush va jami. */
export function CountList({ title, counts }: { title: string; counts: Record<string, unknown> }) {
  const entries = Object.entries(counts)
    .map(([key, value]) => [key, toCount(value)] as const)
    .sort((a, b) => b[1].count - a[1].count);
  const total = entries.reduce((sum, [, value]) => sum + value.count, 0);
  const max = Math.max(1, ...entries.map(([, value]) => value.count));

  return (
    <div className="gm-count-card">
      <div className="gm-count-card__head">
        <h3>{title}</h3>
        <span className="gm-count-card__total">{total}</span>
      </div>
      {entries.length === 0 ? (
        <p className="gm-card__meta">{t('Ma’lumot yo‘q')}</p>
      ) : (
        <ul className="gm-count-list">
          {entries.map(([key, value]) => (
            <li key={key} className={`gm-count-list__item gm-count-list__item--${countTone(key)}`}>
              <div className="gm-count-list__row">
                <span className="gm-count-list__name">
                  <i aria-hidden="true" />
                  {statusLabel(key)}
                </span>
                <strong>
                  {value.count}
                  <small>{total > 0 ? `${Math.round((value.count / total) * 100)}%` : '0%'}</small>
                </strong>
              </div>
              {value.amount !== undefined && Number(value.amount) > 0 && <div className="gm-count-list__amount">{formatMoney(value.amount)}</div>}
              <div className="gm-count-list__bar">
                <span style={{ width: `${Math.max(4, (value.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
