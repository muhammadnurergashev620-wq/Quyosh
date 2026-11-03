import { OutboxEvent } from '@prisma/client';

export type NotificationTarget = { userId: string; title: string; body: string } | null;

/**
 * Outbox hodisasini in-app bildirishnomaga aylantirish (TZ 14.2).
 * Hozircha umumiy shakl: payload `{ userId, title, body }` bo‘lsa bildirishnoma yaratiladi.
 * Quyosh hodisalari (QUOTE_RECEIVED, SITE_VISIT_PROPOSED va h.k.) M6 bosqichida shu yerga qo‘shiladi.
 */
export function toNotificationTarget(event: OutboxEvent): NotificationTarget {
  const payload = event.payload as Record<string, unknown> | null;
  if (!payload) return null;
  if (typeof payload.userId === 'string' && typeof payload.title === 'string' && typeof payload.body === 'string') {
    return { userId: payload.userId, title: payload.title, body: payload.body };
  }
  return null;
}
