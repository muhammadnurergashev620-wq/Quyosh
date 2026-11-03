import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export type RateLimitPolicy = 'register' | 'login' | 'otpRequest' | 'otpVerify' | 'chat' | 'call' | 'callSignal';

export interface RateLimitOptions {
  scope: 'ip' | 'ip+phone' | 'user';
  policy?: RateLimitPolicy;
  limit?: number;
  windowSeconds?: number;
  ipLimit?: number;
  /** Kuchayib boruvchi blok (1 daqiqada 3 tadan ko‘p urinish → 5 daqiqa, takrorlansa uzayib boradi) qo‘llansin. */
  escalate?: boolean;
  /** Faqat kuchayib boruvchi blok (oddiy chegarasiz). */
  escalateOnly?: boolean;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
