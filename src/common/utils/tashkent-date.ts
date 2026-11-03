/** Toshkent vaqti bo‘yicha bugungi sana (YYYY-MM-DD). Kalendar sanalari shu zonada hisoblanadi (TZ 7.1). */
export function tashkentDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Tizim xabarlari uchun: "02.11.2026, 10:00" (Asia/Tashkent). */
export function tashkentDateTime(at: Date | string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(at));
}

/** "20 917 756 so‘m" — oddiy bo‘shliq bilan guruhlangan butun so‘m. */
export function formatSum(value: { toString(): string } | number): string {
  return `${Math.round(Number(value.toString())).toLocaleString('ru-RU').replace(/ /g, ' ')} so‘m`;
}
