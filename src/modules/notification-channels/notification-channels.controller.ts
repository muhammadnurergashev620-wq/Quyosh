import { Body, Controller, Get, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationChannelsService } from './notification-channels.service';

class PreferenceDto {
  @IsString() @MaxLength(60) type!: string;
  @IsArray() @ArrayMaxSize(2) @IsIn(['SMS', 'EMAIL'], { each: true }) channels!: string[];
}

@Controller('me/notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationChannelsService) {}

  @Get()
  get(@CurrentUser('sub') userId: string) {
    return this.service.preferences(userId);
  }

  @Put()
  set(@CurrentUser('sub') userId: string, @Body() dto: PreferenceDto) {
    return this.service.setPreference(userId, dto.type, dto.channels);
  }
}
