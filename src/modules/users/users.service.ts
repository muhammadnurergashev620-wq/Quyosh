import { OtpPurpose, Role, SessionStatus, UserStatus } from '@prisma/client';
import { OtpService } from '../otp/otp.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { hashSecret, verifySecret } from '../../common/security/hash';
import { SetTwoFactorDto } from './dto/two-factor.dto';
import { SetEmailDto } from './dto/set-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateNameDto } from './dto/update-name.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ERRORS } from '../../common/constants/error-messages';

const DELETION_GRACE_DAYS = 14;

@Injectable()
export class UsersService {
  constructor(
    private readonly db: PrismaService,
    private readonly otp: OtpService,
  ) {}

  async findMe(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accountNumber: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        avatarAssetId: true,
        adminAvatarAllowed: true,
        status: true,
        phoneVerifiedAt: true,
        twoFactorEnabled: true,
        googleId: true,
        googleEmail: true,
        passwordHash: true,
        mustPasswordChange: true,
        isSuperAdmin: true,
        adminPermissions: true,
        canCreateAdmins: true,
        grantablePermissions: true,
        createdAt: true,
        userRoles: { select: { role: true } },
        locale: true,
        deletionScheduledAt: true,
        accountType: true,
        organization: { select: { name: true, stir: true, address: true } },
        shopMemberships: { select: { shopId: true, memberRole: true, shop: { select: { name: true, slug: true, status: true } } } },
      },
    });
    if (!user) {
      throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    }

    const roles = user.userRoles.map((item) => item.role);
    return {
      ...user,
      googleId: undefined,
      passwordHash: undefined,
      hasPassword: user.passwordHash !== null,
      googleLinked: user.googleId !== null,
      roles,
      userRoles: undefined,
      canSetAvatar: !roles.includes(Role.ADMIN) || user.isSuperAdmin || user.adminAvatarAllowed,
    };
  }

  /** Telefon raqamini (Google orqali ochilgan va telefonsiz akkaunt uchun) tasdiqlash kodini yuborish. */
  async requestPhoneCode(userId: string, phoneInput: string, context: { ip?: string; panel?: string | null }) {
    const phone = this.otp.normalizePhone(phoneInput);
    const taken = await this.db.user.findUnique({ where: { phone }, select: { id: true } });
    if (taken && taken.id !== userId) throw new ConflictException(ERRORS.PHONE_ALREADY_REGISTERED);
    return this.otp.issue(phone, OtpPurpose.CHANGE_PHONE, userId, context);
  }

  /** Kod to‘g‘ri bo‘lsa raqam akkauntga yoziladi va tasdiqlangan hisoblanadi. */
  async verifyPhone(userId: string, phoneInput: string, code: string) {
    const phone = this.otp.normalizePhone(phoneInput);
    await this.otp.verify(phone, OtpPurpose.CHANGE_PHONE, code);
    try {
      await this.db.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: new Date() } });
    } catch {
      throw new ConflictException(ERRORS.PHONE_ALREADY_REGISTERED);
    }
    await this.db.auditLog.create({ data: { actorId: userId, action: 'USER_PHONE_VERIFIED', targetType: 'User', targetId: userId } });
    return this.findMe(userId);
  }

  /** Joriy parolni bilgan foydalanuvchi uni almashtiradi; boshqa qurilmalar tizimdan chiqariladi (joriy qurilma qoladi). */
  async changePassword(userId: string, currentDeviceId: string | undefined, currentPassword: string, newPassword: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (!user.passwordHash) throw new ConflictException(ERRORS.PASSWORD_NOT_SET);
    if (!(await verifySecret(currentPassword, user.passwordHash))) throw new UnauthorizedException(ERRORS.CURRENT_PASSWORD_INVALID);
    if (await verifySecret(newPassword, user.passwordHash)) throw new BadRequestException(ERRORS.PASSWORD_SAME_AS_CURRENT);
    const passwordHash = await hashSecret(newPassword, 12);
    const revokedAt = new Date();
    const others = currentDeviceId ? { deviceId: { not: currentDeviceId } } : {};
    const revoked = await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId, status: SessionStatus.ACTIVE, ...others }, data: { status: SessionStatus.REVOKED, revokedAt } });
      const sessions = await tx.deviceSession.updateMany({ where: { userId, status: SessionStatus.ACTIVE, ...others }, data: { status: SessionStatus.REVOKED, revokedAt } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'USER_PASSWORD_CHANGED', targetType: 'User', targetId: userId, after: { revokedSessions: sessions.count } } });
      return sessions.count;
    });
    return { changed: true, revokedSessions: revoked };
  }

  /**
   * Birinchi kirish (TZ 3.5): admin bergan vaqtincha parol yangisiga almashtiriladi, `mustPasswordChange = false`.
   * Yangi parol vaqtinchadan farq qilishi shart; boshqa qurilmalar tizimdan chiqariladi (joriy qoladi).
   */
  async setFirstPassword(userId: string, currentDeviceId: string | undefined, newPassword: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true, mustPasswordChange: true } });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (!user.mustPasswordChange || !user.passwordHash) throw new ConflictException(ERRORS.PASSWORD_CHANGE_NOT_REQUIRED);
    if (await verifySecret(newPassword, user.passwordHash)) throw new BadRequestException(ERRORS.PASSWORD_SAME_AS_CURRENT);
    const passwordHash = await hashSecret(newPassword, 12);
    const revokedAt = new Date();
    const others = currentDeviceId ? { deviceId: { not: currentDeviceId } } : {};
    await this.db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({ where: { id: userId, mustPasswordChange: true }, data: { passwordHash, mustPasswordChange: false } });
      if (updated.count !== 1) throw new ConflictException(ERRORS.PASSWORD_CHANGE_NOT_REQUIRED);
      await tx.refreshToken.updateMany({ where: { userId, status: SessionStatus.ACTIVE, ...others }, data: { status: SessionStatus.REVOKED, revokedAt } });
      await tx.deviceSession.updateMany({ where: { userId, status: SessionStatus.ACTIVE, ...others }, data: { status: SessionStatus.REVOKED, revokedAt } });
      // Parol audit’ga yozilmaydi.
      await tx.auditLog.create({ data: { actorId: userId, action: 'USER_PASSWORD_CHANGED', targetType: 'User', targetId: userId, after: { first: true } } });
    });
    return this.findMe(userId);
  }

  /** Faqat parol hali yo‘q akkauntga: birinchi parol o‘rnatiladi (mavjud parolni almashtirish boshqa yo‘l bilan). */
  async setInitialPassword(userId: string, password: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (user.passwordHash) throw new ConflictException(ERRORS.PASSWORD_ALREADY_SET);
    const passwordHash = await hashSecret(password, 12);
    const result = await this.db.user.updateMany({ where: { id: userId, passwordHash: null }, data: { passwordHash } });
    if (result.count !== 1) throw new ConflictException(ERRORS.PASSWORD_ALREADY_SET);
    await this.db.auditLog.create({ data: { actorId: userId, action: 'USER_PASSWORD_SET', targetType: 'User', targetId: userId } });
    return this.findMe(userId);
  }

  async updateName(userId: string, dto: UpdateNameDto) {
    await this.db.user.update({
      where: { id: userId },
      data: { firstName: dto.firstName.trim(), lastName: dto.lastName.trim() },
    });
    return this.findMe(userId);
  }

  /** Til, hisob turi va (yuridik shaxs uchun) tashkilot ma’lumoti. BUSINESS bo‘lsa tashkilot majburiy. */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const current = await this.db.user.findUnique({ where: { id: userId }, select: { accountType: true, organization: { select: { id: true } } } });
    if (!current) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    const accountType = dto.accountType ?? current.accountType;
    if (accountType === 'BUSINESS' && !dto.organization && !current.organization) throw new BadRequestException(ERRORS.ORGANIZATION_REQUIRED);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { locale: dto.locale, accountType: dto.accountType } });
      if (dto.organization) {
        const data = { name: dto.organization.name.trim(), stir: dto.organization.stir, address: dto.organization.address?.trim() || null };
        await tx.organization.upsert({ where: { userId }, update: data, create: { userId, ...data } });
      }
    });
    return this.findMe(userId);
  }

  /**
   * Ikki bosqichli autentifikatsiyani (kirishda OTP) yoqish/o‘chirish.
   * O‘chirish uchun joriy parol talab qilinadi; administrator akkauntida har doim yoqilgan turadi.
   */
  async setTwoFactor(userId: string, dto: SetTwoFactorDto) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, twoFactorEnabled: true, userRoles: { select: { role: true } } },
    });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);

    if (!dto.enabled) {
      if (!dto.password) throw new BadRequestException(ERRORS.TWO_FACTOR_PASSWORD_REQUIRED);
      const valid = !!user.passwordHash && (await verifySecret(dto.password, user.passwordHash));
      if (!valid) throw new UnauthorizedException(ERRORS.CURRENT_PASSWORD_INVALID);
    }

    if (user.twoFactorEnabled !== dto.enabled) {
      await this.db.$transaction([
        this.db.user.update({ where: { id: userId }, data: { twoFactorEnabled: dto.enabled } }),
        this.db.auditLog.create({
          data: {
            actorId: userId,
            action: dto.enabled ? 'USER_TWO_FACTOR_ENABLED' : 'USER_TWO_FACTOR_DISABLED',
            targetType: 'User',
            targetId: userId,
            before: { twoFactorEnabled: user.twoFactorEnabled },
            after: { twoFactorEnabled: dto.enabled },
          },
        }),
      ]);
    }
    return this.findMe(userId);
  }

  /** Tasdiqlash kodlari yuboriladigan email manzilni kiritish/almashtirish (parolli akkauntda joriy parol talab qilinadi). */
  async setEmail(userId: string, dto: SetEmailDto) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, passwordHash: true } });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (user.passwordHash) {
      if (!dto.password) throw new BadRequestException(ERRORS.TWO_FACTOR_PASSWORD_REQUIRED);
      if (!(await verifySecret(dto.password, user.passwordHash))) throw new UnauthorizedException(ERRORS.CURRENT_PASSWORD_INVALID);
    }
    const email = dto.email.trim().toLowerCase();
    if (email !== user.email) {
      const taken = await this.db.user.findFirst({ where: { email, id: { not: userId }, deletedAt: null }, select: { id: true } });
      if (taken) throw new ConflictException(ERRORS.EMAIL_ALREADY_REGISTERED);
      await this.db.$transaction([
        this.db.user.update({ where: { id: userId }, data: { email } }),
        this.db.auditLog.create({
          data: { actorId: userId, action: 'USER_EMAIL_CHANGED', targetType: 'User', targetId: userId, before: { email: user.email }, after: { email } },
        }),
      ]);
    }
    return this.findMe(userId);
  }

  /**
   * Foydalanuvchi o‘z akkauntini o‘chiradi (yumshoq o‘chirish): telefon/email bo‘shatiladi, sessiyalar yopiladi, ochiq so‘rovlar bekor qilinadi.
   * Faol buyurtma bo‘lsa — o‘chirib bo‘lmaydi. Administrator akkaunti bu yo‘l bilan o‘chirilmaydi.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto, ip?: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accountNumber: true,
        phone: true,
        email: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
        userRoles: { select: { role: true } },
        shopMemberships: { select: { shopId: true, memberRole: true } },
      },
    });
    if (!user || user.deletedAt || user.status === UserStatus.DELETED) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (user.userRoles.some((item) => item.role === Role.ADMIN)) throw new ForbiddenException(ERRORS.ACCOUNT_DELETE_ADMIN_FORBIDDEN);
    if (user.passwordHash) {
      if (!dto.password) throw new BadRequestException(ERRORS.TWO_FACTOR_PASSWORD_REQUIRED);
      if (!(await verifySecret(dto.password, user.passwordHash))) throw new UnauthorizedException(ERRORS.CURRENT_PASSWORD_INVALID);
    }

    // Do‘kon egasi avval egalikni topshirishi yoki do‘konni yopishi kerak (TZ 3.7.3).
    if (user.shopMemberships.some((item) => item.memberRole === 'OWNER')) throw new ConflictException(ERRORS.ACCOUNT_DELETE_SHOP_OWNER);

    // TZ 16: 14 kunlik bekor qilish oralig‘i — hozir sessiyalar yopiladi va ochiq so‘rovlar bekor qilinadi,
    // muddatdan keyin `anonymizeDue` (kunlik job) hisobni anonimlashtiradi. Shu oraliqda qayta kirib bekor qilish mumkin.
    const scheduledAt = new Date(Date.now() + DELETION_GRACE_DAYS * 86_400_000);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { deletionRequestedAt: new Date(), deletionScheduledAt: scheduledAt } });
      const revokedAt = new Date();
      await tx.refreshToken.updateMany({ where: { userId, status: SessionStatus.ACTIVE }, data: { status: SessionStatus.REVOKED, revokedAt } });
      await tx.deviceSession.updateMany({ where: { userId, status: SessionStatus.ACTIVE }, data: { status: SessionStatus.REVOKED, revokedAt } });
      const open = await tx.quoteRequest.findMany({ where: { userId, status: 'OPEN' }, select: { id: true } });
      for (const r of open) {
        await tx.quoteRequest.update({ where: { id: r.id }, data: { status: 'CANCELLED', closedAt: revokedAt } });
        await tx.quoteRequestShop.updateMany({ where: { requestId: r.id, status: { in: ['SENT', 'VIEWED', 'CLARIFICATION_REQUESTED', 'QUOTED'] } }, data: { status: 'NOT_SELECTED', pipelineStage: 'LOST' } });
        await tx.quote.updateMany({ where: { requestId: r.id, status: { in: ['SENT', 'VIEWED'] } }, data: { status: 'REJECTED', decidedAt: revokedAt, rejectReason: 'ACCOUNT_DELETED' } });
      }
      await tx.auditLog.create({
        data: { actorId: userId, action: 'USER_DELETION_SCHEDULED', targetType: 'User', targetId: userId, before: { status: user.status }, after: { deletionScheduledAt: scheduledAt.toISOString() }, ipAddress: ip?.slice(0, 64) ?? null },
      });
    });
    return { deleted: true, scheduledAt };
  }

  async cancelDeletion(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { deletionScheduledAt: true, anonymizedAt: true } });
    if (!user?.deletionScheduledAt || user.anonymizedAt) throw new ConflictException(ERRORS.ACCOUNT_DELETION_NOT_PENDING);
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { deletionRequestedAt: null, deletionScheduledAt: null } }),
      this.db.auditLog.create({ data: { actorId: userId, action: 'USER_DELETION_CANCELLED', targetType: 'User', targetId: userId } }),
    ]);
    return { cancelled: true };
  }

  /**
   * Kunlik job (TZ 16): muddati yetgan hisoblar anonimlashtiriladi — ism "O‘chirilgan foydalanuvchi", kontaktlar,
   * obyektlar (poligon, manzil), hisoblar, yozishma matnlari o‘chiriladi; quote/installation/sharh statistika uchun anonim qoladi.
   */
  async anonymizeDue(now = new Date()) {
    const due = await this.db.user.findMany({ where: { deletionScheduledAt: { lte: now }, anonymizedAt: null }, select: { id: true, accountNumber: true, phone: true, email: true, status: true, shopMemberships: { select: { memberRole: true } } } });
    let done = 0;
    for (const u of due) {
      if (u.shopMemberships.some((m) => m.memberRole === 'OWNER')) continue;
      await this.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: u.id },
          data: {
            status: UserStatus.DELETED, deletedAt: u.status === UserStatus.DELETED ? undefined : now, anonymizedAt: now,
            firstName: 'O‘chirilgan foydalanuvchi', lastName: null, phone: `del${u.accountNumber}`, email: null, passwordHash: null, googleId: null, googleEmail: null, avatarUrl: null, avatarAssetId: null, preferences: undefined,
          },
        });
        await tx.shopMember.deleteMany({ where: { userId: u.id } });
        await tx.customerSite.deleteMany({ where: { userId: u.id } });
        const calcIds = (await tx.calculation.findMany({ where: { userId: u.id }, select: { id: true } })).map((c) => c.id);
        await tx.calculationShare.deleteMany({ where: { calculationId: { in: calcIds } } });
        await tx.reportJob.deleteMany({ where: { userId: u.id } });
        await tx.calculation.deleteMany({ where: { userId: u.id } });
        await tx.calculationDraft.deleteMany({ where: { userId: u.id } });
        await tx.quoteRequest.updateMany({ where: { userId: u.id }, data: { notes: null, siteId: null, calculationId: null } });
        await tx.conversationMessage.updateMany({ where: { senderUserId: u.id }, data: { body: '[o‘chirilgan]', attachmentFileIds: [] } });
        await tx.supportMessage.updateMany({ where: { senderUserId: u.id }, data: { body: '[o‘chirilgan]', attachmentFileIds: [] } });
        await tx.supportTicket.updateMany({ where: { requesterUserId: u.id }, data: { guestContact: null } });
        await tx.review.updateMany({ where: { userId: u.id }, data: { ipHash: null, deviceHash: null } });
        await tx.favorite.deleteMany({ where: { userId: u.id } });
        await tx.notification.deleteMany({ where: { userId: u.id } });
        await tx.pushToken.deleteMany({ where: { userId: u.id } });
        await tx.otpCode.deleteMany({ where: { OR: [{ userId: u.id }, ...(u.phone ? [{ phone: u.phone }] : [])] } });
        await tx.auditLog.create({ data: { actorId: null, action: 'USER_ANONYMIZED', targetType: 'User', targetId: u.id, after: { accountNumber: u.accountNumber } } });
      });
      done += 1;
    }
    return { anonymized: done };

  }
}
