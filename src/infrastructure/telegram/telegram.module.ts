import { Global, Module } from '@nestjs/common';
import { TelegramAlertService } from './telegram-alert.service';

@Global()
@Module({
  providers: [TelegramAlertService],
  exports: [TelegramAlertService],
})
export class TelegramModule {}
