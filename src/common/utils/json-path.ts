/** Saqlangan JSON (masalan, hisob natijasi `outputSummaryJson`) ichidan yo‘l bo‘yicha xavfsiz o‘qish — `any` siz. */
export function at(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const key of path.split('.')) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Chekli son bo‘lsa — son, aks holda null. */
export function numAt(value: unknown, path: string): number | null {
  const v = at(value, path);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function strAt(value: unknown, path: string): string | null {
  const v = at(value, path);
  return typeof v === 'string' ? v : null;
}

export function numArrayAt(value: unknown, path: string): number[] | null {
  const v = at(value, path);
  return Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : null;
}
