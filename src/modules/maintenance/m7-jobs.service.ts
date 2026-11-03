import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { InstalledSystemService } from '../installed-system/installed-system.service';
import { ShopContentService } from '../shop-content/shop-content.service';
import { SupportService } from '../support/support.service';
import { UsersService } from '../users/users.service';

const DAY = 86_400_000;

/**
 * M7 joblari (TZ 14.1): maintenance-reminder, certification-expiry, support-sla-watch, support-autoclose,
 * account-anonymize va cleanup-expired (saqlash muddatlari — TZ 16).
 */
@Injectable()
export class M7JobsService {
  private readonly logger = new Logger(M7JobsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    private readonly systems: InstalledSystemService,
    private readonly content: ShopContentService,
    private readonly support: SupportService,
    private readonly users: UsersService,
  ) {}

  private async run(name: string, fn: () => Promise<unknown>) {
    try {
      const result = await fn();
      this.logger.log(`${name}: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`${name} bajarilmadi: ${(error as Error).message}`);
      return null;
    }
  }

  @Cron('0 9 * * *', { name: 'maintenance-reminder', timeZone: 'Asia/Tashkent' })
  maintenance() {
    return this.run('maintenance-reminder', () => this.systems.sendDueReminders());
  }

  @Cron('20 3 * * *', { name: 'certification-expiry', timeZone: 'Asia/Tashkent' })
  certifications() {
    return this.run('certification-expiry', () => this.content.certificationExpiry());
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'support-sla-watch' })
  slaWatch() {
    return this.run('support-sla-watch', () => this.support.slaWatch());
  }

  @Cron('40 3 * * *', { name: 'support-autoclose', timeZone: 'Asia/Tashkent' })
  autoclose() {
    return this.run('support-autoclose', () => this.support.autoclose());
  }

  @Cron('50 3 * * *', { name: 'account-anonymize', timeZone: 'Asia/Tashkent' })
  anonymize() {
    return this.run('account-anonymize', () => this.users.anonymizeDue());
  }

  @Cron('10 4 * * *', { name: 'cleanup-expired', timeZone: 'Asia/Tashkent' })
  cleanup() {
    return this.run('cleanup-expired', () => this.cleanupExpired());
  }

  /** Saqlash muddatlari (TZ 16): AnalyticsEvent 24 oy, PDF 30 kun, draft 7 kun, OTP 24 soat; eskirgan tokenlar va ulashishlar. */
  async cleanupExpired(now = new Date()) {
    const reports = await this.db.reportJob.findMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * DAY) } }, select: { id: true, objectKey: true }, take: 1000 });
    for (const r of reports) if (r.objectKey) await this.storage.deleteObject(r.objectKey).catch(() => undefined);
    const [analytics, reportRows, drafts, otps, shares] = await Promise.all([
      this.db.analyticsEvent.deleteMany({ where: { occurredAt: { lt: new Date(now.getTime() - 730 * DAY) } } }),
      this.db.reportJob.deleteMany({ where: { id: { in: reports.map((r) => r.id) } } }),
      this.db.calculationDraft.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.db.otpCode.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } } }),
      this.db.calculationShare.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - 30 * DAY) } }, { revokedAt: { lt: new Date(now.getTime() - 30 * DAY) } }] } }),
    ]);
    await this.db.auditLog.create({ data: { actorId: null, action: 'RETENTION_CLEANUP', targetType: 'System', targetId: null, after: { analytics: analytics.count, reports: reportRows.count, drafts: drafts.count, otps: otps.count, shares: shares.count } } });
    return { analytics: analytics.count, reports: reportRows.count, drafts: drafts.count, otps: otps.count, shares: shares.count };
  }
}
