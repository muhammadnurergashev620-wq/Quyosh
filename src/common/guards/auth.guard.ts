import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SessionStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AUTH_OPTIONAL_KEY, AUTH_PUBLIC_KEY } from '../constants/auth.constants';
import { authCookieNames, panelOf } from '../utils/panel';
import { AccessClaims, verifyJwt } from '../types/auth.types';
import { ERRORS } from '../constants/error-messages';

/**
 * Vaqtincha parol bilan kirgan (User.mustPasswordChange) foydalanuvchi uchun ochiq yo‘llar (TZ 6.4):
 * o‘z profili, do‘konlar ro‘yxati, yangi parol o‘rnatish va chiqish. Qolgan hamma narsa — 403 PASSWORD_CHANGE_REQUIRED.
 */
const PASSWORD_CHANGE_ALLOWED: Array<{ method: string; path: RegExp }> = [
  { method: 'GET', path: /^\/api\/v1\/users\/me$/ },
  { method: 'GET', path: /^\/api\/v1\/me\/shops$/ },
  { method: 'POST', path: /^\/api\/v1\/users\/me\/password\/first$/ },
  { method: 'POST', path: /^\/api\/v1\/auth\/logout$/ },
];

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(AUTH_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();
    if (isPublic) {
      // @OptionalAuth: ochiq endpoint, lekin yaroqli sessiya bo‘lsa foydalanuvchi aniqlanadi (guest — xatosiz).
      if (this.reflector.getAllAndOverride<boolean>(AUTH_OPTIONAL_KEY, [context.getHandler(), context.getClass()])) {
        await this.authenticate(request).catch(() => undefined);
      }
      return true;
    }
    await this.authenticate(request);
    return true;
  }

  private async authenticate(request: { headers?: Record<string, unknown>; user?: unknown; method?: string; originalUrl?: string }): Promise<void> {
    const accessToken = this.getCookie(request.headers?.cookie, authCookieNames(panelOf(request as never)).access) ?? this.getBearerToken(request.headers?.authorization);
    if (!accessToken) throw new UnauthorizedException(ERRORS.ACCESS_TOKEN_MISSING);

    let claims: AccessClaims;
    try {
      claims = verifyJwt<AccessClaims>(
        accessToken,
        this.config.getOrThrow<string>('auth.jwtSecret'),
        'access',
      );
    } catch {
      throw new UnauthorizedException(ERRORS.INVALID_TOKEN);
    }

    if (
      claims.status !== UserStatus.ACTIVE ||
      !claims.sub ||
      !claims.deviceId ||
      !Array.isArray(claims.roles)
    ) {
      throw new UnauthorizedException(ERRORS.AUTHENTICATION_REQUIRED);
    }

    const session = await this.prisma.deviceSession.findUnique({
      where: {
        userId_deviceId: {
          userId: claims.sub,
          deviceId: claims.deviceId,
        },
      },
      include: {
        user: {
          select: {
            status: true,
            deletedAt: true,
            mustPasswordChange: true,
            userRoles: { select: { role: true } },
          },
        },
      },
    });

    if (
      !session ||
      session.status !== SessionStatus.ACTIVE ||
      session.revokedAt !== null ||
      session.user.deletedAt !== null ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException(ERRORS.AUTHENTICATION_REQUIRED);
    }

    if (session.user.mustPasswordChange) {
      const path = (request.originalUrl ?? '').split('?')[0]!.replace(/\/+$/, '');
      const method = (request.method ?? '').toUpperCase();
      if (!PASSWORD_CHANGE_ALLOWED.some((rule) => rule.method === method && rule.path.test(path))) {
        throw new ForbiddenException({ code: 'PASSWORD_CHANGE_REQUIRED', message: ERRORS.PASSWORD_CHANGE_REQUIRED });
      }
    }

    await this.prisma.deviceSession.updateMany({
      where: { id: session.id, status: SessionStatus.ACTIVE },
      data: { lastSeenAt: new Date() },
    });

    request.user = {
      sub: claims.sub,
      roles: session.user.userRoles.map((item) => item.role),
      status: session.user.status,
      deviceId: claims.deviceId,
    };
  }

  private getBearerToken(header: unknown): string | undefined {
    if (typeof header !== 'string') return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : undefined;
  }

  private getCookie(header: unknown, name: string): string | undefined {
    if (typeof header !== 'string') return undefined;
    for (const part of header.split(';')) {
      const [key, ...parts] = part.trim().split('=');
      if (key === name) {
        const value = parts.join('=');
        return value ? decodeURIComponent(value) : undefined;
      }
    }
    return undefined;
  }
}
