import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { ERRORS } from '../../common/constants/error-messages';
import { PushService, toPushData } from '../push/push.service';

const DUPLICATE_WINDOW_MS = 60_000;

@Injectable()
export class NotificationService {
  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly push: PushService,
  ) {}

  async create(dto: CreateNotificationDto) {
    const recipient = await this.db.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
    if (!recipient) throw new NotFoundException(ERRORS.NOTIFICATION_RECIPIENT_NOT_FOUND);

    const existing = await this.db.notification.findFirst({
      where: {
        userId: dto.userId,
        channel: dto.channel,
        title: dto.title,
        body: dto.body,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
    });
    if (existing) return existing;

    const created = await this.db.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          userId: dto.userId,
          channel: dto.channel,
          title: dto.title,
          body: dto.body,
          template: dto.template,
          data: dto.data as Prisma.InputJsonValue | undefined,
        },
      });
      await this.outbox.emit(tx, {
        eventName: 'notification.deliver',
        aggregateType: 'Notification',
        aggregateId: notification.id,
        payload: { notificationId: notification.id, userId: notification.userId, channel: notification.channel },
      });
      return notification;
    });
    // Telefon (push): ilova yopiq bo‘lsa ham bildirishnoma ko‘rinadi. Xato bo‘lsa ham yaratish to‘xtamaydi.
    void this.push.sendToUser(created.userId, { title: created.title, body: created.body, data: toPushData(created.template, created.data) });
    return created;
  }

  async findAll(userId: string, query: NotificationQueryDto) {
    const rows = await this.db.notification.findMany({
      where: { userId, channel: query.channel ?? 'IN_APP', status: query.status },
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findOne(userId: string, notificationId: string) {
    const notification = await this.db.notification.findFirst({ where: { id: notificationId, userId } });
    if (!notification) throw new NotFoundException(ERRORS.NOTIFICATION_NOT_FOUND);
    return notification;
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.findOne(userId, notificationId);
    if (notification.status === NotificationStatus.READ) return notification;
    return this.db.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.db.notification.updateMany({
      where: { userId, channel: 'IN_APP', status: { not: NotificationStatus.READ } },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return { count: result.count };
  }

  async getUnreadCount(userId: string) {
    const count = await this.db.notification.count({ where: { userId, channel: 'IN_APP', status: { not: NotificationStatus.READ } } });
    return { count };
  }
}
