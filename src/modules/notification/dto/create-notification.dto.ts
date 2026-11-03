import { IsUUID } from '../../../common/validators/any-uuid';
import { NotificationChannel } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNotificationDto {
  @IsUUID()
  userId!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  template?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
