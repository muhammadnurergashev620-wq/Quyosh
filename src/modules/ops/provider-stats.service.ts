import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';

export const PROVIDERS = ['ESRI_GEOCODE', 'ESRI_BASEMAP', 'PVGIS', 'NASA_POWER', 'SMS', 'EMAIL'] as const;
export type Provider = (typeof PROVIDERS)[number];

const month = (d = new Date()) => d.toISOString().slice(0, 7);
const day = (d = new Date()) => d.toISOString().slice(0, 10);
const BIG = 2_000_000_000;

/**
 * Tashqi provayder so‘rovlari hisoblagichi (TZ 19.1.1, 14.1 provider-quota-poll): Redis’da kunlik va oylik
 * muvaffaqiyat/xato soni. Hisoblagich xatosi asosiy oqimni to‘xtatmaydi.
 */
@Injectable()
export class ProviderStatsService {
  constructor(private readonly redis: RedisService) {}

  private async bump(provider: Provider, ok: boolean) {
    const kind = ok ? 'ok' : 'fail';
    await Promise.all([
      this.redis.consume(`ps:${provider}:m:${month()}:${kind}`, BIG, 40 * 86_400),
      this.redis.consume(`ps:${provider}:d:${day()}:${kind}`, BIG, 3 * 86_400),
    ]).catch(() => undefined);
  }

  record(provider: Provider, ok: boolean) {
    void this.bump(provider, ok);
  }

  async measure<T>(provider: Provider, fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.record(provider, true);
      return result;
    } catch (error) {
      this.record(provider, false);
      throw error;
    }
  }

  async counters(provider: Provider, at = new Date()) {
    const read = async (k: string) => Number((await this.redis.get(k).catch(() => null)) ?? 0);
    const [mOk, mFail, dOk, dFail] = await Promise.all([
      read(`ps:${provider}:m:${month(at)}:ok`), read(`ps:${provider}:m:${month(at)}:fail`),
      read(`ps:${provider}:d:${day(at)}:ok`), read(`ps:${provider}:d:${day(at)}:fail`),
    ]);
    return { month: { ok: mOk, fail: mFail }, day: { ok: dOk, fail: dFail } };
  }
}
