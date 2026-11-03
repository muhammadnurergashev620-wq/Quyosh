import { HttpStatus } from '@nestjs/common';
import { ERRORS } from '../constants/error-messages';
import { DomainException } from '../exceptions/business.exception';

/** TZ 13.1: o‘tish jadvali. `from` ro‘yxatidagi har holatdan `to` ga faqat ko‘rsatilgan aktorlar o‘tkaza oladi. */
export type TransitionTable<S extends string, A extends string> = ReadonlyArray<{ from: readonly S[]; to: S; actors: readonly A[] }>;

export function canTransitionIn<S extends string, A extends string>(table: TransitionTable<S, A>, from: S, to: S, actor: A): boolean {
  return table.some((row) => row.to === to && row.from.includes(from) && row.actors.includes(actor));
}

/** Jadvalda yo‘q o‘tish — 409 INVALID_STATUS_TRANSITION (controller emas, service chaqiradi). */
export function assertTransitionIn<S extends string, A extends string>(table: TransitionTable<S, A>, from: S, to: S, actor: A): void {
  if (!canTransitionIn(table, from, to, actor)) {
    throw new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);
  }
}
