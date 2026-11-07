import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cx } from '@/lib/utils';
import { Spinner } from './Spinner';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** Faqat ikonka (kvadrat tugma): `aria-label` majburiy — ekran o‘quvchi uchun nom. */
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, fullWidth = false, iconOnly = false, disabled, className, children, ...rest },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cx('gm-button', `gm-button--${variant}`, `gm-button--${size}`, fullWidth && 'gm-button--full', iconOnly && 'gm-button--icon', loading && 'is-loading', className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && <Spinner size="sm" className="gm-button__spinner" />}
        {/* Yuklanishda matn joyida qoladi (ko‘rinmas) — tugma kengligi o‘zgarmaydi. */}
        <span className="gm-button__label">{children}</span>
      </button>
    );
  },
);
Button.displayName = 'Button';
