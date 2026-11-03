import type { CursorPage } from '@/types/api';

export function toItems<T>(data: T[] | CursorPage<T> | null | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items;
}
