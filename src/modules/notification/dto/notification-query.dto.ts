import { IsEnum, IsOptional } from 'class-validator';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class NotificationQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;
}
