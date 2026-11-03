import { Injectable, NotFoundException } from '@nestjs/common';
import { ERRORS } from '../../common/constants/error-messages';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { cursorArgs, dateRangeWhere, toCursorPage } from '../../common/utils/cursor';
import { ActorRole, ActorRoleFilter, AuditQueryDto } from './dto/audit-query.dto';

const PERSON = { id: true, accountNumber: true, firstName: true, lastName: true, phone: true } as const;

/** Texnik yozuv: har bir sessiya yangilanishida yoziladi, odam ko‘zi uchun ma’lumot bermaydi. */
const TECHNICAL_ACTION = 'AUTH_REFRESH_ROTATED';
/** Amal kodida shu bo‘laklar bo‘lsa, natija «rad etilgan / xato» deb hisoblanadi. */
const FAILURE_MARKERS = ['FAILED', 'DENIED', 'REJECT', 'ERROR', 'UNHANDLED', 'MISMATCH'];
/** Xavfsizlik hodisalari: parol, sessiya, ikki bosqichli himoya, bloklash, huquqlar. */
const SECURITY_PREFIXES = ['AUTH_LOGOUT_ALL', 'AUTH_SESSION_REVOKED', 'AUTH_OTHER_SESSIONS_REVOKED', 'AUTH_REGISTER_DUPLICATE', 'USER_TWO_FACTOR', 'USER_PASSWORD', 'USER_SELF_DELETED', 'USER_ACTION', 'ADMIN_USER_', 'ADMIN_ADMIN_', 'ADMIN_PERMISSIONS', 'ADMIN_DELEGATION', 'ADMIN_SUPER', 'ADMIN_AVATAR_PERMISSION', 'ADMIN_REGISTRATION', 'PAYMENT_WEBHOOK_MISMATCH'];
const NOT_SECURITY_PREFIXES = ['ADMIN_USER_AVATAR'];

const failureWhere: Prisma.AuditLogWhereInput = { OR: FAILURE_MARKERS.map((marker) => ({ action: { contains: marker } })) };
const securityWhere: Prisma.AuditLogWhereInput = {
  AND: [{ OR: SECURITY_PREFIXES.map((prefix) => ({ action: { startsWith: prefix } })) }, ...NOT_SECURITY_PREFIXES.map((prefix) => ({ NOT: { action: { startsWith: prefix } } }))],
};
const isFailure = (action: string) => FAILURE_MARKERS.some((marker) => action.includes(marker));

