import { useEffect, useState } from 'react';

/** `target`gacha qolgan millisekund; o‘tgan bo‘lsa manfiy son. `target` bo‘lmasa `null`. */
export function useCountdown(target: string | Date | null | undefined): number | null {
  const targetMs = target ? new Date(target).getTime() : NaN;
  const valid = !Number.isNaN(targetMs);
  const [remaining, setRemaining] = useState<number | null>(valid ? targetMs - Date.now() : null);

  useEffect(() => {
    if (!valid) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(targetMs - Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetMs, valid]);

  return remaining;
}
