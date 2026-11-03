import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  accessTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
  refreshTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_MINUTES ?? 60) * 60,
  maxDevices: Number(process.env.MAX_ACTIVE_DEVICES ?? 2),
  cookieSecure: process.env.AUTH_COOKIE_SECURE !== 'false',
  cookieSameSite: (process.env.AUTH_COOKIE_SAME_SITE ?? 'lax') as
    | 'lax'
    | 'strict'
    | 'none',
  cookieDomain: process.env.AUTH_COOKIE_DOMAIN || undefined,
}));
