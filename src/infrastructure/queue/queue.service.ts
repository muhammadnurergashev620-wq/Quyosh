import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { BULLMQ_CONNECTION, OUTBOX_QUEUE_NAME } from './queue.constants';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queue!: Queue<{ eventId: string }>;

  constructor(@Inject(BULLMQ_CONNECTION) private readonly connection: Redis) {}

  onModuleInit() {
    this.queue = new Queue(OUTBOX_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: Number(process.env.OUTBOX_JOB_ATTEMPTS ?? 5),
        backoff: { type: 'exponential', delay: Number(process.env.OUTBOX_JOB_BACKOFF_MS ?? 10_000) },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: false,
      },
    });
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  async enqueueOutboxEvent(eventId: string): Promise<void> {
    await this.queue.add('deliver', { eventId }, { jobId: eventId });
  }

  getQueue(): Queue<{ eventId: string }> {
    return this.queue;
  }
}
