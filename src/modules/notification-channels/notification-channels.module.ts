import { Module } from '@nestjs/common';
import { NotificationChannelsService } from './notification-channels.service';
import { NotificationPreferencesController } from './notification-channels.controller';

/** SMS va email kanallari (TZ 14.2). */
@Module({ controllers: [NotificationPreferencesController], providers: [NotificationChannelsService], exports: [NotificationChannelsService] })
export class NotificationChannelsModule {}
