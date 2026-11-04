import { ShopStatus } from '@prisma/client';

/**
 * TZ 3.7.3 (v3.1) — Shop holatlari. Do‘konni admin yaratadi va u darhol ACTIVE; o‘tish faqat ACTIVE ⇄ SUSPENDED (admin).
 * DRAFT va PENDING_REVIEW faqat v3.0 dan qolgan eski yozuvlar uchun: ulardan hech qaysi o‘tish yo‘q.
 * Jadvalda yo‘q o‘tish — 409 INVALID_STATUS_TRANSITION.
 */
type Actor = 'ADMIN';

const TRANSITIONS: Array<{ from: ShopStatus; to: ShopStatus; actors: Actor[] }> = [
  { from: 'ACTIVE', to: 'SUSPENDED', actors: ['ADMIN'] },
  { from: 'SUSPENDED', to: 'ACTIVE', actors: ['ADMIN'] },
];

export function canTransition(from: ShopStatus, to: ShopStatus, actor: Actor): boolean {
  return TRANSITIONS.some((item) => item.from === from && item.to === to && item.actors.includes(actor));
}
