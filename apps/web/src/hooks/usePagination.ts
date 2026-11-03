import { useState } from 'react';

export function usePagination(initialLimit = 20) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<string[]>([]);

  function next(nextCursor: string | null) {
    if (!nextCursor) return;
    setHistory([...history, cursor ?? '']);
    setCursor(nextCursor);
  }

  function previous() {
    if (history.length === 0) return;
    const copy = [...history];
    const last = copy.pop();
    setHistory(copy);
    setCursor(last || undefined);
  }

  function reset() {
    setHistory([]);
    setCursor(undefined);
  }

  return { cursor, limit: initialLimit, hasPrevious: history.length > 0, next, previous, reset };
}
