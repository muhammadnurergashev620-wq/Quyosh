import { describe, expect, it } from 'vitest';
import { consumeReturnTo, isSafeInternalPath, rememberReturnTo } from './return-to';

describe('return-to', () => {
  it('accepts only same-site paths', () => {
    expect(isSafeInternalPath('/mijoz/sorovlar?x=1')).toBe(true);
    for (const bad of ['//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com', 'javascript:alert(1)', '/a\\b', '/\tevil', '', null]) {
      expect(isSafeInternalPath(bad), String(bad)).toBe(false);
    }
  });

  it('stores and consumes once', () => {
    rememberReturnTo('/taklif/abc');
    expect(consumeReturnTo()).toBe('/taklif/abc');
    expect(consumeReturnTo()).toBeNull();
    rememberReturnTo('/\\evil.com');
    expect(consumeReturnTo()).toBeNull();
  });
});

describe('safeExternalUrl', () => {
  it('allows only http(s)', async () => {
    const { safeExternalUrl } = await import('./return-to');
    expect(safeExternalUrl('https://re.jrc.ec.europa.eu/pvg_tools')).toBe('https://re.jrc.ec.europa.eu/pvg_tools');
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeExternalUrl(' JaVaScRiPt:alert(1)')).toBeUndefined();
    expect(safeExternalUrl('data:text/html,x')).toBeUndefined();
    expect(safeExternalUrl(null)).toBeUndefined();
  });
});
