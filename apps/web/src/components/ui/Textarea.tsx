import { forwardRef, useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/utils';
import './Field.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, required, className, ...rest }, ref) => {
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
        <textarea
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cx('gm-field__control', error && 'gm-field__control--error', className)}
          autoComplete="off"
          {...rest}
        />
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
Textarea.displayName = 'Textarea';
