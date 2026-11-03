import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/**
 * Bottom sheet'ni tutqichdan pastga sudrab yopish (telefon). Sudrash paytida panel barmoq bilan birga siljiydi;
 * 90px dan ortiq yoki tez tortilsa — yopiladi, aks holda joyiga qaytadi. React qayta chizilmaydi (to‘g‘ridan-to‘g‘ri transform).
 */
export function useSheetDrag(panel: RefObject<HTMLElement>, onClose: () => void) {
  const start = useRef<{ y: number; t: number } | null>(null);
  const delta = useRef(0);

  const apply = (value: number, animate: boolean) => {
    const el = panel.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
    el.style.transform = value ? `translate3d(0, ${value}px, 0)` : '';
  };

  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      start.current = { y: event.clientY, t: performance.now() };
      delta.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      if (!start.current) return;
      delta.current = Math.max(0, event.clientY - start.current.y);
      apply(delta.current, false);
    },
    onPointerUp() {
      if (!start.current) return;
      const speed = delta.current / Math.max(1, performance.now() - start.current.t);
      const close = delta.current > 90 || (delta.current > 30 && speed > 0.6);
      start.current = null;
      if (close) {
        apply(window.innerHeight, true);
        window.setTimeout(onClose, 180);
      } else {
        apply(0, true);
      }
    },
  };
}
