import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(@CurrentUser('sub') userId: string, @Query() query: NotificationQueryDto) {
    return this.notificationService.findAll(userId, query);
  }

  @Get('meta/unread-count')
  getUnreadCount(@CurrentUser('sub') userId: string) {
    return this.notificationService.getUnreadCount(userId);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser('sub') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.findOne(userId, id);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.markAsRead(userId, id);
  }
}
