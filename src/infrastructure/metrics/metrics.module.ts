import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { SystemMetricsService } from './system-metrics.service';
import { RequestRateService } from './request-rate.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, RequestRateService, SystemMetricsService],
  exports: [MetricsService, RequestRateService, SystemMetricsService],
})
export class MetricsModule {}
