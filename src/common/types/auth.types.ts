import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Role, UserStatus } from '@prisma/client';
import { ERRORS } from '../constants/error-messages';

export interface AccessClaims {
  sub: string;
  roles: Role[];
  status: UserStatus;
  deviceId: string;
  type: 'access';
  iat: number;
  exp: number;
}

export interface RefreshClaims {
  sub: string;
  deviceId: string;
  familyId: string;
  jti: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

export type AuthClaims = AccessClaims | RefreshClaims;

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function signPart(header: string, payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
}

export function createJwt<T extends AuthClaims>(
  claims: Omit<T, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds: number,
): string {
  if (secret.length < 32) throw new Error(ERRORS.JWT_SECRET_SHORT);
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error(ERRORS.JWT_TTL_INVALID);
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlJson({ ...claims, iat: now, exp: now + ttlSeconds });
  return `${header}.${payload}.${signPart(header, payload, secret)}`;
}

export function verifyJwt<T extends AuthClaims>(
  token: string,
  secret: string,
  type: T['type'],
): T {
  if (secret.length < 32) throw new Error(ERRORS.JWT_SECRET_SHORT);

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error(ERRORS.INVALID_TOKEN);

  const [headerPart, payloadPart, signaturePart] = parts;
  let header: { alg?: string; typ?: string };
  let payload: T;

  try {
    header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as T;
  } catch {
    throw new Error(ERRORS.INVALID_TOKEN);
  }

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error(ERRORS.INVALID_TOKEN);
  }

  const expected = signPart(headerPart, payloadPart, secret);
  const actualBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error(ERRORS.INVALID_TOKEN);
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.type !== type ||
    !payload.sub ||
    !payload.iat ||
    !payload.exp ||
    payload.exp <= now ||
    payload.iat > now + 60
  ) {
    throw new Error(ERRORS.INVALID_TOKEN);
  }

  return payload;
}

export function newOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
