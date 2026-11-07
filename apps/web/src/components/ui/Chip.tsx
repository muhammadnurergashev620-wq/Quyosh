import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import './system.css';

/**
 * Chip (U5): filtr, teg va xizmat belgilari uchun yagona komponent. Balandlik 32, radius 999.
 * `selected` — primary-soft fon + ✓; `onRemove` — × tugmasi bilan olib tashlanadigan chip.
 */
export function Chip({ selected = false, onRemove, icon, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; onRemove?: () => void; icon?: ReactNode }) {
  const interactive = !!rest.onClick;
  const body = (
    <>
      {selected && interactive ? <Check className="gm-chip__check" aria-hidden="true" /> : icon && <span className="gm-chip__icon" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </>
  );
  if (!interactive && !onRemove) return <span className={cx('gm-chip', 'is-static', selected && 'is-on', className)}>{body}</span>;
  return (
    <span className={cx('gm-chip', selected && 'is-on', onRemove && 'is-removable', className)}>
      {interactive ? <button type="button" className="gm-chip__main" aria-pressed={selected} {...rest}>{body}</button> : <span className="gm-chip__main">{body}</span>}
      {onRemove && (
        <button type="button" className="gm-chip__remove" onClick={onRemove} aria-label={t('Olib tashlash')}>
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

export function ChipGroup({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return <div className={cx('gm-chip-group', className)} role="group" aria-label={label}>{children}</div>;
}
