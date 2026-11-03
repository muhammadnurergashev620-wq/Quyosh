import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { cx } from '@/lib/utils';
import './Field.css';
import { t } from '@/i18n';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Input ichida chapda ko‘rsatiladigan doimiy qism, masalan telefon kodi «+998». */
  prefix?: string;
  /** Input ichida o‘ngda ko‘rsatiladigan birlik, masalan «so‘m». */
  suffix?: string;
  /** Qiymatni kiritish paytida formatlaydi (masalan, telefon: «95 959 49 44»). */
  formatValue?: (value: string) => string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, required, className, type, prefix, suffix, formatValue, onChange, onKeyDown, ...rest }, ref) => {
    const generatedId = useId();
    const [revealed, setRevealed] = useState(false);
    const isPassword = type === 'password';
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="gm-field">
        <label htmlFor={inputId} className="gm-field__label">
          {label}
        </label>
        <div className={cx('gm-field__wrap', isPassword && 'gm-field__wrap--password', prefix && 'gm-field__wrap--prefixed', suffix && 'gm-field__wrap--suffixed')}>
          {prefix && (
            <span className="gm-field__prefix" aria-hidden="true">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={isPassword && revealed ? 'text' : type}
            required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={cx('gm-field__control', error && 'gm-field__control--error', className)}
            onChange={
              formatValue
                ? (event) => {
                    // Formatlashda kursor joyini saqlaymiz: o‘rtadagi raqamni o‘chirsa/qo‘shsa, kursor oxiriga sakramaydi.
                    const el = event.target;
                    const caret = el.selectionStart ?? el.value.length;
                    const digitsBefore = (el.value.slice(0, caret).match(/\d/g) ?? []).length;
                    const formatted = formatValue(el.value);
                    el.value = formatted;
                    let position = 0;
                    let seen = 0;
                    while (position < formatted.length && seen < digitsBefore) {
                      if (/\d/.test(formatted.charAt(position))) seen += 1;
                      position += 1;
                    }
                    if (document.activeElement === el) el.setSelectionRange(position, position);
                    onChange?.(event);
                  }
                : onChange
            }
            onKeyDown={
              formatValue
                ? (event) => {
                    const el = event.currentTarget;
                    // Ajratgichdan (bo‘shliq/vergul) keyin Backspace bosilsa, ajratgichni emas, undan oldingi raqamni o‘chiramiz.
                    if (event.key === 'Backspace' && el.selectionStart === el.selectionEnd && el.selectionStart && /\D/.test(el.value.charAt(el.selectionStart - 1))) {
                      el.setSelectionRange(el.selectionStart - 1, el.selectionStart - 1);
                    }
                    onKeyDown?.(event);
                  }
                : onKeyDown
            }
            autoComplete={isPassword ? undefined : 'off'}
            {...rest}
          />
          {suffix && (
            <span className="gm-field__suffix" aria-hidden="true">
              {suffix}
            </span>
          )}
          {isPassword && (
            <button
              type="button"
              className="gm-field__reveal"
              aria-label={revealed ? t('Parolni yashirish') : t('Parolni ko‘rsatish')}
              aria-pressed={revealed}
              onClick={() => setRevealed((value) => !value)}
            >
              {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
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
Input.displayName = 'Input';
