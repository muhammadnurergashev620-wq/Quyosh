import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationFanout, type FanoutEvent } from '../../infrastructure/queue/notification-fanout';
import { SmsService } from '../../infrastructure/sms/sms.service';
import { MailProvider } from '../../infrastructure/mail/mail.provider';
import { ProviderStatsService } from '../ops/provider-stats.service';
import { CHANNEL_RULES, resolveChannels, smsSendAt, smsText, type ExternalChannel } from './channels';

/** Bildirishnoma qayerga olib boradi (email havolasi uchun). */
function linkFor(base: { customer: string; shop: string }, payload: Record<string, unknown>, userIsCustomer: boolean): string | null {
  const id = typeof payload.entityId === 'string' ? payload.entityId : null;
  if (!id) return null;
  const c = base.customer.replace(/\/$/, '');
  const s = base.shop.replace(/\/$/, '');
  switch (payload.entityType) {
    case 'RequestShop': return userIsCustomer ? `${c}/mijoz/chat/${id}` : `${s}/dokon/sorovlar/${id}`;
    case 'Quote': return `${c}/mijoz/takliflar/${id}`;
    case 'QuoteRequest': return `${c}/mijoz/sorovlar/${id}`;
    case 'Installation': return userIsCustomer ? `${c}/mijoz/montajlar/${id}` : `${s}/dokon/montajlar/${id}`;
    case 'InstalledSystem': return `${c}/mijoz/tizimim/${id}`;
    case 'SupportTicket': return `${c}/mijoz/murojaatlar/${id}`;
    case 'ShopCertification': return `${s}/dokon`;
    default: return null;
  }
}

/**
 * SMS va email kanallari (TZ 14.2, 14.3: provider adapter). In-app bildirishnoma yaratilgach (outbox → fanout)
 * har tashqi kanal uchun alohida Notification yozuvi: idempotent (outboxEventId + kanal), tungi SMS kechiktiriladi.
 */
@Injectable()
export class NotificationChannelsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationChannelsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly fanout: NotificationFanout,
    private readonly sms: SmsService,
    private readonly mail: MailProvider,
    private readonly config: ConfigService,
    private readonly stats: ProviderStatsService,
  ) {}

  onModuleInit() {
    this.fanout.register((event) => this.onNotification(event));
  }

  async onNotification(event: FanoutEvent) {
    if (!CHANNEL_RULES[event.eventName]) return;
    const [user, pref] = await Promise.all([
      this.db.user.findUnique({ where: { id: event.userId }, select: { phone: true, email: true, deletedAt: true, userRoles: { select: { role: true } } } }),
      this.db.notificationPreference.findUnique({ where: { userId_type: { userId: event.userId, type: event.eventName } } }),
    ]);
    if (!user || user.deletedAt) return;
    for (const channel of resolveChannels(event.eventName, pref?.channels ?? null)) {
      const address = channel === 'SMS' ? user.phone : user.email;
      if (!address) continue;
      const exists = await this.db.notification.findFirst({ where: { userId: event.userId, channel, data: { path: ['outboxEventId'], equals: event.outboxEventId } }, select: { id: true } });
      if (exists) continue;
      const isCustomer = user.userRoles.some((r) => r.role === 'CUSTOMER') && event.payload.entityType !== 'ShopCertification';
      const link = linkFor({ customer: this.config.get<string>('app.customerUrl', ''), shop: this.config.get<string>('app.shopUrl', '') }, event.payload, isCustomer);
      const scheduledFor = channel === 'SMS' ? smsSendAt(event.eventName) : null;
      const row = await this.db.notification.create({
        data: {
          userId: event.userId, channel, title: event.title, body: event.body, template: event.eventName, status: 'PENDING', scheduledFor,
          data: { outboxEventId: event.outboxEventId, ...(typeof event.payload.entityId === 'string' ? { entityId: event.payload.entityId } : {}), ...(link ? { link } : {}) } as Prisma.InputJsonValue,
        },
      });
      if (!scheduledFor) await this.deliver(row.id);
    }
  }

  /** Bitta yozuvni yetkazish; xato — FAILED va sabab (qayta urinish yo‘q, SMS kvotasini tejash uchun). */
  async deliver(notificationId: string) {
    const n = await this.db.notification.findUnique({ where: { id: notificationId }, include: { user: { select: { phone: true, email: true } } } });
    if (!n || n.status !== 'PENDING') return;
    const data = (n.data ?? {}) as { link?: string };
    try {
      if (n.channel === 'SMS') {
        if (!this.sms.isEnabled()) throw new Error('SMS_NOT_CONFIGURED');
        await this.stats.measure('SMS', () => this.sms.send(n.user.phone!, smsText(n.title, n.body)));
      } else if (n.channel === 'EMAIL') {
        await this.stats.measure('EMAIL', () => this.mail.sendMail({ to: n.user.email!, subject: `Quyosh: ${n.title}`, text: `${n.body}${data.link ? `\n\n${data.link}` : ''}\n\n— Quyosh.uz\nBildirishnoma sozlamalari: ${this.config.get<string>('app.customerUrl', '').replace(/\/$/, '')}/sozlamalar/bildirishnomalar` }));
      }
      await this.db.notification.update({ where: { id: n.id }, data: { status: 'SENT', sentAt: new Date() } });
    } catch (error) {
      await this.db.notification.update({ where: { id: n.id }, data: { status: 'FAILED', error: (error as Error).message.slice(0, 500) } });
    }
  }

  /** Tungi vaqtda qoldirilgan SMSlar (08:00 dan keyin). */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'notification-scheduled-send' })
  async sendScheduled(now = new Date()) {
    const due = await this.db.notification.findMany({ where: { status: 'PENDING', channel: { in: ['SMS', 'EMAIL'] }, scheduledFor: { lte: now } }, select: { id: true }, take: 200 });
    for (const n of due) await this.deliver(n.id).catch((e: Error) => this.logger.warn(e.message));
    return { sent: due.length };
  }

  // ───────────── Sozlamalar (TZ 7.2 NotificationPreference) ─────────────

  async preferences(userId: string) {
    const [rows, user] = await Promise.all([
      this.db.notificationPreference.findMany({ where: { userId } }),
      this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, email: true, userRoles: { select: { role: true } } } }),
    ]);
    const roles = user.userRoles.map((r) => r.role);
    return {
      contacts: { phone: !!user.phone, email: !!user.email, smsAvailable: this.sms.isEnabled() },
      items: Object.entries(CHANNEL_RULES)
        .filter(([, r]) => r.audience === 'ALL' || (r.audience === 'SHOP' ? roles.includes('SHOP') : roles.includes('CUSTOMER')))
        .map(([type, r]) => ({ type, allowed: r.allowed, locked: !!r.locked, channels: resolveChannels(type, rows.find((x) => x.type === type)?.channels ?? null), isDefault: !rows.some((x) => x.type === type) })),
    };
  }

  async setPreference(userId: string, type: string, channels: string[]) {
    const rule = CHANNEL_RULES[type];
    if (!rule || rule.locked) throw new BadRequestException('Bu bildirishnoma turini o‘zgartirib bo‘lmaydi');
    const clean = [...new Set(channels)].filter((c): c is ExternalChannel => (rule.allowed as string[]).includes(c));
    await this.db.notificationPreference.upsert({ where: { userId_type: { userId, type } }, update: { channels: clean }, create: { userId, type, channels: clean } });
    return this.preferences(userId);
  }
}
