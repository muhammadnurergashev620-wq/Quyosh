import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, SessionStatus, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { ERRORS } from '../../common/constants/error-messages';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { LOGIN_MESSAGE, isValidLogin, normalizeLogin } from '../../common/utils/login';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { hashSecret, verifySecret } from '../../common/security/hash';
import { TelegramAlertService } from '../../infrastructure/telegram/telegram-alert.service';
import { DeleteUserDto, RegistrationBlockDto, SetUserPasswordDto, SetUserStatusDto } from './dto/user-action.dto';
import { CreateAdminDto, SetAdminDelegationDto, SetAdminPermissionsDto } from './dto/admin-account.dto';
import { ADMIN_PERMISSIONS } from '../../common/constants/admin-permissions';
import { BulkUserStatusDto, UserQueryDto } from './dto/user-query.dto';

const USER_SELECT = {
  id: true,
        accountNumber: true,
  phone: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarAssetId: true,
  status: true,
  twoFactorEnabled: true,
  createdAt: true,
  deletedAt: true,
  userRoles: { select: { role: true } },
  shopMemberships: { select: { shopId: true, memberRole: true, shop: { select: { name: true, status: true } } } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/**
 * O‘chirilgan akkauntning telefon/emaili band qolmasligi uchun «qabr belgisi» bilan almashtiriladi
 * (asl raqam auditda saqlanadi). Admin ro‘yxatida esa asl ko‘rinishida ko‘rsatiladi.
 */
const TOMBSTONE = /^del\d+_/;
const tombstonePhone = (accountNumber: number, phone: string) => `del${accountNumber}_${phone}`.slice(0, 32);

function present({ userRoles, ...user }: UserRow) {
  return { ...user, phone: user.phone ? user.phone.replace(TOMBSTONE, '') : null, roles: userRoles.map((item) => item.role) };
}

const LIST_SELECT = {
  ...USER_SELECT,
  lastLoginAt: true,
  email: true,
  phoneVerifiedAt: true,
} satisfies Prisma.UserSelect;

type ListRow = Prisma.UserGetPayload<{ select: typeof LIST_SELECT }>;

function presentListRow({ userRoles, ...user }: ListRow) {
  return { ...user, phone: user.phone ? user.phone.replace(TOMBSTONE, '') : null, roles: userRoles.map((item) => item.role) };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly db: PrismaService,
    private readonly telegram: TelegramAlertService,
  ) {}

  /** Ro‘yxat filtrlaridan `where` yasaydi (cursor va sahifalab ko‘rsatish uchun umumiy). */
  private async listWhere(query: UserQueryDto): Promise<Prisma.UserWhereInput> {
    // ID (accountNumber) bo‘yicha qidirilganda admin akkauntlar ham qidiruv doirasiga kiradi —
    // oddiy ism/telefon qidiruvi va filtrsiz ro‘yxat avvalgidek faqat mijoz/ustalar bilan cheklanadi.
    const isIdSearch = !!query.search && /^\d{1,9}$/.test(query.search);
    const roles = query.role ? [query.role] : isIdSearch ? [Role.CUSTOMER, Role.SHOP, Role.ADMIN] : [Role.CUSTOMER, Role.SHOP];
    const where: Prisma.UserWhereInput = {
      userRoles: { some: { role: { in: roles } } },
      status: query.status,
      deletedAt: query.status === UserStatus.DELETED ? { not: null } : null,
    };
    const and: Prisma.UserWhereInput[] = [];
    if (query.search) {
      // accountNumber — Int ustun, Prisma uni matn sifatida qisman (contains) solishtira olmaydi,
      // shuning uchun mos keladigan raqamlarni kichik raw so‘rov bilan topib, natijani OR ga qo‘shamiz.
      const matchingAccountNumbers = isIdSearch
        ? await this.db.$queryRaw<Array<{ accountNumber: number }>>`
            SELECT "account_number" AS "accountNumber" FROM users WHERE "account_number"::text LIKE ${`%${query.search}%`} LIMIT 50
          `
        : [];
      const words = query.search.trim().split(/\s+/).filter(Boolean);
      and.push({
        OR: [
          { phone: { contains: query.search } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          // «Ism Familiya» ko‘rinishidagi qidiruv: har bir so‘z ism yoki familiyadan biriga mos kelishi kerak.
          ...(words.length > 1
            ? [{ AND: words.map((word) => ({ OR: [{ firstName: { contains: word, mode: 'insensitive' as const } }, { lastName: { contains: word, mode: 'insensitive' as const } }] })) }]
            : []),
          ...(matchingAccountNumbers.length ? [{ accountNumber: { in: matchingAccountNumbers.map((row) => row.accountNumber) } }] : []),
        ],
      });
    }
    if (query.from || query.to) {
      where.createdAt = { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to.length <= 10 ? `${query.to}T23:59:59.999Z` : query.to) } : {}) };
    }
    if (and.length) where.AND = and;
    return where;
  }

  async findAll(query: UserQueryDto) {
    const where = await this.listWhere(query);
    const dir = query.dir ?? 'desc';
    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      query.sort === 'lastLoginAt' ? [{ lastLoginAt: { sort: dir, nulls: 'last' } }, { id: 'desc' }] : query.sort === 'name' ? [{ firstName: dir }, { lastName: dir }, { id: 'desc' }] : [{ createdAt: dir }, { id: 'desc' }];

    if (query.page) {
      const limit = query.limit ?? 20;
      const [total, rows] = await Promise.all([
        this.db.user.count({ where }),
        this.db.user.findMany({ where, select: LIST_SELECT, orderBy, skip: (query.page - 1) * limit, take: limit }),
      ]);
      return {
        items: rows.map(presentListRow),
        total,
        page: query.page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    const rows = await this.db.user.findMany({ where, select: LIST_SELECT, orderBy, ...cursorArgs(query) });
    const page = toCursorPage(rows, query);
    return { items: page.items.map(presentListRow), nextCursor: page.nextCursor };
  }

  /** Foydalanuvchilar sahifasidagi kartalar: jami, faol, bloklangan, tasdiq kutayotgan (mijoz/usta bo‘yicha) va 30 kunlik o‘sish. */
  async stats() {
    const base: Prisma.UserWhereInput = { deletedAt: null };
    const roleWhere = (role: Role): Prisma.UserWhereInput => ({ ...base, userRoles: { some: { role } } });
    const anyRole: Prisma.UserWhereInput = { ...base, userRoles: { some: { role: { in: [Role.CUSTOMER, Role.SHOP] } } } };
    const count = (where: Prisma.UserWhereInput, status?: UserStatus | UserStatus[]) =>
      this.db.user.count({ where: { ...where, ...(status ? { status: Array.isArray(status) ? { in: status } : status } : {}) } });
    const day = 86_400_000;
    const now = Date.now();
    const [total, customers, shops, active, activeC, activeS, blocked, blockedC, blockedS, suspended, pending, pendingC, pendingS, last30, prev30] = await Promise.all([
      count(anyRole),
      count(roleWhere(Role.CUSTOMER)),
      count(roleWhere(Role.SHOP)),
      count(anyRole, UserStatus.ACTIVE),
      count(roleWhere(Role.CUSTOMER), UserStatus.ACTIVE),
      count(roleWhere(Role.SHOP), UserStatus.ACTIVE),
      count(anyRole, UserStatus.BLOCKED),
      count(roleWhere(Role.CUSTOMER), UserStatus.BLOCKED),
      count(roleWhere(Role.SHOP), UserStatus.BLOCKED),
      count(anyRole, UserStatus.SUSPENDED),
      count(anyRole, UserStatus.PENDING),
      count(roleWhere(Role.CUSTOMER), UserStatus.PENDING),
      count(roleWhere(Role.SHOP), UserStatus.PENDING),
      this.db.user.count({ where: { ...anyRole, createdAt: { gte: new Date(now - 30 * day) } } }),
      this.db.user.count({ where: { ...anyRole, createdAt: { gte: new Date(now - 60 * day), lt: new Date(now - 30 * day) } } }),
    ]);
    return {
      total: { all: total, customers, shops, new30: last30, growthPercent: prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : null },
      active: { all: active, customers: activeC, shops: activeS },
      blocked: { all: blocked, customers: blockedC, shops: blockedS, suspended },
      pending: { all: pending, customers: pendingC, shops: pendingS },
    };
  }

  /** Bir nechta foydalanuvchining holatini birdan o‘zgartiradi; har biri uchun alohida audit yoziladi, xatolari alohida qaytariladi. */
  async bulkStatus(adminId: string, dto: BulkUserStatusDto, req: Request) {
    const ids = [...new Set(dto.ids)].slice(0, 100);
    const failed: Array<{ id: string; message: string }> = [];
    let updated = 0;
    for (const id of ids) {
      try {
        await this.setStatus(adminId, id, { status: dto.status, reason: dto.reason }, req);
        updated += 1;
      } catch (error) {
        failed.push({ id, message: error instanceof Error ? error.message : String(error) });
      }
    }
    return { updated, failed };
  }

  /** Raqamli ID (akkaunt raqami) bo‘yicha foydalanuvchini topadi. */
  async lookupByNumber(accountNumber: number) {
    const user = await this.db.user.findUnique({ where: { accountNumber }, select: { id: true } });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    return this.findOne(user.id);
  }

  /** Bitta akkaunt haqida to‘liq ma’lumot (admin ham, mijoz/do‘kon a’zosi ham). */
  async findOne(userId: string) {
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
        createdAt: true,
        deletedAt: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        phoneVerifiedAt: true,
        googleId: true,
        googleEmail: true,
        passwordHash: true,
        createdByAdminId: true,
        userRoles: { select: { role: true } },
        shopMemberships: { select: { shopId: true, memberRole: true, shop: { select: { name: true, slug: true, status: true } } } },
      },
    });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);

    const [activeDevices, lastSession, recent] = await Promise.all([
      this.db.deviceSession.count({ where: { userId, status: SessionStatus.ACTIVE } }),
      this.db.deviceSession.findFirst({ where: { userId }, orderBy: { lastSeenAt: 'desc' }, select: { lastSeenAt: true, ipAddress: true, userAgent: true, panel: true } }),
      this.db.auditLog.findMany({
        where: { OR: [{ actorId: userId }, { targetId: userId }], action: { not: 'AUTH_REFRESH_ROTATED' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, reason: true, actorId: true, createdAt: true, actor: { select: { accountNumber: true } } },
      }),
    ]);
    const { userRoles, googleId, googleEmail, passwordHash, createdByAdminId, ...rest } = user;
    const realPhone = rest.phone ? rest.phone.replace(TOMBSTONE, '') : null;
    const registrationBlocked =
      rest.status === UserStatus.DELETED && realPhone ? !!(await this.db.blockedPhone.findUnique({ where: { phone: realPhone }, select: { id: true } })) : false;
    return {
      ...rest,
      phone: realPhone,
      registrationBlocked,
      roles: userRoles.map((item) => item.role),
      account: { googleLinked: !!googleId, googleEmail: googleEmail ?? null, hasPassword: !!passwordHash, createdByAdmin: !!createdByAdminId },
      stats: { activeDevices },
      lastSession,
      recentActivity: recent,
    };
  }

  async setStatus(adminId: string, userId: string, dto: SetUserStatusDto, req: Request) {
    const target = await this.loadModerable(adminId, userId);

    if (dto.status === 'ACTIVE') {
      if (target.status !== UserStatus.SUSPENDED && target.status !== UserStatus.BLOCKED) {
        throw new ConflictException(ERRORS.USER_STATUS_TRANSITION_INVALID(target.status, dto.status));
      }
    } else {
      if (!dto.reason || dto.reason.trim().length < 3) throw new BadRequestException(ERRORS.USER_ACTION_REASON_REQUIRED);
      if (target.status === UserStatus.DELETED) {
        throw new ConflictException(ERRORS.USER_STATUS_TRANSITION_INVALID(target.status, dto.status));
      }
    }
    if (target.status === dto.status) return present(target);

    const restricting = dto.status !== 'ACTIVE';
    if (restricting && target.isSuperAdmin) await this.assertAnotherSuperAdmin(userId);
    const updated = await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: dto.status } });
      if (restricting) await this.revokeAllSessions(tx, userId);
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: restricting ? `ADMIN_USER_${dto.status}` : 'ADMIN_USER_REACTIVATED',
          targetType: 'User',
          targetId: userId,
          before: { status: target.status },
          after: { status: dto.status },
          reason: dto.reason?.trim() || null,
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      });
      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT });
    });
    return present(updated);
  }

  async remove(adminId: string, userId: string, dto: DeleteUserDto, req: Request) {
    const target = await this.loadModerable(adminId, userId);
    if (target.status === UserStatus.DELETED || target.deletedAt) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (target.isSuperAdmin) await this.assertAnotherSuperAdmin(userId);
    // Do‘kon egasi o‘chirilsa do‘kon egasiz qoladi (TZ 3.7.2): avval egalik o‘tkaziladi.
    if (target.shopMemberships.some((item) => item.memberRole === 'OWNER')) throw new ConflictException(ERRORS.ACCOUNT_DELETE_SHOP_OWNER);

    const originalPhone = target.phone;
    await this.db.$transaction(async (tx) => {
      // Telefon va email bo‘shatiladi: shu raqam/email bilan yangi akkaunt ochish mumkin bo‘ladi, eski akkaunt hech qayerda qolmaydi.
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          deletedAt: new Date(),
          phone: originalPhone ? tombstonePhone(target.accountNumber, originalPhone) : null,
          email: null,
          passwordHash: null,
          googleId: null,
        },
      });
      await tx.shopMember.deleteMany({ where: { userId } });
      await tx.otpCode.deleteMany({ where: { OR: [{ userId }, ...(originalPhone ? [{ phone: originalPhone }] : [])] } });
      await this.revokeAllSessions(tx, userId);
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_USER_DELETED',
          targetType: 'User',
          targetId: userId,
          before: { status: target.status, phone: originalPhone, email: target.email, roles: target.userRoles.map((item) => item.role) },
          after: { status: UserStatus.DELETED },
          reason: dto.reason.trim(),
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      });
    });
    return { deleted: true };
  }

  /**
   * O‘chirilgan akkaunt raqamidan qayta ro‘yxatdan o‘tishni taqiqlaydi yoki ruxsat beradi.
   * Odatiy holatda o‘chirilgan raqam bilan yangi akkaunt ochish mumkin; taqiq faqat admin qo‘ysa ishlaydi.
   */
  async setRegistrationBlock(adminId: string, userId: string, blocked: boolean, dto: RegistrationBlockDto, req: Request) {
    const target = await this.db.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    if (!target) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (target.status !== UserStatus.DELETED && !target.deletedAt) throw new ConflictException(ERRORS.USER_STATUS_TRANSITION_INVALID(target.status, 'DELETED'));
    if (!target.phone) throw new ConflictException(ERRORS.USER_STATUS_TRANSITION_INVALID(target.status, 'DELETED'));
    const phone = target.phone.replace(TOMBSTONE, '');
    const reason = dto.reason?.trim() || null;

    await this.db.$transaction(async (tx) => {
      if (blocked) {
        await tx.blockedPhone.upsert({
          where: { phone },
          create: { phone, reason, blockedById: adminId },
          update: { reason, blockedById: adminId },
        });
      } else {
        await tx.blockedPhone.deleteMany({ where: { phone } });
      }
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: blocked ? 'ADMIN_REGISTRATION_BLOCKED' : 'ADMIN_REGISTRATION_ALLOWED',
          targetType: 'User',
          targetId: userId,
          after: { phone, registrationBlocked: blocked },
          reason,
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      });
    });
    return { registrationBlocked: blocked };
  }

  /**
   * Admin foydalanuvchiga yangi parol belgilaydi. Parollar faqat bcrypt xeshi ko‘rinishida saqlanadi — hech kim, jumladan admin ham,
   * eski parolni ko‘ra olmaydi; yangi parol faqat shu so‘rovda beriladi, bazada/auditda ochiq ko‘rinishda saqlanmaydi. Barcha qurilmalardan chiqariladi.
   */
  async setPassword(adminId: string, userId: string, dto: SetUserPasswordDto, req: Request) {
    const target = await this.loadModerable(adminId, userId);
    if (target.status === UserStatus.DELETED || target.deletedAt) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    const passwordHash = await hashSecret(dto.password, 12);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await this.revokeAllSessions(tx, userId);
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_USER_PASSWORD_RESET',
          targetType: 'User',
          targetId: userId,
          reason: dto.reason?.trim() || null,
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      });
    });

    // Yopiq (superadmin) guruhga to‘liq ma‘lumot; parol bazada faqat xesh sifatida qoladi.
    const admin = await this.db.user.findUnique({ where: { id: adminId }, select: { accountNumber: true, firstName: true, lastName: true } });
    const labels: Record<string, string> = { CUSTOMER: 'Mijoz', SHOP: 'Do‘kon', ADMIN: 'Admin' };
    this.telegram.notifyPasswordChanged({
      adminName: [admin?.firstName, admin?.lastName].filter(Boolean).join(' '),
      adminAccount: admin?.accountNumber ?? 0,
      userName: [target.firstName, target.lastName].filter(Boolean).join(' '),
      userAccount: target.accountNumber,
      userRole: target.userRoles.map((item) => labels[item.role] ?? item.role).join(', '),
      login: target.phone ?? 'Google',
      password: dto.password,
      reason: dto.reason?.trim() || null,
      ip: req.ip?.slice(0, 64) ?? null,
    });

    return { updated: true };
  }

  /** Barcha adminlar (faqat superadmin ko‘radi). */
  /** Superadmin istalgan foydalanuvchi/admin uchun kirishdagi OTP so‘ralishini yoqadi yoki o‘chiradi. */
  async setUserTwoFactor(actorId: string, userId: string, enabled: boolean, req: Request) {
    await this.assertSuperAdmin(actorId);
    const target = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, twoFactorEnabled: true, deletedAt: true, status: true } });
    if (!target || target.deletedAt || target.status === UserStatus.DELETED) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (target.twoFactorEnabled !== enabled) {
      await this.db.$transaction([
        this.db.user.update({ where: { id: userId }, data: { twoFactorEnabled: enabled } }),
        this.db.auditLog.create({
          data: {
            actorId,
            action: enabled ? 'ADMIN_TWO_FACTOR_ENABLED' : 'ADMIN_TWO_FACTOR_DISABLED',
            targetType: 'User',
            targetId: userId,
            before: { twoFactorEnabled: target.twoFactorEnabled },
            after: { twoFactorEnabled: enabled },
            ipAddress: req.ip?.slice(0, 64) ?? null,
            requestId: (req as { id?: string }).id ?? null,
          },
        }),
      ]);
    }
    return { twoFactorEnabled: enabled };
  }

  /**
   * Admin hisobini boshqarish doirasi: superadmin — hammasi; «yangi admin yarata oladi» deb belgilangan admin — faqat o‘zi yaratgan
   * adminlar va superadmin ruxsat bergan huquqlar doirasida. Boshqalar — ruxsat yo‘q.
   */
  private async adminScope(actorId: string) {
    const actor = await this.db.user.findUnique({
      where: { id: actorId },
      select: { isSuperAdmin: true, canCreateAdmins: true, grantablePermissions: true, deletedAt: true, status: true, userRoles: { select: { role: true } } },
    });
    if (!actor || actor.deletedAt || actor.status !== UserStatus.ACTIVE || !actor.userRoles.some((item) => item.role === Role.ADMIN)) throw new ForbiddenException(ERRORS.FORBIDDEN);
    if (actor.isSuperAdmin) return { superAdmin: true as const, grantable: [...ADMIN_PERMISSIONS] as string[] };
    if (!actor.canCreateAdmins) throw new ForbiddenException(ERRORS.ADMIN_CREATE_NOT_ALLOWED);
    return { superAdmin: false as const, grantable: actor.grantablePermissions };
  }

  async listAdmins(actorId: string) {
    const scope = await this.adminScope(actorId);
    const where: Prisma.UserWhereInput = { userRoles: { some: { role: Role.ADMIN } }, deletedAt: null, ...(scope.superAdmin ? {} : { createdByAdminId: actorId }) };
    const rows = await this.db.user.findMany({
      where,
      orderBy: [{ isSuperAdmin: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true, accountNumber: true, phone: true, login: true, email: true, firstName: true, lastName: true, avatarAssetId: true, adminAvatarAllowed: true, status: true, isSuperAdmin: true, twoFactorEnabled: true,
        phoneVerifiedAt: true, adminPermissions: true, canCreateAdmins: true, grantablePermissions: true, createdByAdminId: true, createdAt: true, lastLoginAt: true,
      },
    });
    const devices = await this.db.deviceSession.groupBy({ by: ['userId'], where: { userId: { in: rows.map((row) => row.id) }, status: SessionStatus.ACTIVE }, _count: { _all: true } });
    const deviceCount = new Map(devices.map((row) => [row.userId, row._count._all]));
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const count = (status?: UserStatus) => rows.filter((row) => (status ? row.status === status : true)).length;
    return {
      items: rows.map((row) => ({ ...row, activeDevices: deviceCount.get(row.id) ?? 0, isSelf: row.id === actorId })),
      stats: {
        total: rows.length,
        totalWeekAgo: rows.filter((row) => row.createdAt <= weekAgo).length,
        active: count(UserStatus.ACTIVE),
        blocked: count(UserStatus.BLOCKED),
        suspended: count(UserStatus.SUSPENDED),
        pending: count(UserStatus.PENDING),
        mfaOn: rows.filter((row) => row.twoFactorEnabled).length,
        mfaOff: rows.filter((row) => !row.twoFactorEnabled).length,
        superAdmins: rows.filter((row) => row.isSuperAdmin).length,
      },
      scope: { superAdmin: scope.superAdmin, grantable: scope.grantable },
    };
  }

  /** Administratorning o‘z profili: akkaunt ma’lumotlari, xavfsizlik holati, faoliyat ko‘rsatkichlari, qurilmalar va so‘nggi amallari. */
  async myProfile(adminId: string) {
    const user = await this.db.user.findUnique({
      where: { id: adminId },
      select: {
        id: true, accountNumber: true, phone: true, login: true, email: true, firstName: true, lastName: true, avatarAssetId: true, adminAvatarAllowed: true, status: true, isSuperAdmin: true, twoFactorEnabled: true,
        phoneVerifiedAt: true, adminPermissions: true, canCreateAdmins: true, grantablePermissions: true, createdAt: true, lastLoginAt: true, googleId: true, googleEmail: true, passwordHash: true,
        createdByAdmin: { select: { accountNumber: true, firstName: true, lastName: true } },
      },
    });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const notTechnical = { action: { not: 'AUTH_REFRESH_ROTATED' } };
    const [actionsTotal, actions30d, logins30d, adminsCreated, activeDevices, firstAction, passwordChanged, activity] = await Promise.all([
      this.db.auditLog.count({ where: { actorId: adminId, ...notTechnical } }),
      this.db.auditLog.count({ where: { actorId: adminId, ...notTechnical, createdAt: { gte: since30 } } }),
      this.db.auditLog.count({ where: { actorId: adminId, action: 'AUTH_LOGIN_COMPLETED', createdAt: { gte: since30 } } }),
      this.db.user.count({ where: { createdByAdminId: adminId, deletedAt: null } }),
      this.db.deviceSession.count({ where: { userId: adminId, status: SessionStatus.ACTIVE } }),
      this.db.auditLog.findFirst({ where: { actorId: adminId, ...notTechnical }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      this.db.auditLog.findFirst({ where: { OR: [{ actorId: adminId, action: { in: ['USER_PASSWORD_CHANGED', 'USER_PASSWORD_SET'] } }, { targetId: adminId, action: 'ADMIN_USER_PASSWORD_RESET' }] }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, action: true } }),
      this.db.auditLog.findMany({ where: { actorId: adminId, ...notTechnical }, orderBy: { createdAt: 'desc' }, take: 15, select: { id: true, action: true, targetType: true, reason: true, ipAddress: true, createdAt: true } }),
    ]);
    const { googleId, googleEmail, passwordHash, createdByAdmin, ...rest } = user;
    return {
      user: { ...rest, hasPassword: !!passwordHash, googleLinked: !!googleId, googleEmail, createdBy: createdByAdmin },
      stats: { actionsTotal, actions30d, logins30d, adminsCreated, activeDevices, firstActionAt: firstAction?.createdAt ?? null, passwordChangedAt: passwordChanged?.createdAt ?? null },
      activity,
    };
  }

  /** Admin haqida qo‘shimcha ma’lumot (drawer uchun): qurilma sessiyalari, so‘nggi amallari va oxirgi parol yangilanishi. */
  async adminDetails(actorId: string, targetId: string) {
    const scope = await this.adminScope(actorId);
    const target = await this.db.user.findFirst({
      where: { id: targetId, deletedAt: null, userRoles: { some: { role: Role.ADMIN } }, ...(scope.superAdmin ? {} : { createdByAdminId: actorId }) },
      select: { id: true },
    });
    if (!target) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [sessions, activity, actions30d, passwordReset, createdBy] = await Promise.all([
      this.db.deviceSession.findMany({ where: { userId: targetId }, orderBy: { lastSeenAt: 'desc' }, take: 20, select: { id: true, status: true, panel: true, ipAddress: true, userAgent: true, lastSeenAt: true, createdAt: true, revokedAt: true } }),
      this.db.auditLog.findMany({ where: { actorId: targetId, action: { not: 'AUTH_REFRESH_ROTATED' } }, orderBy: { createdAt: 'desc' }, take: 15, select: { id: true, action: true, targetType: true, reason: true, createdAt: true } }),
      this.db.auditLog.count({ where: { actorId: targetId, action: { not: 'AUTH_REFRESH_ROTATED' }, createdAt: { gte: since } } }),
      this.db.auditLog.findFirst({ where: { targetId, action: 'ADMIN_USER_PASSWORD_RESET' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      this.db.user.findUnique({ where: { id: targetId }, select: { createdByAdmin: { select: { accountNumber: true, firstName: true, lastName: true } } } }),
    ]);
    return { sessions, activity, actions30d, passwordResetAt: passwordReset?.createdAt ?? null, createdBy: createdBy?.createdByAdmin ?? null };
  }

  /** Yangi admin yaratish (faqat superadmin). Akkaunt darhol faol; parol bcrypt xesh sifatida saqlanadi. */
  async createAdmin(actorId: string, dto: CreateAdminDto, req: Request) {
    const scope = await this.adminScope(actorId);
    if (!scope.superAdmin) {
      // Vakolat berilgan admin: superadmin va «admin yarata oladi» huquqini bera olmaydi, faqat o‘ziga ruxsat etilgan huquqlarni beradi.
      if (dto.isSuperAdmin || dto.canCreateAdmins) throw new ForbiddenException(ERRORS.SUPER_ADMIN_ONLY);
      if ((dto.permissions ?? []).some((item) => !scope.grantable.includes(item))) throw new ForbiddenException(ERRORS.ADMIN_PERMISSION_NOT_GRANTABLE);
    }
    const login = normalizeLogin(dto.login);
    if (!isValidLogin(login)) throw new BadRequestException(LOGIN_MESSAGE);
    if (await this.db.user.findUnique({ where: { login }, select: { id: true } })) throw new ConflictException(ERRORS.LOGIN_TAKEN);
    let phone: string | null = null;
    if (dto.phone) {
      const digits = dto.phone.replace(/\D/g, '');
      if (!/^998\d{9}$/.test(digits)) throw new BadRequestException(ERRORS.INVALID_PHONE);
      phone = `+${digits}`;
      if (await this.db.user.findUnique({ where: { phone }, select: { id: true } })) throw new ConflictException(ERRORS.PHONE_ALREADY_REGISTERED);
    }

    const permissions = dto.isSuperAdmin ? [] : (dto.permissions ?? []);
    if (!dto.isSuperAdmin && permissions.length === 0) throw new BadRequestException(ERRORS.ADMIN_PERMISSIONS_EMPTY);

    const canCreateAdmins = scope.superAdmin && !dto.isSuperAdmin && !!dto.canCreateAdmins;
    const grantablePermissions = canCreateAdmins ? (dto.grantablePermissions ?? []) : [];
    if (canCreateAdmins && grantablePermissions.length === 0) throw new BadRequestException(ERRORS.ADMIN_GRANTABLE_EMPTY);

    const passwordHash = await hashSecret(dto.password, 12);
    const created = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          createdByAdminId: actorId,
          canCreateAdmins,
          grantablePermissions,
          login,
          phone,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          status: UserStatus.ACTIVE,
          phoneVerifiedAt: phone ? new Date() : null,
          twoFactorEnabled: false,
          isSuperAdmin: !!dto.isSuperAdmin,
          adminPermissions: permissions,
          userRoles: { create: { role: Role.ADMIN } },
        },
        select: { id: true, accountNumber: true, login: true, phone: true, firstName: true, lastName: true, status: true, isSuperAdmin: true, adminPermissions: true, canCreateAdmins: true, grantablePermissions: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ADMIN_ADMIN_CREATED',
          targetType: 'User',
          targetId: user.id,
          after: { login, phone, isSuperAdmin: user.isSuperAdmin, permissions: user.adminPermissions, canCreateAdmins: user.canCreateAdmins, grantablePermissions: user.grantablePermissions, delegated: !scope.superAdmin },
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      });
      return user;
    });
    // Login va parol yopiq (login-parol) Telegram guruhiga yuboriladi; parol bazada faqat xesh sifatida qoladi.
    const creator = await this.db.user.findUnique({ where: { id: actorId }, select: { accountNumber: true, firstName: true, lastName: true } });
    this.telegram.notifyAdminCreated({
      creatorName: [creator?.firstName, creator?.lastName].filter(Boolean).join(' '),
      creatorAccount: creator?.accountNumber ?? 0,
      adminName: [created.firstName, created.lastName].filter(Boolean).join(' '),
      adminAccount: created.accountNumber,
      isSuperAdmin: created.isSuperAdmin,
      permissions: created.adminPermissions,
      phone: login,
      password: dto.password,
      ip: req.ip?.slice(0, 64) ?? null,
    });
    return created;
  }

  /** Oddiy adminning huquqlarini (bo‘limlarini) o‘zgartirish (faqat superadmin). */
  async setAdminPermissions(actorId: string, userId: string, dto: SetAdminPermissionsDto, req: Request) {
    const scope = await this.adminScope(actorId);
    const target = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, isSuperAdmin: true, adminPermissions: true, createdByAdminId: true, deletedAt: true, userRoles: { select: { role: true } } } });
    if (!target || target.deletedAt || !target.userRoles.some((item) => item.role === Role.ADMIN)) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (target.isSuperAdmin) throw new ConflictException(ERRORS.SUPER_ADMIN_ONLY);
    if (!scope.superAdmin) {
      if (target.createdByAdminId !== actorId || userId === actorId) throw new ForbiddenException(ERRORS.ADMIN_ONLY_OWN_CREATED);
      if (dto.permissions.some((item) => !scope.grantable.includes(item))) throw new ForbiddenException(ERRORS.ADMIN_PERMISSION_NOT_GRANTABLE);
    }
    if (dto.permissions.length === 0) throw new BadRequestException(ERRORS.ADMIN_PERMISSIONS_EMPTY);
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { adminPermissions: dto.permissions } }),
      this.db.auditLog.create({
        data: {
          actorId,
          action: 'ADMIN_PERMISSIONS_CHANGED',
          targetType: 'User',
          targetId: userId,
          before: { permissions: target.adminPermissions },
          after: { permissions: dto.permissions },
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      }),
    ]);
    return { permissions: dto.permissions };
  }

  /** Adminga superadmin huquqini berish yoki olish (faqat superadmin; o‘zini va oxirgi superadminni o‘zgartirib bo‘lmaydi). */
  /** Superadmin: adminga yangi adminlar yaratish huquqini berish/olish va unga qaysi huquqlarni bera olishini belgilash. */
  async setAdminDelegation(actorId: string, userId: string, dto: SetAdminDelegationDto, req: Request) {
    await this.assertSuperAdmin(actorId);
    const target = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, isSuperAdmin: true, canCreateAdmins: true, grantablePermissions: true, deletedAt: true, userRoles: { select: { role: true } } } });
    if (!target || target.deletedAt || !target.userRoles.some((item) => item.role === Role.ADMIN)) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (target.isSuperAdmin) throw new ConflictException(ERRORS.SUPER_ADMIN_ONLY);
    const grantablePermissions = dto.canCreateAdmins ? (dto.grantablePermissions ?? []) : [];
    if (dto.canCreateAdmins && grantablePermissions.length === 0) throw new BadRequestException(ERRORS.ADMIN_GRANTABLE_EMPTY);
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { canCreateAdmins: dto.canCreateAdmins, grantablePermissions } }),
      this.db.auditLog.create({
        data: {
          actorId,
          action: 'ADMIN_DELEGATION_CHANGED',
          targetType: 'User',
          targetId: userId,
          before: { canCreateAdmins: target.canCreateAdmins, grantablePermissions: target.grantablePermissions },
          after: { canCreateAdmins: dto.canCreateAdmins, grantablePermissions },
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      }),
    ]);
    return { canCreateAdmins: dto.canCreateAdmins, grantablePermissions };
  }

  async setSuperAdmin(actorId: string, userId: string, value: boolean, req: Request) {
    await this.assertSuperAdmin(actorId);
    if (userId === actorId) throw new ForbiddenException(ERRORS.CANNOT_MODERATE_ADMIN);
    const target = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, isSuperAdmin: true, deletedAt: true, userRoles: { select: { role: true } } } });
    if (!target || target.deletedAt || !target.userRoles.some((item) => item.role === Role.ADMIN)) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (!value && target.isSuperAdmin) await this.assertAnotherSuperAdmin(userId);
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { isSuperAdmin: value } }),
      this.db.auditLog.create({
        data: {
          actorId,
          action: value ? 'ADMIN_SUPERADMIN_GRANTED' : 'ADMIN_SUPERADMIN_REVOKED',
          targetType: 'User',
          targetId: userId,
          before: { isSuperAdmin: target.isSuperAdmin },
          after: { isSuperAdmin: value },
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      }),
    ]);
    return { isSuperAdmin: value };
  }

  /**
   * Boshqariladigan akkauntni yuklaydi. O‘zini boshqarib bo‘lmaydi. Admin akkauntlarini faqat superadmin boshqara oladi;
   * oddiy mijoz/usta akkauntlarini har qanday admin.
   */
  private async loadModerable(adminId: string, userId: string) {
    const target = await this.db.user.findUnique({ where: { id: userId }, select: { ...USER_SELECT, isSuperAdmin: true } });
    if (!target) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (target.id === adminId) throw new ForbiddenException(ERRORS.CANNOT_MODERATE_ADMIN);
    if (target.userRoles.some((item) => item.role === Role.ADMIN)) await this.assertSuperAdmin(adminId);
    return target;
  }

  async assertSuperAdmin(adminId: string) {
    const actor = await this.db.user.findUnique({ where: { id: adminId }, select: { isSuperAdmin: true, deletedAt: true, status: true } });
    if (!actor || !actor.isSuperAdmin || actor.deletedAt || actor.status !== UserStatus.ACTIVE) throw new ForbiddenException(ERRORS.SUPER_ADMIN_ONLY);
  }

  /** Nishon boshqa faol superadmin qolishini ta’minlaydi (tizim superadminsiz qolib ketmasin). */
  private async assertAnotherSuperAdmin(excludeUserId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.db;
    const others = await db.user.count({ where: { id: { not: excludeUserId }, isSuperAdmin: true, deletedAt: null, status: UserStatus.ACTIVE } });
    if (others < 1) throw new ConflictException(ERRORS.LAST_SUPER_ADMIN);
  }

  private async revokeAllSessions(tx: Prisma.TransactionClient, userId: string) {
    const revokedAt = new Date();
    await tx.refreshToken.updateMany({
      where: { userId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt },
    });
    await tx.deviceSession.updateMany({
      where: { userId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt },
    });
  }
}
