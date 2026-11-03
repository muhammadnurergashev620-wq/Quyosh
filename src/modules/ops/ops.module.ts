import { Global, Module } from '@nestjs/common';
import { ProviderStatsService } from './provider-stats.service';
import { OpsService } from './ops.service';
import { AdminOpsController, OpsWebhooksController } from './ops.controller';

/** Ops: provayder hisoblagichlari (global), kvota, alertlar, deploylar (TZ 19.1). */
@Global()
@Module({ controllers: [OpsWebhooksController, AdminOpsController], providers: [ProviderStatsService, OpsService], exports: [ProviderStatsService, OpsService] })
export class OpsModule {}
