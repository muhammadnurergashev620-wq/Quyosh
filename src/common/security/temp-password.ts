import { randomInt } from 'node:crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '#$%&*+-=?@';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

export const TEMP_PASSWORD_LENGTH = 16;

const pick = (set: string) => set[randomInt(set.length)]!;

/**
 * Vaqtincha parol (TZ 3.7.1): kriptografik tasodifiy, ≥ 12 belgi (standart 16), har sinfdan kamida bittadan.
 * O‘qishda adashtiriladigan belgilar (0/O, 1/l/I) yo‘q — admin uni ovoz bilan yoki qo‘lda yetkazishi mumkin.
 */
export function generateTempPassword(length = TEMP_PASSWORD_LENGTH): string {
  if (length < 12) throw new Error('Vaqtincha parol kamida 12 belgi bo‘lishi kerak');
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Fisher–Yates: majburiy sinflar boshida qolib ketmasin.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
