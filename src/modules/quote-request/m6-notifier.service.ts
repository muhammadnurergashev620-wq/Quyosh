import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import type { ShopPermission } from '../../common/constants/shop-permissions';

type Tx = Prisma.TransactionClient;

/** TZ 14.2 bildirishnoma turlari (M6). Matn — in-app; kanal tanlovi notification-send jobida. */
export type M6NotificationType =
  | 'QUOTE_REQUEST_RECEIVED'
  | 'NEW_MESSAGE'
  | 'QUOTE_RECEIVED'
  | 'QUOTE_REVISED'
  | 'QUOTE_ACCEPTED'
  | 'QUOTE_NOT_SELECTED'
  | 'QUOTE_EXPIRING'
  | 'SITE_VISIT_PROPOSED'
  | 'SITE_VISIT_CONFIRMED'
  | 'INSTALLATION_STATUS_CHANGED'
  | 'INSTALLATION_CONFIRM_REMINDER'
  | 'INSTALLATION_ISSUE_REPORTED'
  | 'REVIEW_PUBLISHED'
  | 'REVIEW_REPLY'
  | 'MAINTENANCE_REMINDER'
  | 'WARRANTY_EXPIRING'
  | 'SUPPORT_REPLY'
  | 'SUPPORT_RESOLVED'
  | 'CERTIFICATION_RESULT'
  | 'CERTIFICATION_EXPIRING';

interface Message {
  type: M6NotificationType;
  title: string;
  body: string;
  /** Bildirishnoma bosilganda ochiladigan entity (so‘rov, taklif, montaj). */
  entityType: 'QuoteRequest' | 'RequestShop' | 'Quote' | 'Installation' | 'Review' | 'InstalledSystem' | 'SupportTicket' | 'ShopCertification';
  entityId: string;
  newStatus?: string;
}

/**
 * M6 bildirishnomalari outbox orqali (bir tranzaksiyada): har qabul qiluvchiga alohida hodisa.
 * Do‘kon tomonida — egasi va kerakli ruxsatga ega a’zolar (TZ 2.2); tayinlangan xodim bo‘lsa — u ham.
 */
@Injectable()
export class M6Notifier {
  constructor(private readonly outbox: OutboxService) {}

  async toUser(tx: Tx, userId: string, message: Message, actorId?: string) {
    if (userId === actorId) return;
    await this.outbox.emit(tx, {
      eventName: message.type,
      aggregateType: message.entityType,
      aggregateId: message.entityId,
      payload: { userId, title: message.title, body: message.body, entityId: message.entityId, entityType: message.entityType, ...(message.newStatus ? { newStatus: message.newStatus } : {}) },
      createdById: actorId,
    });
  }

  async toShop(tx: Tx, shopId: string, message: Message, options: { actorId?: string; permission?: ShopPermission; assignedMemberId?: string | null } = {}) {
    const permission = options.permission ?? 'requests.read';
    const members = await tx.shopMember.findMany({ where: { shopId }, select: { id: true, userId: true, memberRole: true, permissions: true } });
    const recipients = members.filter(
      (member) => member.memberRole === 'OWNER' || member.permissions.includes(permission) || member.id === options.assignedMemberId,
    );
    for (const member of recipients) await this.toUser(tx, member.userId, message, options.actorId);
  }
}
