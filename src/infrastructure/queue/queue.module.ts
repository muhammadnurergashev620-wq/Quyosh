import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { BULLMQ_CONNECTION } from './queue.constants';
import { QueueService } from './queue.service';
import { OutboxProcessor } from './outbox.processor';
import { NotificationFanout } from './notification-fanout';
import { MediaProcessingModule } from '../media/media-processing.module';
import { StorageModule } from '../storage/storage.module';

@Global()
@Module({
  imports: [MediaProcessingModule, StorageModule],
  providers: [
    {
      provide: BULLMQ_CONNECTION,
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('redis.url'), { maxRetriesPerRequest: null }),
      inject: [ConfigService],
    },
    QueueService,
    OutboxProcessor,
    NotificationFanout,
  ],
  exports: [QueueService, BULLMQ_CONNECTION, NotificationFanout],
})
export class QueueModule {}
