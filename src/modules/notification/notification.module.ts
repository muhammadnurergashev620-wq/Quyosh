import { Module } from '@nestjs/common';
import { AdminNotificationController } from './admin-notification.controller';
import { AdminNotificationService } from './admin-notification.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController, AdminNotificationController],
  providers: [NotificationService, AdminNotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
