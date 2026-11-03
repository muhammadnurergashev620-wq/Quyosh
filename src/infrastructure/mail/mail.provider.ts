import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { ERRORS } from '../../common/constants/error-messages';

export interface SendMailInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class MailProvider implements OnModuleInit {
  private readonly logger = new Logger(MailProvider.name);
  private transporter: Transporter | null = null;
  private from = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('mail.host', '');
    this.from = this.config.get<string>('mail.from', '');
    if (!host) {
      this.logger.warn('SMTP_HOST sozlanmagan — email yuborish O‘CHIRILGAN (sendMail xatolik qaytaradi).');
      return;
    }
    const port = this.config.get<number>('mail.port', 587);
    const user = this.config.get<string>('mail.user', '');
    const pass = this.config.get<string>('mail.password', '');
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      ...(user ? { auth: { user, pass } } : {}),
    });
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendMail(input: SendMailInput): Promise<void> {
    if (!this.transporter) throw new Error(ERRORS.MAIL_NOT_CONFIGURED);
    try {
      await this.transporter.sendMail({ from: this.from, ...input });
    } catch (error) {
      this.logger.error(`${input.to} manziliga xat yuborib bo‘lmadi: ${(error as Error).message}`);
      throw error;
    }
  }
}
