import { describe, expect, it } from 'vitest';
import { humanizeServerText } from './format';

describe('humanizeServerText', () => {
  it('ISO sana-vaqtni mahalliy formatga keltiradi', () => {
    const out = humanizeServerText('O‘lchov uchrashuvi tasdiqlandi: 2026-11-02T05:00:00.000Z');
    expect(out).not.toMatch(/T05:00/);
    expect(out).toMatch(/2026/);
  });
  it('ajratilmagan summani guruhlaydi', () => {
    expect(humanizeServerText('Do‘kon taklif yubordi: 20917756 so‘m')).toMatch(/20.917.756 so‘m/);
  });
  it('oddiy matnga tegmaydi', () => {
    expect(humanizeServerText('Montaj bajarildi')).toBe('Montaj bajarildi');
  });
});
