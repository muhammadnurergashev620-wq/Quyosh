import type { ReactNode } from 'react';
import { cx } from '@/lib/utils';
import './system.css';

/**
 * Sahifa sarlavhasi (U5.5): eyebrow (JetBrains Mono), H1 (Onest 800, 28–30 px), bir jumla izoh — «bu yerda nima qilasiz»;
 * o‘ngda amallar (mobilda sarlavha ostida).
 */
export function PageHeader({ eyebrow, title, description, actions, icon, className }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <header className={cx('gm-page-head', className)}>
      <div className="gm-page-head__text">
        {eyebrow && <p className="gm-eyebrow">{eyebrow}</p>}
        <h1>{icon && <span className="gm-page-head__icon" aria-hidden="true">{icon}</span>}{title}</h1>
        {description && <p className="gm-page-head__lead">{description}</p>}
      </div>
      {actions && <div className="gm-page-head__actions">{actions}</div>}
    </header>
  );
}
