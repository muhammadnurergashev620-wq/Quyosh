import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { AdminNotificationQueryDto, BulkReadDto } from './dto/admin-notification-query.dto';
import { AdminNotificationService } from './admin-notification.service';

/** Administratorning o‘z bildirishnomalari (boshqa adminlarnikini ko‘ra olmaydi). */
@Controller('admin/notifications')
@Roles(Role.ADMIN)
export class AdminNotificationController {
  constructor(private readonly service: AdminNotificationService) {}

  @Get()
  list(@CurrentUser('sub') userId: string, @Query() query: AdminNotificationQueryDto) {
    return this.service.list(userId, query);
  }

  @Get('stats')
  stats(@CurrentUser('sub') userId: string) {
    return this.service.stats(userId);
  }

  @Post('read')
  read(@CurrentUser('sub') userId: string, @Body() dto: BulkReadDto) {
    return this.service.markRead(userId, dto.ids);
  }

  @Get(':id')
  detail(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(userId, id);
  }

  @Patch(':id/unread')
  unread(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.markUnread(userId, id);
  }
}
