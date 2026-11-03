import { Module } from '@nestjs/common';
import { MailProviderModule } from '../../infrastructure/mail/mail.module';
import { MailService } from './mail.service';

/** Xat yuborish faqat ichki servislar orqali (tasdiqlash kodlari, bildirishnomalar); ochiq «istalgan xat» endpointi yo‘q. */
@Module({
  imports: [MailProviderModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
