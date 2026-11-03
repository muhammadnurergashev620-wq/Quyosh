import { ForbiddenException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role, ShopInvitationPurpose, ShopMemberRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { SmsService } from '../../infrastructure/sms/sms.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DEFAULT_PERMISSIONS } from '../../common/constants/shop-permissions';
import { DomainException } from '../../common/exceptions/business.exception';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import { normalizeUzPhone } from '../../common/utils/phone';
import { conflict, MAX_OWNED_SHOPS } from './shop.service';
import { InviteMemberDto, UpdateMemberDto } from './dto/shop.dto';

const INVITE_TTL_MS = 7 * 86_400_000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

interface InviteParams {
  shopId: string;
  invitedByUserId: string;
  target: string;
  memberRole: ShopMemberRole;
  permissions: string[];
  purpose: ShopInvitationPurpose;
}

@Injectable()
export class ShopMembersService {
  private readonly logger = new Logger(ShopMembersService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly sms: SmsService,
    private readonly config: ConfigService,
  ) {}

  /** Telefon (+998…) yoki email; boshqa format — 422. */
  normalizeTarget(raw: string): string {
    const value = raw.trim();
    if (value.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', ERRORS.INVITATION_CONTACT_MISMATCH);
      return value.toLowerCase();
    }
    const phone = normalizeUzPhone(value);
    if (!phone) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', ERRORS.INVITATION_CONTACT_MISMATCH);
    return phone;
  }

  private inviteLink(token: string) {
    const base = (this.config.get<string>('app.shopUrl') ?? 'http://localhost:5174').replace(/\/$/, '');
    return `${base}/taklif/${token}`;
  }

  private devEcho() {
    return this.config.get<string>('app.environment') !== 'production' && process.env.OTP_DEV_ECHO === 'true';
  }

  /**
   * Taklif yaratadi (TZ 3.7.1). Token faqat bir marta qaytariladi; bazada sha256 xeshi saqlanadi.
   * INITIAL_OWNER/TRANSFER uchun bir vaqtda bitta PENDING taklif (partial unique index).
   */
  async createInvitation(tx: Prisma.TransactionClient, params: InviteParams) {
    const token = randomBytes(32).toString('base64url');
    if (params.purpose !== 'MEMBER') {
      await tx.shopInvitation.updateMany({ where: { shopId: params.shopId, purpose: params.purpose, status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
      const pending = await tx.shopInvitation.count({ where: { shopId: params.shopId, memberRole: 'OWNER', status: 'PENDING' } });
      if (pending > 0) throw conflict('INVITATION_PENDING_EXISTS', ERRORS.INVITATION_PENDING_EXISTS);
    }
    const invitation = await tx.shopInvitation.create({
      data: { ...params, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    });
    await tx.auditLog.create({ data: { actorId: params.invitedByUserId, action: 'SHOP_INVITATION_CREATED', targetType: 'Shop', targetId: params.shopId, after: { invitationId: invitation.id, purpose: params.purpose, memberRole: params.memberRole } } });
    return { invitation, token, link: this.inviteLink(token) };
  }

  /** Tranzaksiyadan keyin: SMS yuborish (best-effort) va javob. */
  async deliver(result: { invitation: { id: string; target: string; expiresAt: Date }; link: string }, shopName: string) {
    if (!result.invitation.target.includes('@')) {
      try {
        await this.sms.send(result.invitation.target, `Quyosh.uz: «${shopName}» do‘koniga taklif. Havola: ${result.link}`);
      } catch (error) {
        this.logger.warn(`Taklif SMS yuborilmadi: ${(error as Error).message}`);
      }
    }
    return { id: result.invitation.id, target: result.invitation.target, expiresAt: result.invitation.expiresAt, ...(this.devEcho() ? { developmentLink: result.link } : {}) };
  }

  async listMembers(shopId: string) {
    const [members, invitations] = await Promise.all([
      this.db.shopMember.findMany({
        where: { shopId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, memberRole: true, permissions: true, createdAt: true, user: { select: { id: true, accountNumber: true, firstName: true, lastName: true, phone: true, email: true, avatarAssetId: true } } },
      }),
      this.db.shopInvitation.findMany({
        where: { shopId, status: 'PENDING', expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, target: true, memberRole: true, permissions: true, purpose: true, expiresAt: true, createdAt: true },
      }),
    ]);
    return { members, invitations };
  }

  async invite(ctx: ShopContext, actorId: string, dto: InviteMemberDto) {
    const target = this.normalizeTarget(dto.target);
    const existing = await this.db.shopMember.findFirst({ where: { shopId: ctx.shopId, user: target.includes('@') ? { email: target } : { phone: target } }, select: { id: true } });
    if (existing) throw conflict('SHOP_MEMBER_EXISTS', ERRORS.SHOP_MEMBER_EXISTS);
    const shop = await this.db.shop.findUniqueOrThrow({ where: { id: ctx.shopId }, select: { name: true } });
    const result = await this.db.$transaction((tx) =>
      this.createInvitation(tx, {
        shopId: ctx.shopId,
        invitedByUserId: actorId,
        target,
        memberRole: dto.memberRole,
        permissions: dto.permissions ?? DEFAULT_PERMISSIONS[dto.memberRole],
        purpose: 'MEMBER',
      }),
    );
    return this.deliver(result, shop.name);
  }

  async revokeInvitation(shopId: string, actorId: string, invitationId: string) {
    const updated = await this.db.shopInvitation.updateMany({ where: { id: invitationId, shopId, status: 'PENDING' }, data: { status: 'REVOKED' } });
    if (updated.count === 0) throw new NotFoundException(ERRORS.INVITATION_INVALID);
    await this.db.auditLog.create({ data: { actorId, action: 'SHOP_INVITATION_REVOKED', targetType: 'Shop', targetId: shopId, after: { invitationId } } });
    return { id: invitationId, status: 'REVOKED' };
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
      await tx.auditLog.create({ data: { actorId, action: 'SHOP_MEMBER_UPDATED', targetType: 'Shop', targetId: ctx.shopId, before: { memberRole: member.memberRole, permissions: member.permissions }, after: { memberId, memberRole, permissions } } });
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

  private async dropShopRoleIfNoMemberships(tx: Prisma.TransactionClient, userId: string) {
    const left = await tx.shopMember.count({ where: { userId } });
    if (left === 0) await tx.userRole.deleteMany({ where: { userId, role: Role.SHOP } });
  }

  /** Token bo‘yicha taklif ko‘rinishi (qabul sahifasi uchun, login talab qilinmaydi). */
  async preview(token: string) {
    const invitation = await this.db.shopInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { status: true, expiresAt: true, memberRole: true, purpose: true, target: true, shop: { select: { name: true, slug: true } } },
    });
    if (!invitation || invitation.status === 'REVOKED' || invitation.status === 'ACCEPTED') throw new NotFoundException(ERRORS.INVITATION_INVALID);
    const expired = invitation.status === 'EXPIRED' || invitation.expiresAt < new Date();
    const masked = invitation.target.includes('@') ? invitation.target.replace(/^(.).+(@.+)$/, '$1***$2') : invitation.target.replace(/^(\+998\d{2})\d{5}(\d{2})$/, '$1*****$2');
    return { shop: invitation.shop, memberRole: invitation.memberRole, purpose: invitation.purpose, target: masked, expiresAt: invitation.expiresAt, expired };
  }

  /**
   * Qabul qilish (TZ 3.7.1): faqat tasdiqlangan telefon/email mos kelsa.
   * TRANSFER: eski ega MANAGER bo‘ladi; INITIAL_OWNER: OWNER a’zolik yaratiladi.
   */
  async accept(userId: string, token: string) {
    const tokenHash = hashToken(token);
    const [invitation, user] = await Promise.all([
      this.db.shopInvitation.findUnique({ where: { tokenHash }, include: { shop: { select: { id: true, name: true, archivedAt: true } } } }),
      this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true, email: true, status: true } }),
    ]);
    if (!invitation || invitation.status !== 'PENDING' || invitation.shop.archivedAt) throw new NotFoundException(ERRORS.INVITATION_INVALID);
    if (invitation.expiresAt < new Date()) {
      await this.db.shopInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
      throw new DomainException(HttpStatus.GONE, 'INVITATION_EXPIRED', ERRORS.INVITATION_EXPIRED);
    }
    const matches = invitation.target.includes('@')
      // Email ro‘yxatdan o‘tishda OTP bilan tasdiqlanadi → faol hisobdagi email tasdiqlangan.
      ? user.status === 'ACTIVE' && user.email?.toLowerCase() === invitation.target
      : !!user.phoneVerifiedAt && user.phone === invitation.target;
    if (!matches) throw new ForbiddenException({ code: 'INVITATION_CONTACT_MISMATCH', message: ERRORS.INVITATION_CONTACT_MISMATCH });

    return this.db.$transaction(async (tx) => {
      const claimed = await tx.shopInvitation.updateMany({ where: { id: invitation.id, status: 'PENDING' }, data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedUserId: userId } });
      if (claimed.count === 0) throw new NotFoundException(ERRORS.INVITATION_INVALID);
      const shopId = invitation.shopId;
      const current = await tx.shopMember.findUnique({ where: { shopId_userId: { shopId, userId } } });

      if (invitation.memberRole === 'OWNER') {
        const owned = await tx.shopMember.count({ where: { userId, memberRole: 'OWNER', shop: { archivedAt: null } } });
        if (owned >= MAX_OWNED_SHOPS) throw conflict('SHOP_LIMIT_REACHED', ERRORS.SHOP_LIMIT_REACHED);
        const previous = await tx.shopMember.findFirst({ where: { shopId, memberRole: 'OWNER' } });
        if (previous && previous.userId !== userId) {
          // Avval eski egani pasaytirish: «bitta OWNER» partial unique index buzilmasin.
          await tx.shopMember.update({ where: { id: previous.id }, data: { memberRole: 'MANAGER', permissions: DEFAULT_PERMISSIONS.MANAGER } });
        }
        if (current) await tx.shopMember.update({ where: { id: current.id }, data: { memberRole: 'OWNER', permissions: [] } });
        else await tx.shopMember.create({ data: { shopId, userId, memberRole: 'OWNER' } });
        await tx.auditLog.create({ data: { actorId: userId, action: invitation.purpose === 'TRANSFER' ? 'SHOP_OWNERSHIP_TRANSFERRED' : 'SHOP_OWNER_ASSIGNED', targetType: 'Shop', targetId: shopId, before: { ownerUserId: previous?.userId ?? null }, after: { ownerUserId: userId } } });
      } else {
        if (current) throw conflict('SHOP_MEMBER_EXISTS', ERRORS.SHOP_MEMBER_EXISTS);
        await tx.shopMember.create({ data: { shopId, userId, memberRole: invitation.memberRole, permissions: invitation.permissions } });
        await tx.auditLog.create({ data: { actorId: userId, action: 'SHOP_MEMBER_JOINED', targetType: 'Shop', targetId: shopId, after: { memberRole: invitation.memberRole } } });
      }
      await tx.userRole.upsert({ where: { userId_role: { userId, role: Role.SHOP } }, update: {}, create: { userId, role: Role.SHOP } });
      await this.outbox.emit(tx, {
        eventName: 'shop.invitation.accepted',
        aggregateType: 'Shop',
        aggregateId: shopId,
        payload: { userId: invitation.invitedByUserId, title: 'Taklif qabul qilindi', body: `«${invitation.shop.name}» do‘koniga taklif qabul qilindi.` },
        createdById: userId,
      });
      return { shopId, memberRole: invitation.memberRole };
    });
  }
}
