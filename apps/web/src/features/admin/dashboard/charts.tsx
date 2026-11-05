import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatNumber } from '@/lib/utils';
import './charts.css';

/** Neon dashboard grafiklari (SVG, kutubxonasiz): hover tooltip, gradientlar, ruxsat etilgan o‘qlar. Hamma grafik `role="img"` va aria-label bilan. */

const nice = (max: number): number => {
  if (max <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(max));
  const f = max / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
};
export const compact = (value: number): string => (value >= 1_000_000 ? `${+(value / 1_000_000).toFixed(1)}M` : value >= 10_000 ? `${Math.round(value / 1000)}k` : value >= 1000 ? `${+(value / 1000).toFixed(1)}k` : String(Math.round(value)));

/** Monoton kubik egri chiziq (Fritsch–Carlson): grafik «sakramaydi» va qiymatdan oshib ketmaydi. */
function smoothPath(points: Array<[number, number]>): string {
  const n = points.length;
  if (n === 0) return '';
  if (n < 3) return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1]![0] - points[i]![0]);
    m.push((points[i + 1]![1] - points[i]![1]) / dx[i]!);
  }
  const t: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2);
  t.push(m[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i]! / m[i]!;
    const b = t[i + 1]! / m[i]!;
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]!; t[i + 1] = k * b * m[i]!; }
  }
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]! / 3;
    d += ` C${points[i]![0] + h},${points[i]![1] + t[i]! * h} ${points[i + 1]![0] - h},${points[i + 1]![1] - t[i + 1]! * h} ${points[i + 1]![0]},${points[i + 1]![1]}`;
  }
  return d;
}

