import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERRORS } from '../constants/error-messages';
import { ADMIN_PERMISSION_KEY } from '../decorators/permission.decorator';
import type { AdminPermission } from '../constants/admin-permissions';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/** Oddiy adminning huquqlarini tekshiradi (superadmin to‘liq huquqli). RolesGuard'dan keyin ishlaydi. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AdminPermission | undefined>(ADMIN_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!user?.sub) throw new ForbiddenException(ERRORS.AUTHORIZATION_REQUIRED);
    const actor = await this.db.user.findUnique({ where: { id: user.sub }, select: { isSuperAdmin: true, adminPermissions: true } });
    if (actor?.isSuperAdmin || actor?.adminPermissions.includes(required)) return true;
    throw new ForbiddenException(ERRORS.ADMIN_PERMISSION_REQUIRED);
  }
}
