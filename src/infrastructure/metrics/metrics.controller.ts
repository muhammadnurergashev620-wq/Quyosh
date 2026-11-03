import { Controller, Get, Headers, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../../common/decorators/public.decorator';
import { QueueService } from '../queue/queue.service';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  async scrape(@Res() res: Response, @Headers('authorization') authorization?: string): Promise<void> {
    this.assertAuthorized(authorization);
    const counts = await this.queue.getQueue().getJobCounts('waiting', 'delayed', 'active');
    this.metrics.setQueueDepth('outbox-events', (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0));
    res.type('text/plain; version=0.0.4; charset=utf-8').send(await this.metrics.registry.metrics());
  }

  private assertAuthorized(authorization?: string): void {
    const token = this.config.get<string>('METRICS_TOKEN');
    // Token sozlanmagan bo‘lsa /metrics hech qaysi muhitda ochilmaydi (tunnel/proksi ortida «localhost» ishonchli emas).
    if (!token) throw new UnauthorizedException();
    const given = Buffer.from(authorization?.replace(/^Bearer\s+/i, '') ?? '');
    const expected = Buffer.from(token);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException();
  }
}