/** Konteyner kengligini kuzatadi: grafik piksel-piksel mos chiziladi (matn o‘lchami o‘zgarmaydi). */
function useWidth(fallback: number): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setWidth(Math.max(180, Math.round(el.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

interface Tip { x: number; y: number; title: string; value: string }
function Tooltip({ tip, w, h }: { tip: Tip | null; w: number; h: number }) {
  if (!tip) return null;
  const width = Math.max(78, tip.value.length * 7 + 18, tip.title.length * 6 + 18);
  const x = Math.min(Math.max(tip.x - width / 2, 4), w - width - 4);
  const y = tip.y - 50 < 4 ? Math.min(tip.y + 12, h - 44) : tip.y - 50;
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={width} height={38} rx={8} className="nd-tip" />
      <text x={x + width / 2} y={y + 15} textAnchor="middle" className="nd-tip__t">{tip.title}</text>
      <text x={x + width / 2} y={y + 31} textAnchor="middle" className="nd-tip__v">{tip.value}</text>
    </g>
  );
}

const Defs = ({ id, from, to }: { id: string; from: string; to: string }) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor={from} stopOpacity="0.55" />
    <stop offset="100%" stopColor={to} stopOpacity="0.02" />
  </linearGradient>
);

/** Silliq chiziqli maydon grafigi: panjara, o‘q yorliqlari, ekstremum nuqtalari va hover. */
export function SmoothArea({ values, labels, unit = '', aria, height = 260 }: { values: number[]; labels: string[]; unit?: string; aria: string; height?: number }) {
  const uid = useId().replace(/:/g, '');
  const [tip, setTip] = useState<Tip | null>(null);
  const [boxRef, W] = useWidth(640);
  const H = height;
  const pad = { l: 40, r: 14, t: 16, b: 26 };
  const max = nice(Math.max(1, ...values) * 1.08);
  const x = (i: number) => pad.l + (values.length <= 1 ? 0 : (i * (W - pad.l - pad.r)) / (values.length - 1));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const pts = values.map((v, i): [number, number] => [x(i), y(v)]);
  const line = smoothPath(pts);
  const area = `${line} L${x(values.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const step = Math.max(1, Math.ceil(values.length / 7));
  const marks = useMemo(() => {
    const idx = new Set<number>([values.length - 1]);
    if (values.length) { idx.add(values.indexOf(Math.max(...values))); idx.add(values.indexOf(Math.min(...values))); }
    return [...idx];
  }, [values]);
  const fmtDay = (iso: string) => iso.slice(8, 10) + '.' + iso.slice(5, 7);
  return (
    <div ref={boxRef}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="nd-svg" onMouseLeave={() => setTip(null)}>
      <defs><Defs id={`${uid}a`} from="#22d3ee" to="#2563eb" /><linearGradient id={`${uid}l`} x1="0" x2="1"><stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.l} x2={W - pad.r} y1={y(tick)} y2={y(tick)} className="nd-gl" />
          <text x={pad.l - 8} y={y(tick) + 4} textAnchor="end" className="nd-axis">{compact(tick)}</text>
        </g>
      ))}
      <path d={area} fill={`url(#${uid}a)`} />
      <path d={line} fill="none" stroke={`url(#${uid}l)`} strokeWidth={3} strokeLinecap="round" className="nd-glow" />
      {labels.map((label, i) => (i % step === 0 || i === labels.length - 1 ? <text key={label} x={x(i)} y={H - 8} textAnchor="middle" className="nd-axis">{fmtDay(label)}</text> : null))}
      {marks.map((i) => <circle key={i} cx={x(i)} cy={y(values[i]!)} r={5.5} className="nd-dot" />)}
      {tip && <line x1={tip.x} x2={tip.x} y1={pad.t} y2={H - pad.b} className="nd-cross" />}
      {values.map((v, i) => (
        <rect
          key={i}
          x={x(i) - (W - pad.l - pad.r) / values.length / 2}
          y={pad.t}
          width={(W - pad.l - pad.r) / values.length}
          height={H - pad.t - pad.b}
          fill="transparent"
          onMouseEnter={() => setTip({ x: x(i), y: y(v), title: fmtDay(labels[i] ?? ''), value: `${formatNumber(v)}${unit}` })}
        />
      ))}
      {tip && <circle cx={tip.x} cy={tip.y} r={6} className="nd-dot nd-dot--on" />}
      <Tooltip tip={tip} w={W} h={H} />
    </svg>
    </div>
  );
}

/** Ustunli grafik (yuqori burchaklari yumaloq, gradient). */
export function Bars({ items, aria, height = 200 }: { items: Array<{ label: string; value: number }>; aria: string; height?: number }) {
  const uid = useId().replace(/:/g, '');
  const [tip, setTip] = useState<Tip | null>(null);
  const [boxRef, W] = useWidth(520);
  const H = height;
  const pad = { l: 34, r: 8, t: 12, b: 24 };
  const max = nice(Math.max(1, ...items.map((item) => item.value)) * 1.05);
  const bw = (W - pad.l - pad.r) / Math.max(1, items.length);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  return (
    <div ref={boxRef}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="nd-svg" onMouseLeave={() => setTip(null)}>
      <defs>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2dd4bf" /><stop offset="1" stopColor="#1d4ed8" stopOpacity="0.55" /></linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <g key={f}><line x1={pad.l} x2={W - pad.r} y1={y(f * max)} y2={y(f * max)} className="nd-gl" /><text x={pad.l - 6} y={y(f * max) + 4} textAnchor="end" className="nd-axis">{compact(f * max)}</text></g>
      ))}
      {items.map((item, i) => {
        const bx = pad.l + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const top = y(item.value);
        const h = Math.max(2, H - pad.b - top);
        return (
          <g key={item.label} onMouseEnter={() => setTip({ x: bx + w / 2, y: top, title: item.label, value: formatNumber(item.value) })}>
            <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
            <path d={`M${bx},${top + h} V${top + 4} Q${bx},${top} ${bx + 4},${top} H${bx + w - 4} Q${bx + w},${top} ${bx + w},${top + 4} V${top + h} Z`} fill={`url(#${uid}b)`} className="nd-bar" />
            <text x={bx + w / 2} y={H - 7} textAnchor="middle" className="nd-axis">{item.label.length > Math.max(4, Math.floor(bw / 6.6)) ? `${item.label.slice(0, Math.max(3, Math.floor(bw / 6.6) - 1))}…` : item.label}</text>
          </g>
        );
      })}
      <Tooltip tip={tip} w={W} h={H} />
    </svg>
    </div>
  );
}

/** Progress qatorlari (holatlar bo‘yicha). */
export function HBars({ rows, max }: { rows: Array<{ label: string; value: number }>; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="nd-hbars">
      {rows.map((row) => (
        <li key={row.label}>
          <div><span>{row.label}</span><b>{formatNumber(row.value)}<em>/{formatNumber(top)}</em></b></div>
          <i role="presentation"><u style={{ width: `${Math.max(2, Math.min(100, (row.value / top) * 100))}%` }} /></i>
        </li>
      ))}
    </ul>
  );
}

/** Halqa-o‘lchagich (foiz). */
export function Gauge({ percent, label, aria }: { percent: number; label: string; aria: string }) {
  const uid = useId().replace(/:/g, '');
  const r = 62;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <svg viewBox="0 0 160 160" role="img" aria-label={aria} className="nd-gauge">
      <defs><linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
      <circle cx="80" cy="80" r={r} className="nd-gauge__track" />
      <circle cx="80" cy="80" r={r} fill="none" stroke={`url(#${uid}g)`} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 80 80)" className="nd-glow" />
      <text x="80" y="82" textAnchor="middle" className="nd-gauge__v">{Math.round(p)}%</text>
      <text x="80" y="102" textAnchor="middle" className="nd-gauge__l">{label}</text>
    </svg>
  );
}

