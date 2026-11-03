import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import { MailProvider } from '../../infrastructure/mail/mail.provider';
import { ERRORS, SUCCESS } from '../../common/constants/error-messages';
import { SendMailDto } from './dto/send-mail.dto';

const PURPOSE_LABEL: Record<OtpPurpose, string> = {
  REGISTER: "ro'yxatdan o'tishni tasdiqlash",
  LOGIN: "tizimga kirish",
  PHONE_VERIFICATION: "telefon raqamini tasdiqlash",
  PASSWORD_RESET: "parolni tiklash",
  CHANGE_PHONE: "telefon raqamini almashtirish",
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly provider: MailProvider) {}

  isEnabled(): boolean {
    return this.provider.isConfigured();
  }

  async sendVerificationCode(to: string, code: string, purpose: OtpPurpose, ttlMinutes: number): Promise<void> {
    const label = PURPOSE_LABEL[purpose];
    await this.provider.sendMail({
      to,
      subject: 'Quyosh tasdiqlash kodi',
      text: `Quyosh: ${label} uchun tasdiqlash kodingiz: ${code}. Kod ${ttlMinutes} daqiqa amal qiladi. Kodni hech kimga bermang.`,
    });
    this.logger.log(`${purpose} uchun tasdiqlash xati navbatga qo'yildi`);
  }

  async send(dto: SendMailDto) {
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException(ERRORS.MAIL_NOT_CONFIGURED);
    }
    await this.provider.sendMail({ to: dto.to, subject: dto.subject, text: dto.text });
    return { message: SUCCESS.MAIL_SENT };
  }
}
