import { useCallback, useMemo, useState } from 'react';
import { newIdempotencyKey } from '@/lib/utils';

/**
 * TZ 9.4: bitta yuborish uchun barqaror `Idempotency-Key`.
 * `scope` (odatda so‘rov tanasi) o‘zgarmaguncha kalit bir xil — ikki marta bosish yoki tarmoq qayta urinishi
 * serverda bitta yozuv yaratadi; muvaffaqiyatdan keyin `rotate()` yangi kalit beradi.
 */
export function useIdempotencyKey(scope: unknown = null) {
  const [round, setRound] = useState(0);
  const scopeKey = JSON.stringify(scope ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- kalit faqat tana yoki raund o‘zgarganda yangilanadi
  const key = useMemo(() => newIdempotencyKey(), [scopeKey, round]);
  const rotate = useCallback(() => setRound((n) => n + 1), []);
  return { key, rotate };
}
