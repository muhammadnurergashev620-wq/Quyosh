import { useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import './Alert.css';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const ICON: Record<AlertTone, ReactNode> = { info: <Info />, success: <CheckCircle2 />, warning: <AlertTriangle />, danger: <XCircle /> };

/**
 * Inline banner (U5): chapda 3 px rangli chiziq + ikonka + sarlavha + matn + ixtiyoriy amal + ×.
 * `dismissible` — foydalanuvchi yopa oladi (faqat shu ko‘rinishda yashiriladi).
 */
export function Alert({ tone = 'info', title, children, action, dismissible = false, icon, className }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; dismissible?: boolean; icon?: ReactNode; className?: string }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <div className={cx('gm-alert', `gm-alert--${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="gm-alert__icon" aria-hidden="true">{icon ?? ICON[tone]}</span>
      <div className="gm-alert__content">
        {title && <p className="gm-alert__title">{title}</p>}
        {children && <div className="gm-alert__body">{children}</div>}
        {action && <div className="gm-alert__action">{action}</div>}
      </div>
      {dismissible && (
        <button type="button" className="gm-alert__close" onClick={() => setClosed(true)} aria-label={t('Yopish')}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
