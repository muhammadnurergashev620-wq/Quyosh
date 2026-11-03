import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationModule } from '../notification/notification.module';
import { AdminUsersService } from './admin-users.service';
import { AdminBadgesService } from './admin-badges.service';
import { AdminAuditNotifierService } from './admin-audit-notifier.service';
import { AdminDevopsService } from './admin-devops.service';

@Module({
  imports: [NotificationModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminUsersService,
    AdminBadgesService,
    AdminAuditNotifierService,
    AdminDevopsService,
  ],
})
export class AdminModule {}
