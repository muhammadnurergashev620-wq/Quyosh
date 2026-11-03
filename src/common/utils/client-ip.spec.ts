import { describe, expect, it } from 'vitest';
import { clientIpOf } from './client-ip';

describe('clientIpOf', () => {
  it('uses only the proxy-aware req.ip and never trusts a raw X-Forwarded-For header', () => {
    const req = { ip: '203.0.113.7', headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '10.0.0.1' } };
    expect(clientIpOf(req as never)).toBe('203.0.113.7');
  });

  it('falls back to the socket address and strips the IPv4-mapped prefix', () => {
    expect(clientIpOf({ ip: undefined, socket: { remoteAddress: '::ffff:192.168.1.9' } } as never)).toBe('192.168.1.9');
  });
});
