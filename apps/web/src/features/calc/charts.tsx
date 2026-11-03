import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { cx, formatNumber } from '@/lib/utils';
import { monthShort } from './labels';
import { t } from '@/i18n';
import './charts.css';

/**
 * Yengil SVG grafiklar (dataviz: bitta o‘q, ingichka belgilar, 4px yumaloq uchlar, 2px oraliq, legend ≥ 2 seriyada,
 * hover tooltip, jadval ko‘rinishi). Ranglar — validatsiyadan o‘tgan `--qs-chart-gen` / `--qs-chart-load` tokenlari.
 */
export interface Series {
  name: string;
  color: 'gen' | 'load';
  values: number[];
}

const W = 640;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

function niceMax(value: number) {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const n = value / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}

const compact = (value: number) => (Math.abs(value) >= 1e6 ? `${(value / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}M` : Math.abs(value) >= 1e3 ? `${(value / 1e3).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}k` : formatNumber(value));

function Frame({ title, legend, table, children }: { title: string; legend?: Series[]; table: ReactNode; children: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="qs-chart">
      <figcaption>
        <strong>{title}</strong>
        {legend && legend.length > 1 && (
          <span className="qs-chart__legend">
            {legend.map((s) => <span key={s.name}><i className={`is-${s.color}`} aria-hidden="true" />{s.name}</span>)}
          </span>
        )}
        <button type="button" className="qs-chart__toggle" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>{showTable ? t('Grafik') : t('Jadval')}</button>
      </figcaption>
      {showTable ? <div className="qs-chart__table">{table}</div> : children}
    </figure>
  );
}

function Grid({ max, unit }: { max: number; unit: string }) {
  const ticks = [0, 0.5, 1].map((k) => k * max);
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / max);
  return (
    <g className="qs-chart__grid">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
          <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end">{compact(v)}</text>
        </g>
      ))}
      <text x={4} y={PAD.top + 4} className="qs-chart__unit">{unit}</text>
    </g>
  );
}

/** Oylik guruhlangan ustunlar (1–2 seriya). */
export function MonthlyBars({ title, series, unit, format }: { title: string; series: Series[]; unit: string; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 0));
  const plotW = W - PAD.left - PAD.right;
  const slot = plotW / 12;
  const barW = Math.min(18, (slot - 6 - (series.length - 1) * 2) / series.length);
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / max);
  const table = (
    <table className="qs-table">
      <thead><tr><th>{t('Oy')}</th>{series.map((s) => <th key={s.name} className="qs-right">{s.name}</th>)}</tr></thead>
      <tbody>{Array.from({ length: 12 }, (_, m) => <tr key={m}><td>{monthShort(m + 1)}</td>{series.map((s) => <td key={s.name} className="qs-right qs-num">{format(s.values[m] ?? 0)}</td>)}</tr>)}</tbody>
    </table>
  );
  return (
    <Frame title={title} legend={series} table={table}>
      <div className="qs-chart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          <Grid max={max} unit={unit} />
          {Array.from({ length: 12 }, (_, m) => {
            const x0 = PAD.left + slot * m + (slot - (barW * series.length + 2 * (series.length - 1))) / 2;
            return (
              <g key={m}>
                {series.map((s, i) => {
                  const v = s.values[m] ?? 0;
                  const top = y(v);
                  const h = Math.max(0, H - PAD.bottom - top);
                  return <path key={s.name} className={cx('qs-chart__bar', `is-${s.color}`, hover !== null && hover !== m && 'is-dim')} d={roundedTop(x0 + i * (barW + 2), top, barW, h)} />;
                })}
                <text className="qs-chart__x" x={PAD.left + slot * m + slot / 2} y={H - 8} textAnchor="middle">{monthShort(m + 1)}</text>
                <rect x={PAD.left + slot * m} y={PAD.top} width={slot} height={H - PAD.top - PAD.bottom} fill="transparent" onMouseEnter={() => setHover(m)} onFocus={() => setHover(m)} tabIndex={0} aria-label={`${monthShort(m + 1)}: ${series.map((s) => `${s.name} ${format(s.values[m] ?? 0)}`).join(', ')}`} />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div className="qs-chart__tip" style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%` }}>
            <strong>{monthShort(hover + 1)}</strong>
            {series.map((s) => <span key={s.name}><i className={`is-${s.color}`} />{s.name}: <b>{format(s.values[hover] ?? 0)}</b></span>)}
          </div>
        )}
      </div>
    </Frame>
  );
}

/** Faqat yuqori burchaklari yumaloq ustun (asosga yopishgan). */
function roundedTop(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** «Quyosh kuni» (U8.10): soatlik ishlab chiqarish ustunlari va iste’mol chizig‘i. */
export function DayChart({ title, generation, load }: { title: string; generation: number[]; load: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...generation, ...load, 0));
  const plotW = W - PAD.left - PAD.right;
  const slot = plotW / 24;
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - v / max);
  const line = load.map((v, h) => `${h === 0 ? 'M' : 'L'}${PAD.left + slot * h + slot / 2},${y(v)}`).join(' ');
  const series: Series[] = [{ name: t('Ishlab chiqarish'), color: 'gen', values: generation }, { name: t('Iste’mol'), color: 'load', values: load }];
  const fmt = (v: number) => `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} kWh`;
  const table = (
    <table className="qs-table">
      <thead><tr><th>{t('Soat')}</th>{series.map((s) => <th key={s.name} className="qs-right">{s.name}</th>)}</tr></thead>
      <tbody>{generation.map((_, h) => <tr key={h}><td>{String(h).padStart(2, '0')}:00</td>{series.map((s) => <td key={s.name} className="qs-right qs-num">{fmt(s.values[h] ?? 0)}</td>)}</tr>)}</tbody>
    </table>
  );
  return (
    <Frame title={title} legend={series} table={table}>
      <div className="qs-chart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          <Grid max={max} unit="kWh" />
          {generation.map((v, h) => (
            <path key={h} className={cx('qs-chart__bar', 'is-gen', hover !== null && hover !== h && 'is-dim')} d={roundedTop(PAD.left + slot * h + 2, y(v), slot - 4, H - PAD.bottom - y(v))} />
          ))}
          <path className="qs-chart__line is-load" d={line} />
          {hover !== null && <circle className="qs-chart__dot is-load" cx={PAD.left + slot * hover + slot / 2} cy={y(load[hover] ?? 0)} r={4} />}
          {[0, 6, 12, 18, 23].map((h) => <text key={h} className="qs-chart__x" x={PAD.left + slot * h + slot / 2} y={H - 8} textAnchor="middle">{String(h).padStart(2, '0')}</text>)}
          {generation.map((_, h) => <rect key={h} x={PAD.left + slot * h} y={PAD.top} width={slot} height={H - PAD.top - PAD.bottom} fill="transparent" onMouseEnter={() => setHover(h)} />)}
        </svg>
        {hover !== null && (
          <div className="qs-chart__tip" style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%` }}>
            <strong>{String(hover).padStart(2, '0')}:00</strong>
            {series.map((s) => <span key={s.name}><i className={`is-${s.color}`} />{s.name}: <b>{fmt(s.values[hover] ?? 0)}</b></span>)}
          </div>
        )}
      </div>
    </Frame>
  );
}

