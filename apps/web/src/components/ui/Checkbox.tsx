import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/utils';
import './Toggle.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string;
  /** Nom faqat ekran o‘quvchi uchun (jadval qatori, «hammasini tanlash»). */
  hideLabel?: boolean;
  /** Qator ichida (filtr paneli, forma yonida): o‘ram div’siz, inline label. */
  inline?: boolean;
  /** Label elementining sinfi (karta ko‘rinishidagi variantlar uchun). */
  labelClassName?: string;
}

/** Yagona checkbox (U5): 20 px kvadrat, ✓ animatsiyasi, label bilan; `hideLabel` / `inline` — jadval va filtrlar uchun. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, id, className, hideLabel = false, inline = false, title, labelClassName, ...rest }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const control = (
      <label className={cx('gm-toggle', (inline || hideLabel) && 'gm-toggle--inline', hideLabel && 'gm-toggle--bare', labelClassName)} htmlFor={fieldId} title={title}>
        <input ref={ref} type="checkbox" id={fieldId} aria-invalid={error ? true : undefined} className={className} {...rest} />
        <span className={hideLabel ? 'gm-visually-hidden' : 'gm-toggle__label'}>{label}</span>
      </label>
    );
    if (inline || hideLabel) return control;
    return (
      <div className="gm-toggle-field">
        {control}
        {error && (
          <p className="gm-field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Checkbox.displayName = 'Checkbox';
