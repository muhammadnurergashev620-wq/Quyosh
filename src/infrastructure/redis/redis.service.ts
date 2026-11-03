import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.getOrThrow<string>('redis.url');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  async ping(): Promise<boolean> {
    return (await this.client.ping()) === 'PONG';
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
    else await this.client.set(key, value);
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  /** Alohida ulanishda kanalga obuna bo‘ladi (obuna rejimidagi ulanish boshqa buyruqlar uchun yaroqsiz). Qaytgan funksiya obunani yopadi. */
  async subscribe(channel: string, handler: (message: string) => void): Promise<() => Promise<void>> {
    const subscriber = this.client.duplicate();
    subscriber.on('message', (received, message) => {
      if (received === channel) handler(message);
    });
    await subscriber.subscribe(channel);
    return async () => {
      subscriber.disconnect();
    };
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async consume(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const pipeline = this.client.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);
    const results = await pipeline.exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    const ttl = Number(results?.[1]?.[1] ?? -1);

    if (count === 1 || ttl === -1) {
      await this.client.expire(key, windowSeconds);
    }

    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  }
}
