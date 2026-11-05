import { describe, expect, it } from 'vitest';
import { validate } from './validation';

/** render.yaml bilan bir xil to‘plam (qiymatlar soxta): production sozlamalari ilovani ishga tushirishiga ruxsat berishi kerak. */
const RENDER_ENV = {
  NODE_ENV: 'production',
  PORT: '10000', // Render o‘zi beradi
  DATABASE_URL: 'postgresql://neondb_owner:pw@ep-cool-name-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15&connection_limit=5',
  REDIS_URL: 'rediss://default:pw@fit-name-12345.upstash.io:6379',
  JWT_SECRET: 'Kq8vXz2LmR7tYw4NbP9sHd6JfA3cGe5U1oIu0Zx',
  CORS_ORIGINS: 'https://quyosh.example.uz,https://app.quyosh.example.uz',
  AUTH_COOKIE_SECURE: 'true',
  TRUST_PROXY: '1',
};

describe('Render (Neon + Upstash) production muhiti', () => {
  it('Neon pooled URL (sslmode=require) va Upstash rediss:// bilan validatsiyadan o‘tadi; PORT Render’dan keladi', () => {
    const values = validate(RENDER_ENV);
    expect(values.PORT).toBe(10000);
    expect(values.REDIS_URL?.startsWith('rediss://')).toBe(true);
  });

  it('muhim o‘zgaruvchilar yo‘q bo‘lsa — ishga tushmaydi (fail-fast)', () => {
    expect(() => validate({ ...RENDER_ENV, REDIS_URL: undefined })).toThrow();
    expect(() => validate({ ...RENDER_ENV, CORS_ORIGINS: undefined })).toThrow();
    expect(() => validate({ ...RENDER_ENV, CORS_ORIGINS: 'http://quyosh.example.uz' })).toThrow();
    expect(() => validate({ ...RENDER_ENV, JWT_SECRET: 'short' })).toThrow();
    expect(() => validate({ ...RENDER_ENV, OTP_DEV_ECHO: 'true' })).toThrow();
    expect(() => validate({ ...RENDER_ENV, REDIS_URL: 'https://x' })).toThrow();
  });
});
