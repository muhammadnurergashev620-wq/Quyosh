import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatDateTime, formatDayMonth, formatNumber, formatTime } from '@/lib/utils';
import type { DevOpsTrafficPoint, DevOpsWindow } from '../types';
import { t } from '@/i18n';
import './DevOpsCharts.css';

export type SparkTone = 'primary' | 'success' | 'warning' | 'danger' | 'violet';

/** KPI kartalardagi kichik maydon grafigi. Nuqtalar yetarli bo‘lmasa, halol xabar ko‘rsatiladi. */
export function Sparkline({ values, tone = 'primary', max }: { values: number[]; tone?: SparkTone; max?: number }) {
  const gradient = useId();
  if (values.length < 2) return <p className="gm-spark gm-spark--empty">{t('Ma’lumot to‘planmoqda…')}</p>;
  // Foiz ko‘rsatkichlarida (max=100) o‘zgarishlar ko‘rinishi uchun miqyos qiymatlar atrofida olinadi.
  const top = max !== undefined ? Math.min(max, Math.max(...values) + 8) : Math.max(...values, 1);
  const low = max !== undefined ? Math.max(0, Math.min(...values) - 8) : Math.min(...values, top) * 0.6;
  const x = (i: number) => (i / (values.length - 1)) * 100;
  const y = (v: number) => 30 - ((v - low) / Math.max(top - low, 1)) * 26;
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  return (
    <svg className={`gm-spark gm-spark--${tone}`} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,32 L0,32 Z`} fill={`url(#${gradient})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const HEIGHT = 220;
const PAD = { left: 40, right: 10, top: 12, bottom: 26 };

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10) * pow;
}

function label(at: string, window: DevOpsWindow): string {
  return window === '1h' || window === '24h' ? formatTime(at) : formatDayMonth(at);
}

/** API trafigi: so‘rovlar chizig‘i (maydon) va xato ustunlari; sichqoncha ostida aniq qiymatlar. */
export function TrafficChart({ data, window }: { data: DevOpsTrafficPoint[]; window: DevOpsWindow }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  const total = useMemo(() => data.reduce((sum, point) => sum + point.count, 0), [data]);
  const max = niceMax(Math.max(...data.map((point) => point.count), 1));

  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const line = data.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(point.count).toFixed(1)}`).join(' ');
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const labelStep = Math.max(1, Math.round(data.length / (width < 480 ? 4 : 6)));
  const barW = Math.max(2, Math.min(10, plotW / Math.max(data.length, 1) - 2));
  const maxErr = Math.max(...data.map((point) => point.errors), 0);

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left - PAD.left) / plotW;
    setHover(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))));
  };
  const point = hover !== null ? data[hover] : null;

  return (
    <div className="gm-dochart" ref={ref}>
      {total === 0 ? (
        <p className="gm-dochart__empty">{t('Bu davrda hali so‘rov qayd etilmagan.')}</p>
      ) : (
        width > 0 && (
          <>
            <svg width={width} height={HEIGHT} role="img" aria-label={t('API so‘rovlar soni vaqt bo‘yicha')} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--qs-color-primary)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--qs-color-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {ticks.map((tick) => (
                <g key={tick}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="gm-dochart__grid" />
                  <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="gm-dochart__tick">{formatNumber(Math.round(tick))}</text>
                </g>
              ))}
              {data.map((p, i) => i % labelStep === 0 && (
                <text key={p.at} x={x(i)} y={HEIGHT - 6} textAnchor="middle" className="gm-dochart__tick">{label(p.at, window)}</text>
              ))}
              {maxErr > 0 && data.map((p, i) => p.errors > 0 && (
                <rect key={`e${p.at}`} x={x(i) - barW / 2} y={y(0) - Math.max(3, (p.errors / maxErr) * 34)} width={barW} height={Math.max(3, (p.errors / maxErr) * 34)} rx={2} className="gm-dochart__err" />
              ))}
              <path d={`${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gradient})`} />
              <path d={line} fill="none" className="gm-dochart__line" />
              {hover !== null && point && (
                <g>
                  <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} className="gm-dochart__cursor" />
                  <circle cx={x(hover)} cy={y(point.count)} r={4} className="gm-dochart__dot" />
                </g>
              )}
            </svg>
            {hover !== null && point && (
              <div className="gm-dochart__tip" style={{ left: Math.min(Math.max(x(hover), 80), width - 80) }}>
                <strong>{window === '1h' || window === '24h' ? formatDateTime(point.at) : `${formatDayMonth(point.at)} ${formatTime(point.at)}`}</strong>
                <span>{t('So‘rovlar')}: {formatNumber(point.count)}</span>
                <span>{t('Xatolar')}: {formatNumber(point.errors)}</span>
                <span>P95: {point.p95Ms !== null ? `${point.p95Ms} ms` : '—'}</span>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
