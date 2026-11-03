import { describe, expect, it } from 'vitest';
import { validate } from './validation';

const STRONG = 'k9Qz!x7Lm2Vb8Nc4Rt6Yp1Ws3Df5Gh0Jq-zXcVbNm';
const base = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: 'postgresql://u:p@db:5432/app',
  REDIS_URL: 'redis://redis:6379',
  JWT_SECRET: STRONG,
  CORS_ORIGINS: 'https://app.quyosh.uz,capacitor://localhost',
};

describe('production hardening (fail-fast)', () => {
  it('accepts a safe production config', () => {
    expect(() => validate({ ...base })).not.toThrow();
  });

  it.each([
    ['dev OTP echo', { OTP_DEV_ECHO: 'true' }],
    ['dev OTP echo (auth)', { OTP_DEV_ECHO_AUTH: 'true' }],
    ['missing CORS origins', { CORS_ORIGINS: '' }],
    ['wildcard CORS', { CORS_ORIGINS: '*' }],
    ['plain-http CORS origin', { CORS_ORIGINS: 'https://app.quyosh.uz,http://evil.example' }],
    ['plain-http localhost CORS origin', { CORS_ORIGINS: 'http://localhost:5173' }],
    ['placeholder JWT secret', { JWT_SECRET: 'change-me-change-me-change-me-change-me-please' }],
    ['low-entropy JWT secret', { JWT_SECRET: 'a'.repeat(48) }],
    ['short admin password', { ADMIN_PASSWORD: 'short1' }],
    ['insecure cookies', { AUTH_COOKIE_SECURE: 'false' }],
  ])('refuses to start in production with %s', (_name, override) => {
    expect(() => validate({ ...base, ...override })).toThrow();
  });

  it('does not apply these rules outside production', () => {
    expect(() => validate({ ...base, NODE_ENV: 'development', OTP_DEV_ECHO: 'true', CORS_ORIGINS: 'http://localhost:5173' })).not.toThrow();
  });
});
