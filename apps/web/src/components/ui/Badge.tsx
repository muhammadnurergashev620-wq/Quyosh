import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Info, MinusCircle, XCircle } from 'lucide-react';
import { cx } from '@/lib/utils';
import './Badge.css';

export type BadgeTone = 'neutral' | 'info' | 'primary' | 'success' | 'warning' | 'danger';

const ICON: Record<BadgeTone, ReactNode> = {
  neutral: <MinusCircle />,
  info: <Info />,
  primary: <Circle />,
  success: <CheckCircle2 />,
  warning: <AlertTriangle />,
  danger: <XCircle />,
};

/**
 * Status belgisi (U5.3): ikonka + matn + yengil fon + 1 px chegara — status faqat rang bilan berilmaydi.
 * `live` — jarayondagi holat (kutilmoqda): chapda pulsatsiyalanuvchi nuqta.
 */
export function Badge({ tone = 'neutral', children, live = false, icon, className }: { tone?: BadgeTone; children: ReactNode; live?: boolean; icon?: ReactNode | false; className?: string }) {
  return (
    <span className={cx('gm-badge', `gm-badge--${tone}`, live && 'is-live', className)}>
      {live ? <span className="gm-badge__pulse" aria-hidden="true" /> : icon !== false && <span className="gm-badge__icon" aria-hidden="true">{icon ?? ICON[tone]}</span>}
      {children}
    </span>
  );
}
