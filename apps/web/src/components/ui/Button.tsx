import { forwardRef, useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import { Check } from 'lucide-react';
import { cx } from '@/lib/utils';
import { Spinner } from './Spinner';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'danger-soft' | 'accent' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonLookProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Faqat ikonka (kvadrat tugma): `aria-label` majburiy — ekran o‘quvchi uchun nom. */
  iconOnly?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonLookProps {
  loading?: boolean;
  /** `true` bo‘lsa 1,5 s davomida ✓ va success fon (masalan, «Nusxa olindi»). */
  success?: boolean;
}

/** Barcha tugma ko‘rinishlari uchun yagona klass yig‘uvchi (Button, ButtonLink, ButtonAnchor). */
export function buttonClass({ variant = 'primary', size = 'md', fullWidth, iconOnly }: ButtonLookProps, ...extra: Array<string | false | null | undefined>) {
  return cx('gm-button', `gm-button--${variant}`, `gm-button--${size}`, fullWidth && 'gm-button--full', iconOnly && 'gm-button--icon', ...extra);
}

function Content({ leftIcon, rightIcon, children }: { leftIcon?: ReactNode; rightIcon?: ReactNode; children?: ReactNode }) {
  return (
    <span className="gm-button__label">
      {leftIcon && <span className="gm-button__icon" aria-hidden="true">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="gm-button__icon gm-button__icon--end" aria-hidden="true">{rightIcon}</span>}
    </span>
  );
}

/**
 * Loyihadagi yagona tugma (U5.1): primary, secondary, soft, ghost, danger, danger-soft, accent (faqat bosh sayt CTA), link;
 * sm 32 / md 44 / lg 50 px; loading’da matn joyida qoladi (kenglik o‘zgarmaydi) va qayta bosish bloklanadi.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, success = false, fullWidth = false, iconOnly = false, leftIcon, rightIcon, disabled, className, children, ...rest }, ref) => {
    const [flash, setFlash] = useState(false);
    useEffect(() => {
      if (!success) return;
      setFlash(true);
      const id = window.setTimeout(() => setFlash(false), 1500);
      return () => window.clearTimeout(id);
    }, [success]);
    return (
      <button
        ref={ref}
        className={buttonClass({ variant, size, fullWidth, iconOnly }, loading && 'is-loading', flash && 'is-success', className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && <Spinner size="sm" className="gm-button__spinner" />}
        <Content leftIcon={flash ? <Check /> : leftIcon} rightIcon={rightIcon}>{children}</Content>
      </button>
    );
  },
);
Button.displayName = 'Button';

/** Ichki sahifaga havola, tugma ko‘rinishida (Router `Link`). */
export function ButtonLink({ variant, size, fullWidth, iconOnly, leftIcon, rightIcon, className, children, ...rest }: LinkProps & ButtonLookProps) {
  return (
    <Link className={buttonClass({ variant, size, fullWidth, iconOnly }, className as string)} {...rest}>
      <Content leftIcon={leftIcon} rightIcon={rightIcon}>{children}</Content>
    </Link>
  );
}

/** Tashqi havola yoki boshqa panelga o‘tish (`<a href>`), tugma ko‘rinishida. */
export function ButtonAnchor({ variant, size, fullWidth, iconOnly, leftIcon, rightIcon, className, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & ButtonLookProps) {
  return (
    <a className={buttonClass({ variant, size, fullWidth, iconOnly }, className)} {...rest}>
      <Content leftIcon={leftIcon} rightIcon={rightIcon}>{children}</Content>
    </a>
  );
}

/** Tugmalar guruhi: 8 px oraliq; mobilda vertikal, asosiy tugma pastda (bosh barmoq uchun). */
export function ButtonGroup({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'between'; className?: string }) {
  return <div className={cx('gm-button-group', `gm-button-group--${align}`, className)}>{children}</div>;
}
