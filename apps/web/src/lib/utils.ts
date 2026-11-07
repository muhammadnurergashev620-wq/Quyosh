export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** Pul maydoni uchun: faqat raqamlar va birinchi raqam 0 bo‘lmaydi («0», «007» → «», «7»). Xato ko‘rsatilmaydi — 0 shunchaki yozilmaydi. */
export function sanitizeMoney(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  // Server chegarasi: 1 milliarddan oshmaydi.
  return digits.length > 10 || Number(digits) > 1_000_000_000 ? '1000000000' : digits;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function initials(name: string | null | undefined): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word));
  if (words.length === 0) return '•';
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

