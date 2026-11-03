import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { t } from '@/i18n';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  /** Katta kontent (rasm, hujjat) uchun kengaytirilgan oyna. */
  wide?: boolean;
  /** O‘rtacha kengaytirilgan oyna (forma + ro‘yxat uchun, 720px). */
  large?: boolean;
  /** Qo‘shimcha sinf (masalan, tasdiqlash oynasi uchun). */
  className?: string;
  /** Sarlavha tepasida o‘rtada chiqadigan belgi (tasdiqlash oynasi uchun). */
  icon?: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children, footer, dismissible = true, wide = false, large = false, className, icon }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // onClose har renderda yangi funksiya bo‘lishi mumkin; effect qayta ishga tushib, fokusni tortib olmasligi uchun ref'da saqlanadi.
  const drag = useSheetDrag(panelRef, onClose);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="gm-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={[wide ? 'gm-modal gm-modal--wide' : large ? 'gm-modal gm-modal--large' : 'gm-modal', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {dismissible && <div className="gm-modal__grab" aria-hidden="true" {...drag} />}
        {icon && <div className="gm-modal__icon">{icon}</div>}
        <div className="gm-modal__header">
          <h2 id={titleId} className="gm-modal__title">
            {title}
          </h2>
          {dismissible && (
            <button type="button" className="gm-modal__close" onClick={onClose} aria-label={t('Yopish')}>
              ✕
            </button>
          )}
        </div>
        <div className="gm-modal__body">{children}</div>
        {footer && <div className="gm-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
