import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';

@Module({ imports: [MailModule], controllers: [OtpController], providers: [OtpService], exports: [OtpService] })
export class OtpModule {}