/** Zich ustunli gistogramma (kunlik qiymatlar). */
export function Histogram({ values, labels, aria, height = 150 }: { values: number[]; labels: string[]; aria: string; height?: number }) {
  const uid = useId().replace(/:/g, '');
  const [tip, setTip] = useState<Tip | null>(null);
  const [boxRef, W] = useWidth(300);
  const H = height;
  const max = Math.max(1, ...values);
  const bw = W / Math.max(1, values.length);
  return (
    <div ref={boxRef}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="nd-svg" onMouseLeave={() => setTip(null)}>
      <defs><linearGradient id={`${uid}h`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34e8d4" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * (H - 18));
        return (
          <g key={i} onMouseEnter={() => setTip({ x: i * bw + bw / 2, y: H - h, title: (labels[i] ?? '').slice(5).replace('-', '.'), value: formatNumber(v) })}>
            <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
            <rect x={i * bw + bw * 0.12} y={H - h} width={bw * 0.76} height={h} rx={1.5} fill={`url(#${uid}h)`} className="nd-bar" />
          </g>
        );
      })}
      <Tooltip tip={tip} w={W} h={H} />
    </svg>
    </div>
  );
}

/** Nuqtali grafik (quvvat va narx). */
export function Scatter({ points, xLabel, yLabel, aria, height = 170 }: { points: Array<{ x: number; y: number; hot?: boolean }>; xLabel: string; yLabel: string; aria: string; height?: number }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [boxRef, W] = useWidth(300);
  const H = height;
  const pad = { l: 36, r: 8, t: 8, b: 22 };
  const mx = nice(Math.max(1, ...points.map((p) => p.x)));
  const my = nice(Math.max(1, ...points.map((p) => p.y)));
  const X = (v: number) => pad.l + (v / mx) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v / my) * (H - pad.t - pad.b);
  return (
    <div ref={boxRef}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="nd-svg" onMouseLeave={() => setTip(null)}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}><line x1={pad.l} x2={W - pad.r} y1={Y(f * my)} y2={Y(f * my)} className="nd-gl" /><text x={pad.l - 5} y={Y(f * my) + 3} textAnchor="end" className="nd-axis">{compact(f * my)}</text></g>
      ))}
      {[0, 0.5, 1].map((f) => <text key={f} x={X(f * mx)} y={H - 6} textAnchor="middle" className="nd-axis">{compact(f * mx)}</text>)}
      {points.map((p, i) => (
        <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={p.hot ? 4.4 : 3.4} className={p.hot ? 'nd-pt nd-pt--hot' : 'nd-pt'} onMouseEnter={() => setTip({ x: X(p.x), y: Y(p.y), title: `${p.x} ${xLabel}`, value: `${compact(p.y)} ${yLabel}` })} />
      ))}
      <Tooltip tip={tip} w={W} h={H} />
    </svg>
    </div>
  );
}

/** Zich to‘lqinsimon maydon (kichik karta). */
export function Wave({ values, labels, aria, height = 150 }: { values: number[]; labels: string[]; aria: string; height?: number }) {
  const uid = useId().replace(/:/g, '');
  const [tip, setTip] = useState<Tip | null>(null);
  const [boxRef, W] = useWidth(300);
  const H = height;
  const max = Math.max(1, ...values) * 1.1;
  const x = (i: number) => (values.length <= 1 ? 0 : (i * W) / (values.length - 1));
  const y = (v: number) => 6 + (1 - v / max) * (H - 12);
  const line = smoothPath(values.map((v, i): [number, number] => [x(i), y(v)]));
  return (
    <div ref={boxRef}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="nd-svg" onMouseLeave={() => setTip(null)}>
      <defs><linearGradient id={`${uid}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38bdf8" stopOpacity="0.95" /><stop offset="1" stopColor="#2563eb" stopOpacity="0.15" /></linearGradient></defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${uid}w)`} />
      <path d={line} fill="none" stroke="#7dd3fc" strokeWidth={1.6} />
      {values.map((v, i) => (
        <rect key={i} x={x(i) - W / values.length / 2} y={0} width={W / values.length} height={H} fill="transparent" onMouseEnter={() => setTip({ x: x(i), y: y(v), title: (labels[i] ?? '').slice(5).replace('-', '.'), value: formatNumber(v) })} />
      ))}
      <Tooltip tip={tip} w={W} h={H} />
    </svg>
    </div>
  );
}
