import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { QuoteService } from '../quote/quote.service';
import { InstallationService } from '../installation/installation.service';
import { QuoteRequestService } from './quote-request.service';
import { canRequestTransition } from './quote-request-state-machine';

const REQUEST_IDLE_DAYS = 30;
const RESPONSE_WINDOW_DAYS = 90;
const RESPONSE_MIN_SAMPLES = 5;

/** M6 joblari (TZ 14.1): quote-expiry-check, request-expiry-check, installation-reminder, response-time-recalc. */
@Injectable()
export class M6JobsService {
  private readonly logger = new Logger(M6JobsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly quotes: QuoteService,
    private readonly installations: InstallationService,
    private readonly requests: QuoteRequestService,
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

  @Cron(CronExpression.EVERY_HOUR, { name: 'quote-expiry-check' })
  quoteExpiry() {
    return this.run('quote-expiry-check', () => this.quotes.expireAndWarn());
  }

  @Cron('15 3 * * *', { name: 'request-expiry-check', timeZone: 'Asia/Tashkent' })
  requestExpiry() {
    return this.run('request-expiry-check', () => this.expireIdleRequests());
  }

  @Cron('0 10 * * *', { name: 'installation-reminder', timeZone: 'Asia/Tashkent' })
  installationReminder() {
    return this.run('installation-reminder', () => this.installations.sendConfirmReminders());
  }

  @Cron('30 3 * * *', { name: 'response-time-recalc', timeZone: 'Asia/Tashkent' })
  responseTime() {
    return this.run('response-time-recalc', () => this.recalcResponseTimes());
  }

  /** 30 kun faolliksiz OPEN so‘rov → EXPIRED; do‘konlar NOT_SELECTED. */
  async expireIdleRequests(now = new Date()) {
    const idle = await this.db.quoteRequest.findMany({ where: { status: 'OPEN', lastActivityAt: { lt: new Date(now.getTime() - REQUEST_IDLE_DAYS * 86_400_000) } }, select: { id: true, status: true } });
    let expired = 0;
    for (const row of idle) {
      if (!canRequestTransition(row.status, 'EXPIRED', 'SYSTEM')) continue;
      await this.db.$transaction(async (tx) => {
        const updated = await tx.quoteRequest.updateMany({ where: { id: row.id, status: 'OPEN' }, data: { status: 'EXPIRED', closedAt: now } });
        if (!updated.count) return;
        await this.requests.closeOutShops(tx, row.id, null, 'EXPIRED');
        expired += 1;
      });
    }
    return { expired };
  }

  /** 13.5: oxirgi 90 kunda sentAt → firstResponseAt medianasi (daqiqa); kamida 5 ta so‘rov bo‘lsa. */
  async recalcResponseTimes(now = new Date()) {
    const since = new Date(now.getTime() - RESPONSE_WINDOW_DAYS * 86_400_000);
    const rows = await this.db.$queryRaw<Array<{ shop_id: string; n: bigint; median: number | null }>>`
      SELECT shop_id, COUNT(*) AS n,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_response_at - sent_at)) / 60.0) AS median
      FROM quote_request_shops
      WHERE sent_at >= ${since} AND first_response_at IS NOT NULL
      GROUP BY shop_id`;
    const qualified = new Map(rows.filter((r) => Number(r.n) >= RESPONSE_MIN_SAMPLES && r.median !== null).map((r) => [r.shop_id, Math.max(1, Math.round(Number(r.median)))]));
    await this.db.shop.updateMany({ where: { avgResponseMinutes: { not: null }, id: { notIn: [...qualified.keys()] } }, data: { avgResponseMinutes: null } });
    for (const [shopId, minutes] of qualified) await this.db.shop.update({ where: { id: shopId }, data: { avgResponseMinutes: minutes } });
    return { shops: qualified.size };
  }
}
