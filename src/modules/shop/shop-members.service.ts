import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DEFAULT_PERMISSIONS } from '../../common/constants/shop-permissions';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import { UpdateMemberDto } from './dto/shop.dto';

/**
 * Do‘kon a’zolari (v3.1): ro‘yxat, ruxsatlarni o‘zgartirish va chiqarish — egaga (`members.manage`).
 * Yangi a’zoni (hisob + vaqtincha parol) faqat admin qo‘shadi: `AdminShopsService.addMember`.
 */
@Injectable()
export class ShopMembersService {
  constructor(private readonly db: PrismaService) {}

  async listMembers(shopId: string) {
    const members = await this.db.shopMember.findMany({
      where: { shopId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, memberRole: true, permissions: true, createdAt: true, user: { select: { id: true, accountNumber: true, firstName: true, lastName: true, phone: true, email: true, avatarAssetId: true } } },
    });
    return { members };
  }

  private async memberOrThrow(shopId: string, memberId: string) {
    const member = await this.db.shopMember.findFirst({ where: { id: memberId, shopId } });
    if (!member) throw new NotFoundException(ERRORS.SHOP_MEMBER_NOT_FOUND);
    if (member.memberRole === 'OWNER') throw new ForbiddenException(ERRORS.SHOP_OWNER_IMMUTABLE);
    return member;
  }

  async updateMember(ctx: ShopContext, actorId: string, memberId: string, dto: UpdateMemberDto) {
    const member = await this.memberOrThrow(ctx.shopId, memberId);
    const memberRole = dto.memberRole ?? (member.memberRole as 'MANAGER' | 'STAFF');
    const permissions = dto.permissions ?? (dto.memberRole ? DEFAULT_PERMISSIONS[memberRole] : member.permissions);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.shopMember.update({ where: { id: memberId }, data: { memberRole, permissions } });
      await tx.auditLog.create({ data: { actorId, action: 'SHOP_MEMBER_UPDATED', targetType: 'Shop', targetId: ctx.shopId, before: { memberRole: member.memberRole, permissions: member.permissions }, after: { memberRole, permissions } } });
      return updated;
    });
  }

  async removeMember(ctx: ShopContext, actorId: string, memberId: string) {
    const member = await this.memberOrThrow(ctx.shopId, memberId);
    await this.db.$transaction(async (tx) => {
      await tx.shopMember.delete({ where: { id: memberId } });
      await this.dropShopRoleIfNoMemberships(tx, member.userId);
      await tx.auditLog.create({ data: { actorId, action: 'SHOP_MEMBER_REMOVED', targetType: 'Shop', targetId: ctx.shopId, before: { memberId, userId: member.userId, memberRole: member.memberRole } } });
    });
    return { id: memberId, removed: true };
  }

  /** Oxirgi a’zolik tugasa SHOP roli olinadi va sessiyalar bekor qilinadi (hisob do‘kon panelida ishlamaydi). */
  async dropShopRoleIfNoMemberships(tx: Prisma.TransactionClient, userId: string) {
    const left = await tx.shopMember.count({ where: { userId } });
    if (left > 0) return;
    await tx.userRole.deleteMany({ where: { userId, role: Role.SHOP } });
    const revokedAt = new Date();
    await tx.refreshToken.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt } });
    await tx.deviceSession.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt } });
  }
}
