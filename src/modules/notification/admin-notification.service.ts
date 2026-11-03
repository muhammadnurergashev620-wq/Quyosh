import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus, Prisma, Role } from '@prisma/client';
import { ERRORS } from '../../common/constants/error-messages';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminNotificationQueryDto } from './dto/admin-notification-query.dto';
import { categoryOf, priorityOf } from './notification-classify';

const MAX_ROWS = 3000;
const DAY = 86_400_000;
const PERSON = { id: true, accountNumber: true, firstName: true, lastName: true, phone: true, avatarAssetId: true } as const;

interface Row {
  id: string;
  channel: string;
  title: string;
  body: string;
  template: string | null;
  data: Prisma.JsonValue;
  status: NotificationStatus;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
}

const dataOf = (row: Pick<Row, 'data'>): Record<string, unknown> => (row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : {});
const actionOf = (row: Pick<Row, 'data'>) => (typeof dataOf(row).action === 'string' ? (dataOf(row).action as string) : null);

/** Administratorning o‘z bildirishnomalari: turi va muhimligi bo‘yicha saralangan ro‘yxat, statistika va batafsil ko‘rinish. */
@Injectable()
export class AdminNotificationService {
  constructor(private readonly db: PrismaService) {}

  private classify(row: Row) {
    const action = actionOf(row);
    return { action, category: categoryOf(row.template, action), priority: priorityOf(row.template, action) };
  }

  private async load(userId: string, where: Prisma.NotificationWhereInput = {}, dir: 'asc' | 'desc' = 'desc') {
    return this.db.notification.findMany({
      where: { userId, ...where },
      orderBy: [{ createdAt: dir }, { id: dir }],
      take: MAX_ROWS,
      select: { id: true, channel: true, title: true, body: true, template: true, data: true, status: true, sentAt: true, readAt: true, createdAt: true },
    });
  }

