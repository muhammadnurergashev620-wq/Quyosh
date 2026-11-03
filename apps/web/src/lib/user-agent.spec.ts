import { describe, expect, it } from 'vitest';
import { describeDevice } from './user-agent';

const UA = {
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

describe('describeDevice', () => {
  it.each([
    [UA.chromeWin, { browser: 'Chrome', os: 'Windows', kind: 'desktop' }],
    [UA.edgeWin, { browser: 'Edge', os: 'Windows', kind: 'desktop' }],
    [UA.firefoxLinux, { browser: 'Firefox', os: 'Linux', kind: 'desktop' }],
    [UA.safariMac, { browser: 'Safari', os: 'macOS', kind: 'desktop' }],
    [UA.safariIphone, { browser: 'Safari', os: 'iOS', kind: 'mobile' }],
    [UA.chromeAndroid, { browser: 'Chrome', os: 'Android', kind: 'mobile' }],
    [UA.ipad, { browser: 'Safari', os: 'iOS', kind: 'tablet' }],
    [UA.androidTablet, { browser: 'Chrome', os: 'Android', kind: 'tablet' }],
  ])('recognises %s', (ua, expected) => {
    expect(describeDevice(ua)).toEqual(expected);
  });

  it('falls back gracefully for missing or unknown agents', () => {
    expect(describeDevice(null)).toEqual({ browser: 'Noma’lum brauzer', os: 'Noma’lum qurilma', kind: 'unknown' });
    expect(describeDevice('curl/8.5.0').browser).toBe('Dastur (API)');
    expect(describeDevice('curl/8.5.0').kind).toBe('unknown');
  });
});
