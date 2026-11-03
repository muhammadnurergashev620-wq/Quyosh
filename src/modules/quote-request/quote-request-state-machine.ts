import type { QuoteRequestStatus, RequestShopStatus } from '@prisma/client';
import { assertTransitionIn, canTransitionIn, type TransitionTable } from '../../common/state/transition-table';

/** CUSTOMER — so‘rov egasi; SHOP — qabul qiluvchi do‘kon a’zosi; SYSTEM — job yoki boshqa entity o‘tishining oqibati. */
export type RequestActor = 'CUSTOMER' | 'SHOP' | 'SYSTEM';

/** TZ 13.1 — QuoteRequest.status. */
const REQUEST: TransitionTable<QuoteRequestStatus, RequestActor> = [
  { from: ['OPEN'], to: 'CLOSED_SELECTED', actors: ['SYSTEM'] },
  { from: ['OPEN'], to: 'CLOSED_NO_SELECTION', actors: ['CUSTOMER'] },
  { from: ['OPEN'], to: 'EXPIRED', actors: ['SYSTEM'] },
  { from: ['OPEN'], to: 'CANCELLED', actors: ['SYSTEM'] },
];

/** TZ 13.1 — QuoteRequestShop.status. */
const REQUEST_SHOP: TransitionTable<RequestShopStatus, RequestActor> = [
  { from: ['SENT'], to: 'VIEWED', actors: ['SHOP'] },
  { from: ['SENT', 'VIEWED'], to: 'CLARIFICATION_REQUESTED', actors: ['SHOP'] },
  { from: ['CLARIFICATION_REQUESTED'], to: 'VIEWED', actors: ['CUSTOMER'] },
  { from: ['SENT', 'VIEWED', 'CLARIFICATION_REQUESTED'], to: 'QUOTED', actors: ['SHOP'] },
  { from: ['SENT', 'VIEWED', 'CLARIFICATION_REQUESTED'], to: 'DECLINED', actors: ['SHOP'] },
  { from: ['QUOTED'], to: 'SELECTED', actors: ['CUSTOMER'] },
  { from: ['QUOTED', 'VIEWED', 'SENT', 'CLARIFICATION_REQUESTED'], to: 'NOT_SELECTED', actors: ['SYSTEM'] },
];

export const canRequestTransition = (from: QuoteRequestStatus, to: QuoteRequestStatus, actor: RequestActor) => canTransitionIn(REQUEST, from, to, actor);
export const assertRequestTransition = (from: QuoteRequestStatus, to: QuoteRequestStatus, actor: RequestActor) => assertTransitionIn(REQUEST, from, to, actor);
export const canRequestShopTransition = (from: RequestShopStatus, to: RequestShopStatus, actor: RequestActor) => canTransitionIn(REQUEST_SHOP, from, to, actor);
export const assertRequestShopTransition = (from: RequestShopStatus, to: RequestShopStatus, actor: RequestActor) => assertTransitionIn(REQUEST_SHOP, from, to, actor);

/** So‘rov yopilganda/boshqasi tanlanganda NOT_SELECTED ga o‘tadigan holatlar. */
export const OPEN_REQUEST_SHOP_STATUSES: RequestShopStatus[] = ['SENT', 'VIEWED', 'CLARIFICATION_REQUESTED', 'QUOTED'];
