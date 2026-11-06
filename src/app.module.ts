import { TelegramModule } from './infrastructure/telegram/telegram.module';
import { SmsModule } from './infrastructure/sms/sms.module';
import telegramConfig from './config/telegram.config';
import limitsConfig from './config/limits.config';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';
import scannerConfig from './config/scanner.config';
import mailConfig from './config/mail.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/validation';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { OtpModule } from './modules/otp/otp.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PushModule } from './modules/push/push.module';
import { PublicModule } from './modules/public/public.module';
import { MailModule } from './modules/mail/mail.module';
import { MediaModule } from './modules/media/media.module';
import { AvatarModule } from './modules/avatar/avatar.module';
import { LegalModule } from './modules/legal/legal.module';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';
import { ErrorLogModule } from './modules/error-log/error-log.module';
import { ShopModule } from './modules/shop/shop.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { GeoModule } from './modules/geo/geo.module';
import { CalcModule } from './modules/calc/calc.module';
import { QuoteRequestModule } from './modules/quote-request/quote-request.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { InstalledSystemModule } from './modules/installed-system/installed-system.module';
import { ShopContentModule } from './modules/shop-content/shop-content.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { SupportModule } from './modules/support/support.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { OpsModule } from './modules/ops/ops.module';
import { NotificationChannelsModule } from './modules/notification-channels/notification-channels.module';
import { SiteModule } from './modules/site/site.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, expandVariables: true, load: [appConfig, authConfig, databaseConfig, redisConfig, storageConfig, scannerConfig, mailConfig, telegramConfig, limitsConfig], validate }),
    ScheduleModule.forRoot(), RedisModule, QueueModule, OutboxModule,
    MetricsModule, TelegramModule, SmsModule, PrismaModule, AuthModule, OtpModule, AdminModule, MailModule,
    MediaModule, AvatarModule, NotificationModule, PublicModule, PushModule,
    LegalModule, AuditModule, UsersModule, ErrorLogModule, ShopModule, CatalogModule, GeoModule, CalcModule, QuoteRequestModule,
    AnalyticsModule, InstalledSystemModule, ShopContentModule, KnowledgeModule, SupportModule, MaintenanceModule, OpsModule, NotificationChannelsModule, SiteModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
