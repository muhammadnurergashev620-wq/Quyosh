import { describe, expect, it } from 'vitest';
import { resolveChannels, smsSendAt, smsText } from './channels';

describe('Bildirishnoma kanallari (TZ 14.2)', () => {
  it('standart, sozlama va o‘chirib bo‘lmaydigan tur', () => {
    expect(resolveChannels('QUOTE_RECEIVED', null)).toEqual(['SMS']);
    expect(resolveChannels('QUOTE_RECEIVED', ['EMAIL'])).toEqual(['EMAIL']);
    expect(resolveChannels('QUOTE_RECEIVED', [])).toEqual([]);
    expect(resolveChannels('REVIEW_REPLY', ['SMS', 'EMAIL'])).toEqual(['EMAIL']);
    expect(resolveChannels('SECURITY_ALERT', [])).toEqual(['SMS', 'EMAIL']);
    expect(resolveChannels('UNKNOWN', ['SMS'])).toEqual([]);
  });
  it('tungi SMS 08:00 ga qoldiriladi, SECURITY_ALERT — yo‘q', () => {
    const at = (s: string) => new Date(`${s}+05:00`);
    expect(smsSendAt('QUOTE_RECEIVED', at('2026-11-02T14:00:00'))).toBeNull();
    expect(smsSendAt('QUOTE_RECEIVED', at('2026-11-02T23:30:00'))?.toISOString()).toBe(at('2026-11-03T08:00:00').toISOString());
    expect(smsSendAt('QUOTE_RECEIVED', at('2026-11-03T03:00:00'))?.toISOString()).toBe(at('2026-11-03T08:00:00').toISOString());
    expect(smsSendAt('SECURITY_ALERT', at('2026-11-03T03:00:00'))).toBeNull();
  });
  it('SMS 160 lotin belgidan oshmaydi', () => {
    const t = smsText('Yangi taklif keldi', 'Quyosh Tech: 20 917 756 so‘m. Batafsil ko‘ring — «solishtiring».'.repeat(3));
    expect(t.length).toBeLessThanOrEqual(160);
    expect(t).toMatch(/^\[Quyosh\] Yangi taklif keldi: /);
    expect(/[^\x20-\x7E]/.test(t)).toBe(false);
  });
});
