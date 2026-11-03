import { CanActivate, ExecutionContext, ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../constants/error-messages';
import { OWNER_ONLY_PERMISSIONS, type ShopPermission } from '../constants/shop-permissions';
import { SHOP_PERMISSION_KEY, SHOP_READONLY_KEY, type ShopContext } from '../decorators/shop-permission.decorator';
import { DomainException } from '../exceptions/business.exception';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Do‘kon zanjiri (TZ 2.3, 6.3): yo‘ldagi `:shopId` bo‘yicha a’zolik → kerakli ruxsat.
 * Faqat `ShopMember` ga qaraydi — `User.role` (ADMIN ham) bu yerda hech qanday huquq bermaydi.
 * A’zo bo‘lmasa yoki do‘kon yo‘q bo‘lsa — 404 (mavjudlikni oshkor qilmaslik); ruxsat yetmasa — 403.
 */
@Injectable()
export class ShopAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.sub;
    const shopId: string | undefined = req.params?.shopId;
    if (!userId) throw new ForbiddenException(ERRORS.AUTHORIZATION_REQUIRED);
    if (!shopId || !UUID.test(shopId)) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);

    const member = await this.db.shopMember.findUnique({
      where: { shopId_userId: { shopId, userId } },
      select: { id: true, memberRole: true, permissions: true, shop: { select: { status: true, archivedAt: true } } },
    });
    if (!member || member.shop.archivedAt) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);

    const required = this.reflector.getAllAndOverride<ShopPermission | undefined>(SHOP_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (required) {
      const ownerOnly = (OWNER_ONLY_PERMISSIONS as readonly string[]).includes(required);
      const allowed = member.memberRole === 'OWNER' || (!ownerOnly && member.permissions.includes(required));
      if (!allowed) throw new ForbiddenException(ERRORS.SHOP_PERMISSION_REQUIRED);
    }

    // To‘xtatilgan do‘kon: a’zolar faqat o‘qiy oladi (TZ 3.7.3) — 423 SHOP_SUSPENDED.
    const readOnlyAllowed = req.method === 'GET' || this.reflector.getAllAndOverride<boolean>(SHOP_READONLY_KEY, [context.getHandler(), context.getClass()]);
    if (member.shop.status === 'SUSPENDED' && !readOnlyAllowed) {
      throw new DomainException(HttpStatus.LOCKED, 'SHOP_SUSPENDED', ERRORS.SHOP_SUSPENDED);
    }

    const shop: ShopContext = { shopId, memberId: member.id, memberRole: member.memberRole, permissions: member.permissions, shopStatus: member.shop.status };
    req.shop = shop;
    return true;
  }
}
