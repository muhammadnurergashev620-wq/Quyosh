import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ShopMemberRole, ShopStatus } from '@prisma/client';
import type { ShopPermission } from '../constants/shop-permissions';

export const SHOP_PERMISSION_KEY = 'shop:permission';
export const SHOP_READONLY_KEY = 'shop:readonly-allowed';

/** Do‘kon endpointi uchun kerakli ruxsat (TZ 2.2). Faqat `ShopAccessGuard` bilan ishlaydi. */
export const RequireShopPermission = (permission: ShopPermission) => SetMetadata(SHOP_PERMISSION_KEY, permission);

/** To‘xtatilgan do‘kon a’zolari ham bajara oladigan (o‘qish) amal (TZ 3.7.3). GET avtomatik shunday. */
export const AllowSuspendedShop = () => SetMetadata(SHOP_READONLY_KEY, true);

export interface ShopContext {
  shopId: string;
  memberId: string;
  memberRole: ShopMemberRole;
  permissions: string[];
  shopStatus: ShopStatus;
}

/** Guard yuklagan a’zolik konteksti. */
export const CurrentShop = createParamDecorator((_data: unknown, ctx: ExecutionContext): ShopContext => ctx.switchToHttp().getRequest().shop);
