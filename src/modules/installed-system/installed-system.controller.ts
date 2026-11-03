import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { InstalledSystemService } from './installed-system.service';
import { CreateInstalledSystemDto, ReadingDto, ReminderActionDto } from './dto/installed-system.dto';

/** Montajdan keyingi kabinet (TZ 9.10: GET/POST /installed-systems, POST .../readings) — faqat egasi. */
@Controller('installed-systems')
export class InstalledSystemController {
  constructor(private readonly service: InstalledSystemService) {}

  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.service.list(userId);
  }

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateInstalledSystemDto) {
    return this.service.create(userId, dto);
  }

  @Get(':id')
  get(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(userId, id);
  }

  @Delete(':id')
  archive(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(userId, id);
  }

  @Post(':id/readings')
  reading(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReadingDto) {
    return this.service.addReading(userId, id, dto);
  }

  @Patch(':id/reminders/:reminderId')
  reminder(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Param('reminderId', ParseUUIDPipe) reminderId: string, @Body() dto: ReminderActionDto) {
    return this.service.reminderAction(userId, id, reminderId, dto);
  }
}
