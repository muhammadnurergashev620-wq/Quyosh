import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { verifyJwt, type AccessClaims } from '../types/auth.types';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { TooManyRequestsException } from '../exceptions/business.exception';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { ERRORS } from '../constants/error-messages';
import { authCookieNames, panelOf } from '../utils/panel';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const declared = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest();
    const ip = (req.ip ?? req.headers?.['x-forwarded-for'] ?? 'unknown').toString().split(',')[0].trim();
    if (!declared) {
      // Maxsus chegarasiz yo‘llar uchun umumiy IP chegarasi; sog‘liq tekshiruvi va metrikalar cheklanmaydi (webhooklarning o‘z chegarasi bor).
      if (/\/(health|metrics)(\/|\?|$)/.test(req.originalUrl ?? '')) return true;
      const global = this.config.get<{ limit: number; windowSeconds: number }>('limits.global');
      if (!global || global.limit <= 0) return true;
      const { allowed } = await this.redis.consume(`ratelimit:global:ip:${ip}`, global.limit, global.windowSeconds);
      if (!allowed) throw new TooManyRequestsException(ERRORS.RATE_LIMIT_EXCEEDED);
      return true;
    }
    const route = `${req.method}:${req.route?.path ?? req.originalUrl}:${panelOf(req) ?? 'any'}`;

    if (declared.escalate || declared.escalateOnly) {
      const identity = declared.scope === 'ip+phone' && req.body?.phone ? `${route}:${ip}:${req.body.phone}` : `${route}:${ip}`;
      await this.enforceEscalation(identity);
    }
    if (declared.escalateOnly) return true;
    const options = this.resolve(declared);

    let bucketKey = `ratelimit:${route}:ip:${ip}`;
    if (options.scope === 'ip+phone' && req.body?.phone) {
      bucketKey = `ratelimit:${route}:ip+phone:${ip}:${req.body.phone}`;
    }

    if (options.scope === 'user') {
      const userId = this.userIdFrom(req.headers?.cookie, authCookieNames(panelOf(req)).access);
      if (userId) {
        const ipBucket = await this.redis.consume(
          `ratelimit:${route}:ip:${ip}`,
          options.ipLimit ?? options.limit * 5,
          options.windowSeconds,
        );
        if (!ipBucket.allowed) throw new TooManyRequestsException(ERRORS.RATE_LIMIT_EXCEEDED);
        bucketKey = `ratelimit:${route}:user:${userId}`;
      }
    }

    const { allowed } = await this.redis.consume(bucketKey, options.limit, options.windowSeconds);
    if (!allowed) throw new TooManyRequestsException(ERRORS.RATE_LIMIT_EXCEEDED);
    return true;
  }

  /**
   * Kuchayib boruvchi blok: 1 daqiqada `limit` dan ko‘p urinish → 5 daqiqa blok; 24 soat ichida takrorlansa 15 daqiqa,
   * 1 soat, 6 soat, 24 soat... (zinapoya sozlanadi). Blok davomida har bir so‘rov qolgan vaqt haqida 429 oladi.
   */
  private async enforceEscalation(identity: string): Promise<void> {
    const cfg = this.config.get<{ enabled: boolean; limit: number; windowSeconds: number; ladder: number[]; strikeWindowSeconds: number }>('limits.escalation');
    if (!cfg?.enabled) return;
    const blockKey = `rl:esc:block:${identity}`;
    const remaining = await this.redis.ttl(blockKey);
    if (remaining > 0) throw new TooManyRequestsException(ERRORS.RATE_LIMIT_BLOCKED(remaining));

    const { allowed } = await this.redis.consume(`rl:esc:count:${identity}`, cfg.limit, cfg.windowSeconds);
    if (allowed) return;

    const strikeKey = `rl:esc:strikes:${identity}`;
    const { remaining: left } = await this.redis.consume(strikeKey, 1_000_000, cfg.strikeWindowSeconds);
    const strikes = 1_000_000 - left;
    await this.redis.expire(strikeKey, cfg.strikeWindowSeconds); // oxirgi hodisadan 24 soat hisoblanadi
    const seconds = cfg.ladder[Math.min(strikes - 1, cfg.ladder.length - 1)] ?? 300;
    await this.redis.set(blockKey, String(strikes), seconds);
    await this.redis.del(`rl:esc:count:${identity}`);
    throw new TooManyRequestsException(ERRORS.RATE_LIMIT_BLOCKED(seconds));
  }

  private resolve(declared: RateLimitOptions): Required<Pick<RateLimitOptions, 'scope' | 'limit' | 'windowSeconds'>> & { ipLimit?: number } {
    const configured = declared.policy
      ? this.config.get<{ limit: number; windowSeconds: number; ipLimit?: number }>(`limits.rate.${declared.policy}`)
      : undefined;
    const limit = configured?.limit ?? declared.limit;
    const windowSeconds = configured?.windowSeconds ?? declared.windowSeconds;
    if (limit === undefined || windowSeconds === undefined) {
      throw new Error(`RateLimit sozlamasi to'liq emas `);
    }
    return { scope: declared.scope, limit, windowSeconds, ipLimit: configured?.ipLimit ?? declared.ipLimit };
  }

  private userIdFrom(cookieHeader: unknown, cookieName: string): string | null {
    if (typeof cookieHeader !== 'string') return null;
    const token = cookieHeader
      .split(';')
      .map((part) => part.trim().split('='))
      .find(([key]) => key === cookieName)?.[1];
    if (!token) return null;
    try {
      return verifyJwt<AccessClaims>(token, this.config.getOrThrow<string>('auth.jwtSecret'), 'access').sub ?? null;
    } catch {
      return null;
    }
  }
}

