import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import './Toggle.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, id, className, ...rest }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <div className="gm-toggle-field">
        <label className="gm-toggle" htmlFor={fieldId}>
          <input ref={ref} type="checkbox" id={fieldId} aria-invalid={!!error} className={className} {...rest} />
          <span className="gm-toggle__label">{label}</span>
        </label>
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
