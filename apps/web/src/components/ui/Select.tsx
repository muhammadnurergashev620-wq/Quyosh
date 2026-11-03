import { forwardRef, useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { cx } from '@/lib/utils';
import './Field.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, error, hint, id, required, className, ...rest }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const errorId = `${fieldId}-error`;
    const hintId = `${fieldId}-hint`;
    const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="gm-field">
        <label htmlFor={fieldId} className="gm-field__label">
          {label}
        </label>
        <select
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cx('gm-field__control', error && 'gm-field__control--error', className)}
          autoComplete="off"
          // value (controlled) berilgan bo‘lsa defaultValue qo‘yilmaydi — React ogohlantirishi chiqmasin.
          {...(rest.value === undefined && rest.defaultValue === undefined ? { defaultValue: '' } : {})}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hint && !error && (
          <p id={hintId} className="gm-field__hint">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="gm-field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';
