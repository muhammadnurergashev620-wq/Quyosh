import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';

const POLL_INTERVAL_MS = 3000;
const BATCH_SIZE = 50;

@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private running = false;

  constructor(
    private readonly db: PrismaService,
    private readonly queue: QueueService,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async dispatch(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.db.outboxEvent.findMany({
        where: { status: 'PENDING', availableAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
        select: { id: true },
      });
      for (const event of events) {
        await this.queue.enqueueOutboxEvent(event.id);
      }
    } catch (error) {
      this.logger.error(`Outbox yuborish sikli bajarilmadi: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredIdempotencyKeys(): Promise<void> {
    try {
      const { count } = await this.db.idempotencyKey.deleteMany({ where: { expiresAt: { lte: new Date() } } });
      if (count > 0) this.logger.log(`Muddati tugagan ${count} ta idempotency kaliti o‘chirildi`);
    } catch (error) {
      this.logger.error(`Idempotency kalitlarini tozalab bo‘lmadi: ${(error as Error).message}`);
    }
  }
}
