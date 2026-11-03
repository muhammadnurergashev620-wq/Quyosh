import { cx } from '@/lib/utils';
import './Spinner.css';
import { t } from '@/i18n';

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cx('gm-spinner', `gm-spinner--${size}`, className)}
      role="status"
      aria-label={t('Yuklanmoqda')}
    />
  );
}