@Injectable()
export class AuditService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Bajaruvchi turi: admin roli bor bo‘lsa — admin; aks holda do‘kon roli bor bo‘lsa — do‘kon; qolganlari — mijoz.
   * Bajaruvchisi yo‘q yozuvlar — tizim.
   */
  private roleWhere(role: ActorRoleFilter): Prisma.AuditLogWhereInput {
    const admin = { userRoles: { some: { role: Role.ADMIN } } };
    const shop = { userRoles: { some: { role: Role.SHOP } } };
    switch (role) {
      case 'USERS':
        return { actor: { is: { NOT: admin } } };
      case 'SYSTEM':
        return { actorId: null };
      case 'ADMIN':
        return { actor: { is: admin } };
      case 'SHOP':
        return { actor: { is: { AND: [shop, { NOT: admin }] } } };
      default:
        return { actor: { is: { AND: [{ NOT: admin }, { NOT: shop }] } } };
    }
  }

  private baseWhere(query: AuditQueryDto): Prisma.AuditLogWhereInput {
    const search = query.search?.trim();
    return {
      actorId: query.actorId,
      ...(query.actorNumber ? { actor: { is: { accountNumber: query.actorNumber } } } : {}),
      targetType: query.targetType,
      targetId: query.targetId,
      createdAt: dateRangeWhere(query),
      AND: [
        ...(query.action ? [{ action: query.action }] : []),
        ...(query.category ? [{ action: { startsWith: query.category } }] : []),
        ...(query.technical === 'true' || query.action === TECHNICAL_ACTION ? [] : [{ NOT: { action: TECHNICAL_ACTION } }]),
        ...(query.outcome === 'FAILED' ? [failureWhere] : query.outcome === 'SUCCESS' ? [{ NOT: failureWhere }] : []),
        ...(query.kind === 'security' ? [securityWhere] : []),
        ...(search
          ? [
              {
                OR: [
                  { action: { contains: search, mode: 'insensitive' as const } },
                  { reason: { contains: search, mode: 'insensitive' as const } },
                  { ipAddress: { contains: search } },
                  { actor: { is: { OR: [{ phone: { contains: search } }, { firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }] } } },
                ],
              },
            ]
          : []),
      ],
    };
  }

  async findAll(query: AuditQueryDto) {
    const base = this.baseWhere(query);
    const where: Prisma.AuditLogWhereInput = query.actorRole ? { AND: [base, this.roleWhere(query.actorRole)] } : base;
    const dir = query.dir ?? 'desc';
    const args = { where, include: { actor: { select: { ...PERSON, userRoles: { select: { role: true } } } } }, orderBy: [{ createdAt: dir }, { id: dir }] satisfies Prisma.AuditLogOrderByWithRelationInput[] };
    const shape = (rows: Array<Prisma.AuditLogGetPayload<{ include: { actor: { select: typeof PERSON & { userRoles: { select: { role: true } } } } } }>>) =>
      rows.map(({ actor, ...log }) => {
        const roles = actor?.userRoles.map((item) => item.role) ?? [];
        const actorRole: ActorRole = !actor ? 'SYSTEM' : roles.includes(Role.ADMIN) ? 'ADMIN' : roles.includes(Role.SHOP) ? 'SHOP' : 'CUSTOMER';
        return {
          ...log,
          code: `AUD-${log.id.slice(0, 8).toUpperCase()}`,
          outcome: isFailure(log.action) ? ('FAILED' as const) : ('SUCCESS' as const),
          actor: actor ? { id: actor.id, accountNumber: actor.accountNumber, firstName: actor.firstName, lastName: actor.lastName, phone: actor.phone } : null,
          actorRole,
        };
      });

    if (query.page) {
      const limit = query.limit ?? 20;
      const [total, rows] = await Promise.all([this.db.auditLog.count({ where }), this.db.auditLog.findMany({ ...args, skip: (query.page - 1) * limit, take: limit })]);
      return { items: await this.withTargetUsers(shape(rows)), total, page: query.page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
    }
    const rows = await this.db.auditLog.findMany({ ...args, ...cursorArgs(query) });
    const page = toCursorPage(rows, query);
    return { ...page, items: await this.withTargetUsers(shape(page.items)) };
  }

  /** Yuqoridagi kartalar: jami, foydalanuvchilar, adminlar, xavfsizlik va tizim hodisalari + oldingi teng davr bilan solishtirish. */
  async stats(query: AuditQueryDto) {
    const { from, to } = query;
    const count = async (range: { from?: string; to?: string }) => {
      const base = this.baseWhere({ ...query, ...range, actorRole: undefined, kind: undefined });
      const [total, users, admins, system, security] = await Promise.all([
        this.db.auditLog.count({ where: base }),
        this.db.auditLog.count({ where: { AND: [base, { OR: [this.roleWhere('CUSTOMER'), this.roleWhere('SHOP')] }] } }),
        this.db.auditLog.count({ where: { AND: [base, this.roleWhere('ADMIN')] } }),
        this.db.auditLog.count({ where: { AND: [base, this.roleWhere('SYSTEM')] } }),
        this.db.auditLog.count({ where: { AND: [base, securityWhere] } }),
      ]);
      return { total, users, admins, system, security };
    };
    const current = await count({ from, to });
    let previous: typeof current | null = null;
    if (from && to) {
      const span = new Date(to).getTime() - new Date(from).getTime();
      if (span > 0) previous = await count({ from: new Date(new Date(from).getTime() - span - 1).toISOString(), to: new Date(new Date(from).getTime() - 1).toISOString() });
    }
    return { current, previous };
  }

  /** Bir yozuvga bog‘liq boshqa yozuvlar: shu so‘rov (requestId) yoki shu obyekt (targetId) bo‘yicha. */
  async related(id: string) {
    const log = await this.db.auditLog.findUnique({ where: { id }, select: { id: true, requestId: true, targetId: true, targetType: true } });
    if (!log) throw new NotFoundException(ERRORS.PRISMA_NOT_FOUND);
    const or: Prisma.AuditLogWhereInput[] = [];
    if (log.requestId) or.push({ requestId: log.requestId });
    if (log.targetId) or.push({ targetId: log.targetId, ...(log.targetType ? { targetType: log.targetType } : {}) });
    if (or.length === 0) return { items: [] };
    const rows = await this.db.auditLog.findMany({
      where: { id: { not: id }, action: { not: TECHNICAL_ACTION }, OR: or },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, createdAt: true, reason: true, targetType: true, targetId: true, actor: { select: PERSON } },
    });
    return { items: rows.map((row) => ({ ...row, code: `AUD-${row.id.slice(0, 8).toUpperCase()}` })) };
  }

  /** Bajaruvchi turlari bo‘yicha yozuvlar soni (boshqa filtrlar hisobga olinadi, bajaruvchi turidan tashqari). */
  async summary(query: AuditQueryDto) {
    const base = this.baseWhere(query);
    const roles: ActorRole[] = ['ADMIN', 'SHOP', 'CUSTOMER', 'SYSTEM'];
    const counts = await Promise.all(roles.map((role) => this.db.auditLog.count({ where: { AND: [base, this.roleWhere(role)] } })));
    const byRole = Object.fromEntries(roles.map((role, index) => [role, counts[index]!]));
    return { ...byRole, ALL: counts.reduce((sum, value) => sum + value, 0) };
  }

  /** Amal kimga qarshi bajarilganini (foydalanuvchi yoki do‘kon a’zosi) ko‘rsatish uchun. */
  private async withTargetUsers<T extends { targetType: string | null; targetId: string | null }>(items: T[]) {
    const userIds = new Set<string>();
    for (const item of items) {
      if (item.targetId && item.targetType === 'User') userIds.add(item.targetId);
    }
    const users = userIds.size ? await this.db.user.findMany({ where: { id: { in: [...userIds] } }, select: PERSON }) : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return items.map((item) => ({
      ...item,
      targetUser: (item.targetType === 'User' && item.targetId && byId.get(item.targetId)) || null,
    }));
  }
}
