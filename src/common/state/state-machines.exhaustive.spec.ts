import { describe, expect, it } from 'vitest';
import { canInstallationTransition, assertInstallationTransition } from '../../modules/installation/installation-state-machine';
import { canQuoteTransition } from '../../modules/quote/quote-state-machine';
import { canRequestShopTransition, canRequestTransition } from '../../modules/quote-request/quote-request-state-machine';
import { canTransition as canShopTransition } from '../../modules/shop/shop-state-machine';

/**
 * TZ 13.1 / 3.7.3 — to‘liq jadval: har bir (dan × ga × aktor) uchligi tekshiriladi.
 * Jadvalda bor — ruxsat; jadvalda yo‘q — taqiq (409 INVALID_STATUS_TRANSITION).
 * Kutilgan jadval TZ matnidan ko‘chirilgan (kodga bog‘liq emas).
 */
type Row<S extends string, A extends string> = [from: S[], to: S, actors: A[]];

function expand<S extends string, A extends string>(rows: Row<S, A>[]): Set<string> {
  const set = new Set<string>();
  for (const [from, to, actors] of rows) for (const f of from) for (const a of actors) set.add(`${f}>${to}@${a}`);
  return set;
}

function check<S extends string, A extends string>(states: readonly S[], actors: readonly A[], rows: Row<S, A>[], can: (f: S, t: S, a: A) => boolean) {
  const allowed = expand(rows);
  const wrong: string[] = [];
  let checked = 0;
  for (const f of states) for (const t of states) for (const a of actors) {
    checked += 1;
    const expected = allowed.has(`${f}>${t}@${a}`);
    if (can(f, t, a) !== expected) wrong.push(`${f} → ${t} (${a}): kutilgan ${expected ? 'ruxsat' : 'taqiq'}`);
  }
  return { wrong, checked, allowed: allowed.size };
}

describe('state machines — exhaustive (TZ 13.1)', () => {
  it('QuoteRequest', () => {
    const states = ['OPEN', 'CLOSED_SELECTED', 'CLOSED_NO_SELECTION', 'EXPIRED', 'CANCELLED'] as const;
    const actors = ['CUSTOMER', 'SHOP', 'SYSTEM'] as const;
    const r = check(states, actors, [
      [['OPEN'], 'CLOSED_SELECTED', ['SYSTEM']], // mijoz taklifni qabul qilganda (avtomatik)
      [['OPEN'], 'CLOSED_NO_SELECTION', ['CUSTOMER']],
      [['OPEN'], 'EXPIRED', ['SYSTEM']],
      [['OPEN'], 'CANCELLED', ['SYSTEM']], // hisob o‘chirilganda
    ], canRequestTransition);
    expect(r.wrong).toEqual([]);
    expect(r.checked).toBe(75);
  });

  it('QuoteRequestShop', () => {
    const states = ['SENT', 'VIEWED', 'CLARIFICATION_REQUESTED', 'QUOTED', 'DECLINED', 'SELECTED', 'NOT_SELECTED'] as const;
    const actors = ['CUSTOMER', 'SHOP', 'SYSTEM'] as const;
    const r = check(states, actors, [
      [['SENT'], 'VIEWED', ['SHOP']],
      [['SENT', 'VIEWED'], 'CLARIFICATION_REQUESTED', ['SHOP']],
      [['CLARIFICATION_REQUESTED'], 'VIEWED', ['CUSTOMER']],
      [['SENT', 'VIEWED', 'CLARIFICATION_REQUESTED'], 'QUOTED', ['SHOP']],
      [['SENT', 'VIEWED', 'CLARIFICATION_REQUESTED'], 'DECLINED', ['SHOP']],
      [['QUOTED'], 'SELECTED', ['CUSTOMER']],
      [['QUOTED', 'VIEWED', 'SENT', 'CLARIFICATION_REQUESTED'], 'NOT_SELECTED', ['SYSTEM']],
    ], canRequestShopTransition);
    expect(r.wrong).toEqual([]);
  });

  it('Quote', () => {
    const states = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'] as const;
    const actors = ['CUSTOMER', 'SHOP', 'SYSTEM'] as const;
    const r = check(states, actors, [
      [['DRAFT'], 'SENT', ['SHOP']],
      [['SENT'], 'VIEWED', ['CUSTOMER']],
      [['SENT', 'VIEWED'], 'SENT', ['SHOP']], // revise
      [['SENT', 'VIEWED'], 'ACCEPTED', ['CUSTOMER']],
      [['SENT', 'VIEWED'], 'REJECTED', ['CUSTOMER', 'SYSTEM']],
      [['SENT', 'VIEWED'], 'EXPIRED', ['SYSTEM']],
      [['DRAFT', 'SENT', 'VIEWED'], 'WITHDRAWN', ['SHOP']],
    ], canQuoteTransition);
    expect(r.wrong).toEqual([]);
  });

  it('Installation', () => {
    const states = ['AGREED', 'SITE_VISIT_SCHEDULED', 'INSTALLATION_SCHEDULED', 'INSTALLED', 'CONFIRMED', 'DISPUTED', 'CANCELLED'] as const;
    const actors = ['CUSTOMER', 'SHOP', 'ADMIN', 'SYSTEM'] as const;
    const r = check(states, actors, [
      [['AGREED'], 'SITE_VISIT_SCHEDULED', ['SYSTEM']], // o‘lchov tasdiqlanganda
      [['AGREED', 'SITE_VISIT_SCHEDULED'], 'INSTALLATION_SCHEDULED', ['SHOP']],
      [['INSTALLATION_SCHEDULED'], 'INSTALLED', ['SHOP']],
      [['INSTALLED'], 'CONFIRMED', ['CUSTOMER']],
      [['INSTALLED'], 'DISPUTED', ['CUSTOMER']],
      [['DISPUTED'], 'CONFIRMED', ['ADMIN']],
      [['DISPUTED'], 'CANCELLED', ['ADMIN']],
      [['AGREED', 'SITE_VISIT_SCHEDULED', 'INSTALLATION_SCHEDULED'], 'CANCELLED', ['CUSTOMER', 'SHOP']],
    ], canInstallationTransition);
    expect(r.wrong).toEqual([]);
    // Avtomatik tasdiqlash yo‘q (TZ 13.1): tizim INSTALLED → CONFIRMED qila olmaydi.
    expect(() => assertInstallationTransition('INSTALLED', 'CONFIRMED', 'SYSTEM')).toThrow();
  });

  it('Shop (v3.1: ACTIVE ⇄ SUSPENDED, faqat admin)', () => {
    const states = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED'] as const;
    const r = check(states, ['ADMIN'] as const, [
      [['ACTIVE'], 'SUSPENDED', ['ADMIN']],
      [['SUSPENDED'], 'ACTIVE', ['ADMIN']],
    ], (f, t, a) => canShopTransition(f as never, t as never, a));
    expect(r.wrong).toEqual([]);
  });
});
