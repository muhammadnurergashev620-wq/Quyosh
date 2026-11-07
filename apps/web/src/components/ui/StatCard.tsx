import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCountUp } from '@/hooks/useCountUp';
import { formatDecimal, formatNumber } from '@/lib/format';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import { Skeleton } from './Skeleton';
import './system.css';

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'teal' | 'neutral';

export interface StatCardProps {
  label: string;
  /** Raqam (sanaladi) yoki tayyor matn. `null`/`undefined` — «—» va «Ma’lumot hali yo‘q». */
  value: number | string | null | undefined;
  unit?: string;
  /** Raqam formatlash: kasr xonalari soni (standart 0 — butun). */
  digits?: number;
  icon?: ReactNode;
  tone?: StatTone;
  /** Trend: ulush (0,12 = +12 %); musbat — ▲ success, manfiy — ▼ danger. */
  trend?: number | null;
  trendLabel?: string;
  /** Pastki izoh qatori. */
  note?: ReactNode;
  /** Mini sparkline qiymatlari. */
  spark?: number[];
  loading?: boolean;
  variant?: 'default' | 'compact' | 'hero';
  to?: string;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - ((v - min) / span) * 26 - 2] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  return (
    <svg className="gm-stat__spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L100,30 L0,30 Z`} className="gm-stat__spark-area" />
      <path d={line} className="gm-stat__spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Value({ value, digits = 0 }: { value: number; digits?: number }) {
  const shown = useCountUp(value);
  return <>{shown == null ? '—' : digits ? formatDecimal(shown, digits) : formatNumber(shown)}</>;
}

/**
 * KPI kartasi (U5.2) — hamma panelda yagona: label + ikonka-quti, Onest 800 qiymat (sanaladi), alohida birlik,
 * trend (▲/▼ belgisi + rang), ixtiyoriy sparkline, skeleton; ma’lumot yo‘q bo‘lsa «—».
 */
export function StatCard({ label, value, unit, digits, icon, tone = 'primary', trend, trendLabel, note, spark, loading, variant = 'default', to, onClick, className, children }: StatCardProps) {
  const empty = value === null || value === undefined || value === '';
  const body = (
    <>
      <div className="gm-stat__head">
        <span className="gm-stat__label">{label}</span>
        {icon && <span className={cx('gm-icon-box', `gm-icon-box--${tone}`)} aria-hidden="true">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="gm-stat__skeleton" />
      ) : (
        <div className="gm-stat__value">
          <strong>{empty ? '—' : typeof value === 'number' ? <Value value={value} digits={digits} /> : value}</strong>
          {!empty && unit && <span className="gm-stat__unit">{unit}</span>}
        </div>
      )}
      {!loading && empty && <span className="gm-stat__note">{t('Ma’lumot hali yo‘q')}</span>}
      {!loading && !empty && trend != null && Number.isFinite(trend) && (
        <span className={cx('gm-stat__trend', trend >= 0 ? 'is-up' : 'is-down')}>
          <span>{trend >= 0 ? '▲' : '▼'} {formatDecimal(Math.abs(trend) * 100, 1)} %</span>
          {trendLabel && <span className="gm-stat__trend-label">{trendLabel}</span>}
        </span>
      )}
      {!loading && !empty && note && <span className="gm-stat__note">{note}</span>}
      {spark && !loading && <Spark values={spark} />}
      {children}
    </>
  );
  const cls = cx('gm-stat', `gm-stat--${variant}`, `gm-stat--${tone}`, (to || onClick) && 'is-clickable', className);
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/** KPI to‘ri: 4 ustun (≥ 1100 px), 2 ustun (planshet), 1 ustun (telefon) — yolg‘iz karta qolmaydi. */
export function StatGrid({ children, columns = 4, className }: { children: ReactNode; columns?: 2 | 3 | 4; className?: string }) {
  return <div className={cx('gm-stat-grid', `gm-stat-grid--${columns}`, className)}>{children}</div>;
}
