import { useId, useState } from 'react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';

const W = 900;
const H = 250;
const PAD = { top: 14, right: 16, bottom: 30, left: 48 };
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

/** «2026-10-09» → «9 okt» (brauzer vaqt mintaqasiga bog‘liq emas). */
function dayLabel(day: string): string {
  const [, month, date] = day.split('-').map(Number);
  return `${date} ${MONTHS[(month ?? 1) - 1]}`;
}

const niceMax = (value: number) => {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};
const compact = (value: number) => (value >= 1_000_000 ? `${+(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${+(value / 1000).toFixed(1)}K` : String(value));

/** To‘g‘ri chiziqli yo‘l: haqiqiy kunlik qiymatlar sun’iy egri chiziq bilan buzilmaydi (silliqlash soxta cho‘qqi/chuqurlik hosil qilardi). */
const polyline = (points: Array<[number, number]>) => points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Kartadagi kichik chiziqli grafik (sparkline). */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const id = useId().replace(/:/g, '');
  const SW = 120;
  const SH = 44;
  const max = Math.max(...values, 0);
  if (values.length < 2 || max <= 0) return <svg className="gm-spark" viewBox={`0 0 ${SW} ${SH}`} aria-hidden="true" preserveAspectRatio="none" style={{ color }}><line x1="0" x2={SW} y1={SH - 3} y2={SH - 3} stroke="currentColor" strokeWidth="2" strokeDasharray="3 4" opacity="0.5" vectorEffect="non-scaling-stroke" /></svg>;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * SW, SH - 4 - (v / max) * (SH - 10)] as [number, number]);
  return (
    <svg className="gm-spark" viewBox={`0 0 ${SW} ${SH}`} aria-hidden="true" preserveAspectRatio="none" style={{ color }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${polyline(pts)} L${SW},${SH} L0,${SH} Z`} fill={`url(#${id})`} />
      <path d={polyline(pts)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Kunlik qiymatlar grafigi. Qiymat yo‘q bo‘lsa — bo‘sh holat; ustiga olib borilganda sana va aniq qiymat. */
export function AreaChart({ points, format, unit, integer = false }: { points: Array<{ date: string; value: number }>; format?: (value: number) => string; unit?: string; integer?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const peak = Math.max(0, ...points.map((p) => p.value));
  if (points.length === 0 || peak <= 0) {
    return (
      <div className="gm-chart gm-chart--empty" role="status">
        <strong>{t('Bu davrda ma’lumot yo‘q')}</strong>
        <span>{t('Boshqa davrni tanlab ko‘ring.')}</span>
      </div>
    );
  }
  const max = integer ? Math.max(4, Math.ceil(peak / 4) * 4) : niceMax(peak);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const pts = points.map((p, i) => [x(i), y(p.value)] as [number, number]);
  const line = polyline(pts);
  const step = Math.max(1, Math.ceil(points.length / 9));
  const fmt = format ?? ((v: number) => String(Math.round(v)));
  const active = hover != null ? points[hover] : null;
  const peakIndex = points.findIndex((p) => p.value === peak);

  return (
    <div className="gm-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${unit ?? t('Grafik')}: ${t('eng yuqori {value} ({day})', { value: fmt(peak), day: dayLabel(points[peakIndex]!.date) })}`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line className="gm-chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(max * f)} y2={y(max * f)} />
            <text className="gm-chart__axis" x={PAD.left - 8} y={y(max * f) + 4} textAnchor="end">{compact(Math.round(max * f))}</text>
          </g>
        ))}
        {points.map((p, i) => (i % step === 0 || i === points.length - 1 ? <text key={p.date} className="gm-chart__axis" x={x(i)} y={H - 8} textAnchor="middle">{dayLabel(p.date)}</text> : null))}
        {pts.length > 1 && <path d={`${line} L${x(points.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`} fill={`url(#${id})`} />}
        <path className="gm-chart__line" d={line} />
        {points.length <= 31 && pts.map(([cx0, cy0], i) => (points[i]!.value > 0 || hover === i ? <circle key={points[i]!.date} className="gm-chart__dot" cx={cx0} cy={cy0} r={hover === i ? 5 : 3.2} /> : null))}
        {points.length > 2 && (
          <text className="gm-chart__peak" x={Math.min(Math.max(pts[peakIndex]![0], PAD.left + 70), W - PAD.right - 70)} y={Math.max(pts[peakIndex]![1] - 10, 12)} textAnchor="middle">{`${fmt(peak)} · ${dayLabel(points[peakIndex]!.date)}`}</text>
        )}
        {hover != null && <line className="gm-chart__cursor" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} />}
        {points.map((p, i) => <rect key={p.date} x={x(i) - innerW / points.length / 2} y={PAD.top} width={innerW / points.length} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} />)}
      </svg>
      {active && (
        <div className={cx('gm-chart__tip', hover! > points.length / 2 && 'gm-chart__tip--left')} style={{ left: `${(x(hover!) / W) * 100}%` }} role="tooltip">
          <strong>{dayLabel(active.date)}</strong>
          <span><i /> {fmt(active.value)}</span>
        </div>
      )}
    </div>
  );
}
