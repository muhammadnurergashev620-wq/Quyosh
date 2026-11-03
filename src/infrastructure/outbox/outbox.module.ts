import { Global, Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { OutboxService } from './outbox.service';
import { OutboxDispatcherService } from './outbox-publisher.service';

@Global()
@Module({
  imports: [QueueModule],
  providers: [OutboxService, OutboxDispatcherService],
  exports: [OutboxService],
})
export class OutboxModule {}