/** 25 yillik jamg‘arilgan pul oqimi (bitta seriya): nol chizig‘i, almashtirish yillari belgisi. */
export function CashflowChart({ title, points, markers, format }: { title: string; points: Array<{ year: number; value: number }>; markers: number[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  const values = points.map((p) => p.value);
  const maxAbs = niceMax(Math.max(...values.map(Math.abs), 1));
  const min = Math.min(0, ...values) < 0 ? -maxAbs : 0;
  const max = Math.max(0, ...values) > 0 ? maxAbs : 0;
  const plotW = W - PAD.left - PAD.right;
  const x = (i: number) => PAD.left + (plotW * i) / Math.max(points.length - 1, 1);
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * ((max - v) / (max - min || 1));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const zeroIndex = points.findIndex((p) => p.value >= 0);
  const table = (
    <table className="qs-table">
      <thead><tr><th>{t('Yil')}</th><th className="qs-right">{t('Jamg‘arilgan')}</th></tr></thead>
      <tbody>{points.map((p) => <tr key={p.year}><td>{p.year}</td><td className="qs-right qs-num">{format(p.value)}</td></tr>)}</tbody>
    </table>
  );
  return (
    <Frame title={title} table={table}>
      <div className="qs-chart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--qs-chart-gen)" stopOpacity="0.28" /><stop offset="100%" stopColor="var(--qs-chart-gen)" stopOpacity="0" /></linearGradient>
          </defs>
          <g className="qs-chart__grid">
            {[min, 0, max].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
              <g key={v}><line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'is-zero' : undefined} /><text x={PAD.left - 6} y={y(v) + 4} textAnchor="end">{compact(v)}</text></g>
            ))}
          </g>
          <path d={`${path} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gradient})`} />
          <path className="qs-chart__line is-gen" d={path} />
          {markers.map((year) => { const i = points.findIndex((p) => p.year === year); return i >= 0 ? <circle key={year} className="qs-chart__marker" cx={x(i)} cy={y(points[i]!.value)} r={5} /> : null; })}
          {zeroIndex > 0 && <line className="qs-chart__break" x1={x(zeroIndex)} x2={x(zeroIndex)} y1={PAD.top} y2={H - PAD.bottom} />}
          {points.filter((_, i) => i % 5 === 0 || i === points.length - 1).map((p) => <text key={p.year} className="qs-chart__x" x={x(points.indexOf(p))} y={H - 8} textAnchor="middle">{p.year}</text>)}
          {hover !== null && <><line className="qs-chart__cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} /><circle className="qs-chart__dot is-gen" cx={x(hover)} cy={y(points[hover]!.value)} r={4} /></>}
          {points.map((_, i) => <rect key={i} x={x(i) - plotW / points.length / 2} y={PAD.top} width={plotW / points.length} height={H - PAD.top - PAD.bottom} fill="transparent" onMouseEnter={() => setHover(i)} />)}
        </svg>
        {hover !== null && (
          <div className="qs-chart__tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <strong>{t('{n}-yil', { n: points[hover]!.year })}</strong>
            <span>{format(points[hover]!.value)}{markers.includes(points[hover]!.year) ? ` · ${t('uskuna almashtirish')}` : ''}</span>
          </div>
        )}
      </div>
    </Frame>
  );
}

/** KPI diapazoni (konservativ … optimistik), markazda standart ssenariy. */
export function RangeBar({ low, base, high, format }: { low: number | null; base: number | null; high: number | null; format: (v: number) => string }) {
  if (low === null || base === null || high === null) return null;
  const a = Math.min(low, high);
  const b = Math.max(low, high);
  const pos = b === a ? 50 : ((base - a) / (b - a)) * 100;
  return (
    <div className="qs-range-bar" aria-label={t('Diapazon {a} – {b}', { a: format(a), b: format(b) })}>
      <div className="qs-range-bar__track"><span style={{ left: `${pos}%` }} /></div>
      <small>{format(a)} – {format(b)}</small>
    </div>
  );
}
