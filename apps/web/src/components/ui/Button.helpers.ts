import { cx } from '@/lib/utils';
import type { ButtonLookProps } from './Button';

/** Barcha tugma ko‘rinishlari uchun yagona klass yig‘uvchi (Button, ButtonLink, ButtonAnchor). */
export function buttonClass({ variant = 'primary', size = 'md', fullWidth, iconOnly }: ButtonLookProps, ...extra: Array<string | false | null | undefined>) {
  return cx('gm-button', `gm-button--${variant}`, `gm-button--${size}`, fullWidth && 'gm-button--full', iconOnly && 'gm-button--icon', ...extra);
}
