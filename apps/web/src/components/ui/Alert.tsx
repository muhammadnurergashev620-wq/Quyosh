import type { ReactNode } from 'react';
import { cx } from '@/lib/utils';
import './Alert.css';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('gm-alert', `gm-alert--${tone}`)} role={tone === 'danger' ? 'alert' : 'status'}>
      {title && <p className="gm-alert__title">{title}</p>}
      <div className="gm-alert__body">{children}</div>
    </div>
  );
}