  async list(userId: string, query: AdminNotificationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.NotificationWhereInput = {
      ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
      ...(query.state === 'UNREAD' ? { status: { not: NotificationStatus.READ } } : query.state === 'READ' ? { status: NotificationStatus.READ } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { body: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    const rows = await this.load(userId, where, query.dir ?? 'desc');
    const classified = rows.map((row) => ({ row, ...this.classify(row) })).filter((item) => (!query.category || item.category === query.category) && (!query.priority || item.priority === query.priority));
    const limit = query.limit ?? 10;
    const page = query.page ?? 1;
    const slice = classified.slice((page - 1) * limit, page * limit);

    // Ko‘rsatiladigan sahifa uchun audit yozuvi (kim bajargan, qaysi obyekt) va buyurtma raqamlari.
    const auditIds = slice.map((item) => dataOf(item.row).auditLogId).filter((id): id is string => typeof id === 'string');
    const logs = auditIds.length
      ? await this.db.auditLog.findMany({ where: { id: { in: auditIds } }, select: { id: true, targetType: true, targetId: true, actor: { select: { ...PERSON, userRoles: { select: { role: true } } } } } })
      : [];
    const logById = new Map(logs.map((log) => [log.id, log]));

    return {
      items: slice.map(({ row, action, category, priority }) => {
        const data = dataOf(row);
        const log = typeof data.auditLogId === 'string' ? logById.get(data.auditLogId) : undefined;
        const roles = log?.actor?.userRoles.map((item) => item.role) ?? [];
        return {
          id: row.id,
          channel: row.channel,
          title: row.title,
          body: row.body,
          template: row.template,
          status: row.status,
          read: row.status === NotificationStatus.READ,
          readAt: row.readAt,
          sentAt: row.sentAt,
          createdAt: row.createdAt,
          category,
          priority,
          action,
          actor: log?.actor ? { id: log.actor.id, accountNumber: log.actor.accountNumber, firstName: log.actor.firstName, lastName: log.actor.lastName, avatarAssetId: log.actor.avatarAssetId, role: roles.includes(Role.ADMIN) ? 'ADMIN' : roles.includes(Role.SHOP) ? 'SHOP' : 'CUSTOMER' } : null,
          object: log?.targetType ? { type: log.targetType, id: log.targetId, number: null } : null,
          path: typeof data.path === 'string' ? data.path : null,
        };
      }),
      total: classified.length,
      page,
      limit,
      pages: Math.max(1, Math.ceil(classified.length / limit)),
      unread: classified.filter((item) => item.row.status !== NotificationStatus.READ).length,
      truncated: rows.length >= MAX_ROWS,
    };
  }

  /** Yuqoridagi kartalar: jami, o‘qilmagan, muhim, tizim + oxirgi 7 kunda yangilari va oldingi 7 kunga nisbatan o‘zgarish. */
  async stats(userId: string) {
    const rows = await this.load(userId);
    const now = Date.now();
    const last7 = now - 7 * DAY;
    const prev7 = now - 14 * DAY;
    const items = rows.map((row) => ({ row, ...this.classify(row) }));
    const bucket = (filter: (item: (typeof items)[number]) => boolean) => {
      const matching = items.filter(filter);
      const created = (from: number, to: number) => matching.filter((item) => item.row.createdAt.getTime() >= from && item.row.createdAt.getTime() < to).length;
      const current = created(last7, Infinity);
      const previous = created(prev7, last7);
      return { total: matching.length, last7: current, prev7: previous, changePercent: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null };
    };
    return {
      total: bucket(() => true),
      unread: bucket((item) => item.row.status !== NotificationStatus.READ),
      important: bucket((item) => item.priority === 'HIGH'),
      system: bucket((item) => item.category === 'SYSTEM'),
      truncated: rows.length >= MAX_ROWS,
    };
  }

  async detail(userId: string, id: string) {
    const row = await this.db.notification.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException(ERRORS.NOTIFICATION_NOT_FOUND);
    const data = dataOf(row);
    const meta = this.classify(row);
    const log = typeof data.auditLogId === 'string'
      ? await this.db.auditLog.findUnique({ where: { id: data.auditLogId }, select: { id: true, action: true, reason: true, targetType: true, targetId: true, ipAddress: true, createdAt: true, actor: { select: { ...PERSON, userRoles: { select: { role: true } } } } } })
      : null;
    const targetUser = log?.targetType === 'User' && log.targetId ? await this.db.user.findUnique({ where: { id: log.targetId }, select: { ...PERSON, userRoles: { select: { role: true } } } }) : null;
    const roleOf = (roles: Array<{ role: Role }>) => (roles.some((item) => item.role === Role.ADMIN) ? 'ADMIN' : roles.some((item) => item.role === Role.SHOP) ? 'SHOP' : 'CUSTOMER');
    const events = [
      { kind: 'created', at: row.createdAt, label: 'Bildirishnoma yaratildi' },
      ...(row.sentAt ? [{ kind: 'sent', at: row.sentAt, label: 'Yuborildi' }] : []),
      ...(log ? [{ kind: 'audit', at: log.createdAt, label: log.action }] : []),
      ...(row.readAt ? [{ kind: 'read', at: row.readAt, label: 'O‘qilgan deb belgilandi' }] : []),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    return {
      id: row.id,
      channel: row.channel,
      title: row.title,
      body: row.body,
      template: row.template,
      status: row.status,
      read: row.status === NotificationStatus.READ,
      readAt: row.readAt,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
      error: row.error,
      category: meta.category,
      priority: meta.priority,
      action: meta.action,
      path: typeof data.path === 'string' ? data.path : null,
      audit: log ? { id: log.id, action: log.action, reason: log.reason, ipAddress: log.ipAddress, createdAt: log.createdAt, actor: log.actor ? { id: log.actor.id, accountNumber: log.actor.accountNumber, firstName: log.actor.firstName, lastName: log.actor.lastName, phone: log.actor.phone, role: roleOf(log.actor.userRoles) } : null, targetType: log.targetType, targetId: log.targetId } : null,
      targetUser: targetUser ? { id: targetUser.id, accountNumber: targetUser.accountNumber, firstName: targetUser.firstName, lastName: targetUser.lastName, phone: targetUser.phone, role: roleOf(targetUser.userRoles) } : null,
      events,
    };
  }

  async markRead(userId: string, ids: string[]) {
    const result = await this.db.notification.updateMany({ where: { userId, id: { in: ids.slice(0, 200) }, status: { not: NotificationStatus.READ } }, data: { status: NotificationStatus.READ, readAt: new Date() } });
    return { count: result.count };
  }

  async markUnread(userId: string, id: string) {
    const row = await this.db.notification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!row) throw new NotFoundException(ERRORS.NOTIFICATION_NOT_FOUND);
    await this.db.notification.update({ where: { id }, data: { status: NotificationStatus.SENT, readAt: null } });
    return { id, read: false };
  }
}
