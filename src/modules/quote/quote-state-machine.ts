import type { QuoteStatus } from '@prisma/client';
import { assertTransitionIn, canTransitionIn, type TransitionTable } from '../../common/state/transition-table';

export type QuoteActor = 'CUSTOMER' | 'SHOP' | 'SYSTEM';

/** TZ 13.1 — Quote.status. SENT → SENT (revise) ham jadvalda. */
const QUOTE: TransitionTable<QuoteStatus, QuoteActor> = [
  { from: ['DRAFT'], to: 'SENT', actors: ['SHOP'] },
  { from: ['SENT'], to: 'VIEWED', actors: ['CUSTOMER'] },
  { from: ['SENT', 'VIEWED'], to: 'SENT', actors: ['SHOP'] },
  { from: ['SENT', 'VIEWED'], to: 'ACCEPTED', actors: ['CUSTOMER'] },
  { from: ['SENT', 'VIEWED'], to: 'REJECTED', actors: ['CUSTOMER', 'SYSTEM'] },
  { from: ['SENT', 'VIEWED'], to: 'EXPIRED', actors: ['SYSTEM'] },
  { from: ['DRAFT', 'SENT', 'VIEWED'], to: 'WITHDRAWN', actors: ['SHOP'] },
];

export const canQuoteTransition = (from: QuoteStatus, to: QuoteStatus, actor: QuoteActor) => canTransitionIn(QUOTE, from, to, actor);
export const assertQuoteTransition = (from: QuoteStatus, to: QuoteStatus, actor: QuoteActor) => assertTransitionIn(QUOTE, from, to, actor);

/** Mijozga ko‘rinadigan (yuborilgan) holatlar. */
export const CUSTOMER_VISIBLE_QUOTE: QuoteStatus[] = ['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
