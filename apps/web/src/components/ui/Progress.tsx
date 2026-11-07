import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import './system.css';

/** Doira-grafik (ProgressRing): 0..1 qiymat, markazda foiz yoki berilgan matn; to‘lish animatsiyasi. */
export function ProgressRing({ value, size = 88, stroke = 9, label, tone = 'primary' }: { value: number; size?: number; stroke?: number; label?: ReactNode; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent' }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={cx('gm-ring', `gm-ring--${tone}`)} style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v * 100)} %`}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="gm-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="gm-ring__bar" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      <span className="gm-ring__label">{label ?? `${formatNumber(v * 100)} %`}</span>
    </span>
  );
}

/** Chiziqli progress (0..1). */
export function Progress({ value, tone = 'primary', label }: { value: number; tone?: 'primary' | 'success' | 'warning' | 'danger'; label?: string }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <span className={cx('gm-progress', `gm-progress--${tone}`)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <span className="gm-progress__bar" style={{ transform: `scaleX(${v})` }} />
    </span>
  );
}

/** Qadamlar ko‘rsatkichi: tugallangan — ✓ (success), joriy — halqa bilan, kelgusi — kulrang. */
export function Stepper({ steps, current, onStep }: { steps: string[]; current: number; onStep?: (index: number) => void }) {
  return (
    <ol className="gm-stepper">
      {steps.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        const dot = <span className="gm-stepper__dot">{state === 'done' ? <Check aria-hidden="true" /> : i + 1}</span>;
        return (
          <li key={step} className={cx('gm-stepper__item', `is-${state}`)} aria-current={state === 'current' ? 'step' : undefined}>
            {onStep && state === 'done' ? <button type="button" className="gm-stepper__btn" onClick={() => onStep(i)}>{dot}<span>{step}</span></button> : <span className="gm-stepper__btn">{dot}<span>{step}</span></span>}
          </li>
        );
      })}
    </ol>
  );
}
