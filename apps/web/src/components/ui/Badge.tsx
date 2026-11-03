import type { ReactNode } from 'react';
import { cx } from '@/lib/utils';
import './Badge.css';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cx('gm-badge', `gm-badge--${tone}`)}>{children}</span>;
}
