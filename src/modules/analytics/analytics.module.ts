import { Global, Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { DashboardService } from './dashboard.service';
import { AdminAnalyticsController, AnalyticsController, ShopAnalyticsController } from './analytics.controller';

/** Analitika va bosh panellar (TZ 7.7, U10.1, U11.2, U11.14, U12.1, U12.10). Global — boshqa modullar hodisa yozadi. */
@Global()
@Module({
  controllers: [AnalyticsController, ShopAnalyticsController, AdminAnalyticsController],
  providers: [AnalyticsService, DashboardService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
