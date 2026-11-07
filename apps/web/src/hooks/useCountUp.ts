import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Raqamni 0 dan (yoki oldingi qiymatdan) yangi qiymatgacha sanaydi (800 ms, ease-out); reduced-motion’da darhol. */
export function useCountUp(target: number | null | undefined, duration = 800): number | null {
  const [value, setValue] = useState<number | null>(target == null ? null : reduced() ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (target == null || !Number.isFinite(target)) return setValue(target ?? null);
    if (reduced() || typeof requestAnimationFrame !== 'function') return setValue(target);
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(begin + (target - begin) * eased);
      if (k < 1) frame = requestAnimationFrame(step);
      else from.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}
