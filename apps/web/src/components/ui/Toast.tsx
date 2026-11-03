import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/app.store';
import { cx } from '@/lib/utils';
import './Toast.css';
import { t } from '@/i18n';

const AUTO_DISMISS_MS = 5000;

export function ToastViewport() {
  const toasts = useAppStore((state) => state.toasts);
  const dismissToast = useAppStore((state) => state.dismissToast);

  return createPortal(
    <div className="gm-toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} variant={toast.variant} onDismiss={dismissToast} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({
  id,
  message,
  variant,
  onDismiss,
}: {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'info';
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div className={cx('gm-toast', `gm-toast--${variant}`)} role={variant === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      <button type="button" className="gm-toast__close" onClick={() => onDismiss(id)} aria-label={t('Xabarni yopish')}>
        ✕
      </button>
    </div>
  );
}
