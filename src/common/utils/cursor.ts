import type { CursorPage } from '../types/pagination.types';

export function cursorArgs(query: { cursor?: string; limit?: number }) {
  const limit = query.limit ?? 20;
  return {
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  };
}

export function toCursorPage<T extends { id: string }>(rows: T[], query: { limit?: number }): CursorPage<T> {
  const limit = query.limit ?? 20;
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}

export function dateRangeWhere(range: { from?: string; to?: string }): { gte?: Date; lte?: Date } | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: new Date(range.from) } : {}),
    ...(range.to ? { lte: new Date(range.to) } : {}),
  };
}
