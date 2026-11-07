import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Info, Loader2, X } from 'lucide-react';
import { MAX_VISIBLE, setToastStrings, useToastStore, type ToastItem, type ToastType } from '@/lib/toast';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import './Toast.css';

const ICON: Record<ToastType, JSX.Element> = {
  success: <Check />,
  error: <span className="gm-toast__bang">!</span>,
  warning: <AlertTriangle />,
  info: <Info />,
  loading: <Loader2 className="gm-toast__spin" />,
};

/**
 * Toastlar joyi: desktop — o‘ng pastda, mobil — yuqorida. Ko‘pi bilan 3 ta; yangisi ustida, qolgani navbatda.
 * success/info — `aria-live="polite"`, error — `assertive`.
 */
export function ToastViewport() {
  const items = useToastStore((s) => s.items);
  useEffect(() => setToastStrings({ undo: t('Qaytarish') }), []);
  const visible = items.slice(-MAX_VISIBLE).reverse();
  const queued = Math.max(0, items.length - MAX_VISIBLE);
  return createPortal(
    <>
      <section className="gm-toasts" aria-label={t('Xabarlar')}>
        {visible.map((item) => <ToastCard key={item.id} item={item} />)}
      </section>
      {queued > 0 && <span className="gm-visually-hidden">{t('Navbatda yana {n} ta xabar', { n: queued })}</span>}
    </>,
    document.body,
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [paused, setPaused] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const remaining = useRef(item.duration ?? 0);
  const startedAt = useRef(Date.now());

  // Taymer: hover/focus’da to‘xtaydi, qayta boshlanganda qolgan vaqtdan davom etadi.
  useEffect(() => {
    remaining.current = item.duration ?? 0;
    startedAt.current = Date.now();
  }, [item.createdAt, item.duration]);
  useEffect(() => {
    if (item.duration == null || paused || item.leaving) return;
    startedAt.current = Date.now();
    const id = window.setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(id);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [item.id, item.duration, item.createdAt, paused, item.leaving, dismiss]);

  // Mobilda surib yopish (gorizontal 80 px dan ko‘p).
  const onDown = (e: ReactPointerEvent) => { if (e.pointerType !== 'mouse') { start.current = e.clientX; setPaused(true); } };
  const onMove = (e: ReactPointerEvent) => { if (start.current !== null) setDrag(e.clientX - start.current); };
  const onUp = () => {
    if (start.current === null) return;
    start.current = null;
    if (Math.abs(drag) > 80) dismiss(item.id);
    else { setDrag(0); setPaused(false); }
  };

  return (
    <div
      className={cx('gm-toast', `gm-toast--${item.type}`, item.leaving && 'is-leaving', drag !== 0 && 'is-dragging')}
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
      style={drag ? { transform: `translateX(${drag}px)`, opacity: Math.max(0.2, 1 - Math.abs(drag) / 240) } : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <span className="gm-toast__icon" aria-hidden="true">{ICON[item.type]}</span>
      <div className="gm-toast__text">
        <p className="gm-toast__title">{item.title}</p>
        {item.description && <p className="gm-toast__desc">{item.description}</p>}
        {item.action && (
          <button type="button" className="gm-toast__action" onClick={item.action.onClick}>{item.action.label}</button>
        )}
      </div>
      <button type="button" className="gm-toast__close" onClick={() => dismiss(item.id)} aria-label={t('Xabarni yopish')}>
        <X aria-hidden="true" />
      </button>
      {item.duration != null && !item.leaving && (
        <span key={item.createdAt} className={cx('gm-toast__progress', paused && 'is-paused')} style={{ animationDuration: `${item.duration}ms` }} aria-hidden="true" />
      )}
    </div>
  );
}
