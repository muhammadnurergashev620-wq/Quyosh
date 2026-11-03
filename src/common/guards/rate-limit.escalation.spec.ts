import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

/** Vaqtni Date.now() bo‘yicha hisoblaydigan, Redis xatti-harakatini taqlid qiluvchi oddiy xotira. */
class FakeRedis {
  private data = new Map<string, { value: string; expiresAt: number | null }>();
  private live(key: string) {
    const item = this.data.get(key);
    if (item && item.expiresAt !== null && item.expiresAt <= Date.now()) this.data.delete(key);
    return this.data.get(key);
  }
  async get(key: string) {
    return this.live(key)?.value ?? null;
  }
  async set(key: string, value: string, ttl?: number) {
    this.data.set(key, { value, expiresAt: ttl ? Date.now() + ttl * 1000 : null });
  }
  async del(key: string) {
    this.data.delete(key);
  }
  async ttl(key: string) {
    const item = this.live(key);
    if (!item) return -2;
    return item.expiresAt === null ? -1 : Math.ceil((item.expiresAt - Date.now()) / 1000);
  }
  async expire(key: string, seconds: number) {
    const item = this.live(key);
    if (item) item.expiresAt = Date.now() + seconds * 1000;
  }
  async consume(key: string, limit: number, windowSeconds: number) {
    const item = this.live(key);
    const count = Number(item?.value ?? 0) + 1;
    this.data.set(key, { value: String(count), expiresAt: item?.expiresAt ?? Date.now() + windowSeconds * 1000 });
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  }
}

const context = (ip: string, phone = '+998901234567'): ExecutionContext =>
  ({
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ ip, method: 'POST', route: { path: '/auth/login' }, body: { phone }, headers: {} }) }),
  }) as unknown as ExecutionContext;

function build(ladder = [300, 900, 3600, 21600, 86400]) {
  const redis = new FakeRedis();
  const reflector = { getAllAndOverride: () => ({ scope: 'ip+phone', escalateOnly: true }) };
  const config = {
    get: (key: string) =>
      key === 'limits.escalation'
        ? { enabled: true, limit: 3, windowSeconds: 60, ladder, strikeWindowSeconds: 86400 }
        : undefined,
    getOrThrow: () => 'secret',
  };
  return new RateLimitGuard(reflector as never, redis as never, config as never);
}

const attempt = async (guard: RateLimitGuard, ip = '1.1.1.1') => {
  try {
    await guard.canActivate(context(ip));
    return 'ok';
  } catch (error) {
    return (error as { response?: { message?: string } }).response?.message ?? String(error);
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('escalating block (3 per minute → 5 min, then longer on repeats within 24 h)', () => {
  it('allows 3 attempts a minute, blocks the 4th for 5 minutes, and keeps blocking during that time', async () => {
    const guard = build();
    expect([await attempt(guard), await attempt(guard), await attempt(guard)]).toEqual(['ok', 'ok', 'ok']);
    expect(await attempt(guard)).toMatch(/5 daqiqa/);
    vi.advanceTimersByTime(4 * 60_000);
    expect(await attempt(guard)).toMatch(/\d+ (daqiqa|soniya)/); // hali blok
    vi.advanceTimersByTime(61_000); // jami > 5 daqiqa
    expect(await attempt(guard)).toBe('ok');
  });

  it('lengthens the block each time it repeats within 24 hours: 5 min → 15 min → 1 hour → 6 hours → 24 hours', async () => {
    const ladder = [300, 900, 3600, 21600, 86400];
    const guard = build(ladder);
    const expected = [/5 daqiqa/, /15 daqiqa/, /60 daqiqa|1 soat/, /6 soat|360 daqiqa/, /24 soat|1440 daqiqa/];
    for (const [index, pattern] of expected.entries()) {
      for (let i = 0; i < 3; i += 1) expect(await attempt(guard)).toBe('ok');
      expect(await attempt(guard)).toMatch(pattern);
      vi.advanceTimersByTime((ladder[index] as number) * 1000 + 1000); // blok tugaguncha
    }
  });

  it('stays at the last step of the ladder when violations keep repeating', async () => {
    const guard = build([300, 900]);
    const results: string[] = [];
    for (let round = 0; round < 3; round += 1) {
      for (let i = 0; i < 3; i += 1) await attempt(guard);
      results.push(await attempt(guard));
      vi.advanceTimersByTime(901_000);
    }
    expect(results[0]).toMatch(/5 daqiqa/);
    expect(results[1]).toMatch(/15 daqiqa/);
    expect(results[2]).toMatch(/15 daqiqa/);
  });

  it('forgets earlier violations after 24 quiet hours (back to a 5-minute block)', async () => {
    const guard = build();
    for (let i = 0; i < 3; i += 1) await attempt(guard);
    expect(await attempt(guard)).toMatch(/5 daqiqa/);
    vi.advanceTimersByTime(24 * 3600_000 + 1000);
    for (let i = 0; i < 3; i += 1) await attempt(guard);
    expect(await attempt(guard)).toMatch(/5 daqiqa/);
  });

  it('tracks each identity separately (another phone / another IP is not blocked)', async () => {
    const guard = build();
    for (let i = 0; i < 4; i += 1) await attempt(guard, '2.2.2.2');
    expect(await attempt(guard, '3.3.3.3')).toBe('ok');
  });
});
