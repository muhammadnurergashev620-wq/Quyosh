import { describe, expect, it } from 'vitest';
import { addBusinessHours, firstResponseDue, formatTicketNumber, nextWorkMoment } from './sla';

const T = (s: string) => new Date(`${s}+05:00`);
const iso = (d: Date) => new Date(d.getTime() + 5 * 3_600_000).toISOString().slice(0, 16);

describe('Yordam SLA — ish vaqti (TZ 17.2)', () => {
  it('ish vaqti ichida soat oddiy qo‘shiladi', () => {
    expect(iso(addBusinessHours(T('2026-11-02T10:00:00'), 4))).toBe('2026-11-02T14:00');
  });
  it('18:00 dan keyingi murojaat ertangi 09:00 dan hisoblanadi', () => {
    expect(iso(nextWorkMoment(T('2026-11-02T19:30:00')))).toBe('2026-11-03T09:00');
    expect(iso(firstResponseDue(T('2026-11-02T19:30:00'), 'NORMAL'))).toBe('2026-11-03T13:00');
  });
  it('kun oxirida qolgan soat ertangi kunga o‘tadi', () => {
    expect(iso(addBusinessHours(T('2026-11-02T16:30:00'), 4))).toBe('2026-11-03T11:30');
  });
  it('dam olish kunlari hisoblanmaydi (juma kechqurun → dushanba)', () => {
    // 2026-11-06 — juma, 07 — shanba.
    expect(iso(addBusinessHours(T('2026-11-06T17:00:00'), 2))).toBe('2026-11-09T10:00');
    expect(iso(firstResponseDue(T('2026-11-07T12:00:00'), 'URGENT'))).toBe('2026-11-09T10:00');
  });
  it('ertalab 09:00 dan oldin — 09:00 dan', () => {
    expect(iso(firstResponseDue(T('2026-11-03T06:00:00'), 'HIGH'))).toBe('2026-11-03T11:00');
  });
  it('raqam formati', () => {
    expect(formatTicketNumber(123)).toBe('SUP-000123');
  });
});
