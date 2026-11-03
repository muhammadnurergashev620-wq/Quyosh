import { ShopStatus } from '@prisma/client';

/**
 * TZ 3.7.3 — Shop holatlari o‘tish jadvali. Jadvalda yo‘q o‘tish — 409 INVALID_STATUS_TRANSITION.
 * `actor`: OWNER — do‘kon egasi; ADMIN — verifikatsiya qaroriga huquqli admin; SUPER_ADMIN — superadmin.
 */
type Actor = 'OWNER' | 'ADMIN' | 'SUPER_ADMIN';

const TRANSITIONS: Array<{ from: ShopStatus; to: ShopStatus; actors: Actor[] }> = [
  { from: 'DRAFT', to: 'PENDING_REVIEW', actors: ['OWNER', 'SUPER_ADMIN'] },
  { from: 'DRAFT', to: 'ACTIVE', actors: ['SUPER_ADMIN'] },
  { from: 'PENDING_REVIEW', to: 'ACTIVE', actors: ['ADMIN', 'SUPER_ADMIN'] },
  { from: 'PENDING_REVIEW', to: 'DRAFT', actors: ['ADMIN', 'SUPER_ADMIN'] },
  { from: 'ACTIVE', to: 'SUSPENDED', actors: ['SUPER_ADMIN'] },
  { from: 'SUSPENDED', to: 'ACTIVE', actors: ['SUPER_ADMIN'] },
];

export function canTransition(from: ShopStatus, to: ShopStatus, actor: Actor): boolean {
  return TRANSITIONS.some((item) => item.from === from && item.to === to && (item.actors.includes(actor) || (actor === 'SUPER_ADMIN' && item.actors.includes('ADMIN'))));
}
