import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_ROLES_KEY } from '../constants/auth.constants';
import { Role } from '@prisma/client';
import { ERRORS } from '../constants/error-messages';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(AUTH_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException(ERRORS.AUTHORIZATION_REQUIRED);
    if (!Array.isArray(user.roles)) throw new ForbiddenException(ERRORS.INSUFFICIENT_PERMISSIONS);
    if (required.some((role) => user.roles.includes(role))) return true;
    throw new ForbiddenException(ERRORS.INSUFFICIENT_PERMISSIONS);
  }
}
