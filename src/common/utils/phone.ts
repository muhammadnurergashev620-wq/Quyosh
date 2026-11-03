/** +998XXXXXXXXX (E.164). Xorijiy raqam V1.0 da qabul qilinmaydi (TZ 10.1). Noto‘g‘ri bo‘lsa null. */
export function normalizeUzPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  return /^998\d{9}$/.test(digits) ? `+${digits}` : null;
}

/** Telefonni maskalash: +998 90 *** ** 67 (TZ 16, AuditLog va public ko‘rinish). */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length !== 12) return '***';
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} *** ** ${d.slice(10)}`;
}
