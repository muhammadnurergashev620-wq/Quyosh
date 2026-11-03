import type { CSSProperties } from 'react';
import { cx } from '@/lib/utils';
import './Skeleton.css';

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cx('gm-skeleton', className)} style={style} aria-hidden="true" />;
}
