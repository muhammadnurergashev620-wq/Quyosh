import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose, OtpStatus } from '@prisma/client';
import { hashSecret, verifySecret } from '../../common/security/hash';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TooManyRequestsException } from '../../common/exceptions/business.exception';
import { MailService } from '../mail/mail.service';
import { ERRORS } from '../../common/constants/error-messages';

const OTP_PURPOSE_LABEL: Record<OtpPurpose, string> = {
  REGISTER: 'Ro‘yxatdan o‘tish',
  LOGIN: 'Tizimga kirish',
  PHONE_VERIFICATION: 'Telefonni tasdiqlash',
  PASSWORD_RESET: 'Parolni tiklash',
  CHANGE_PHONE: 'Telefonni almashtirish',
};

import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { TelegramAlertService } from '../../infrastructure/telegram/telegram-alert.service';
import { SmsService } from '../../infrastructure/sms/sms.service';

/** 6 xonali kod 5 daqiqada eskiradi va 5 urinish bilan cheklangan — shu sabab xesh narxi parolnikidan past (tezroq javob). */
const OTP_HASH_COST = 10;

let dummyOtpHash: Promise<string> | undefined;
/** Faol kod topilmaganda xuddi shuncha vaqt sarflash uchun (hech qachon mos kelmaydigan xesh). */
const dummyHash = (): Promise<string> => (dummyOtpHash ??= hashSecret(randomInt(100000, 1_000_000).toString(), OTP_HASH_COST));

type DeliveryRoute = { kind: 'EMAIL'; email: string; phone: string } | { kind: 'SMS'; phone: string } | { kind: 'NONE' };

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    private readonly telegram: TelegramAlertService,
    private readonly redis: RedisService,
    private readonly sms: SmsService,
  ) {}

  private get ttlMs(): number {
    return this.config.getOrThrow<number>('limits.otp.ttlSeconds') * 1000;
  }
  private get resendMs(): number {
    return this.config.getOrThrow<number>('limits.otp.resendSeconds') * 1000;
  }
  private get windowMs(): number {
    return this.config.getOrThrow<number>('limits.otp.windowSeconds') * 1000;
  }
  private get maxRequests(): number {
    return this.config.getOrThrow<number>('limits.otp.maxRequestsPerWindow');
  }
  private get ipMultiplier(): number {
    return this.config.getOrThrow<number>('limits.otp.ipMultiplier');
  }
  private get maxAttempts(): number {
    return this.config.getOrThrow<number>('limits.otp.maxAttempts');
  }

  /**
   * Faol (muddati o‘tmagan) kod bor va qayta yuborish oynasi hali ochilmagan bo‘lsa — qolgan soniyalar, aks holda 0.
   * Kirishda «Yangi kod so‘rashdan oldin N soniya kuting» xatosi o‘rniga, oldingi kod bilan davom etish uchun.
   */
  async pendingResendWait(phoneInput: string, purpose: OtpPurpose, panel: string | null): Promise<number> {
    const phone = this.normalizePhone(phoneInput);
    const now = new Date();
    const last = await this.db.otpCode.findFirst({
      where: { phone, purpose, panel, status: OtpStatus.ACTIVE, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!last) return 0;
    return Math.max(0, Math.ceil((this.resendMs - (now.getTime() - last.createdAt.getTime())) / 1000));
  }

  async issue(
    phoneInput: string,
    purpose: OtpPurpose,
    userId?: string,
    context?: { ip?: string; device?: string; panel?: string | null; resend?: boolean; channel?: 'SMS'; reveal?: boolean },
  ) {
    const phone = this.normalizePhone(phoneInput);
    const panel = context?.panel ?? null;
    const now = new Date();
    // Kod qayerga yuboriladi: standart — email (bo‘lsa), SMS — foydalanuvchi so‘raganda (yoki email bo‘lmasa va SMS ulangan bo‘lsa).
    const route = await this.resolveRoute(phone, context?.channel);
    // Kod va uning xeshi oldindan, tekshiruvlar bilan parallel tayyorlanadi (kutish vaqti qisqaradi).
    const code = randomInt(100000, 1_000_000).toString();
    const codeHashPromise = hashSecret(code, OTP_HASH_COST);
    codeHashPromise.catch(() => undefined);
    const windowStart = new Date(now.getTime() - this.windowMs);
    const resendStart = new Date(now.getTime() - this.resendMs);

    const [recentPhone, lastPhone] = await Promise.all([
      this.db.otpCode.count({
        where: {
          phone,
          purpose,
          panel,
          createdAt: { gte: windowStart },
        },
      }),
      this.db.otpCode.findFirst({
        where: {
          phone,
          purpose,
          panel,
          createdAt: { gte: resendStart },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    if (recentPhone >= this.maxRequests) {
      this.metrics.otpAbused('phone_limit');
      const oldest = await this.db.otpCode.findFirst({
        where: { phone, purpose, panel, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      const waitMs = oldest ? oldest.createdAt.getTime() + this.windowMs - now.getTime() : 0;
      throw new TooManyRequestsException(
        waitMs > 0 ? ERRORS.OTP_LIMIT_WAIT(Math.max(1, Math.ceil(waitMs / 60_000))) : ERRORS.OTP_LIMIT_EXCEEDED,
      );
    }

    // Email → SMS almashtirish: oynada bir marta kutmasdan ruxsat (umumiy so‘rovlar limiti baribir amal qiladi).
    const smsSwitch = !!lastPhone && context?.channel === 'SMS' && (await this.redis.setIfAbsent(`otpsms:${purpose}:${phone}`, '1', Math.ceil(this.windowMs / 1000)));

    if (lastPhone && !smsSwitch) {
      const remaining = Math.ceil(
        (this.resendMs - (now.getTime() - lastPhone.createdAt.getTime())) /
          1000,
      );
      if (remaining > 0) {
        this.metrics.otpAbused('resend_too_soon');
        throw new TooManyRequestsException(
          ERRORS.OTP_WAIT(remaining),
        );
      }
    }

    if (context?.ip) {
      const recentIp = await this.db.otpCode.count({
        where: {
          ipAddress: context.ip.slice(0, 64),
          purpose,
          panel,
          createdAt: { gte: windowStart },
        },
      });
      if (recentIp >= this.maxRequests * this.ipMultiplier) {
        this.metrics.otpAbused('ip_limit');
        throw new TooManyRequestsException(ERRORS.OTP_LIMIT_EXCEEDED);
      }
    }

    await this.db.otpCode.updateMany({
      where: {
        phone,
        purpose,
        status: OtpStatus.ACTIVE,
      },
      data: { status: OtpStatus.EXPIRED },
    });

    const codeHash = await codeHashPromise;

    await this.db.otpCode.create({
      data: {
        phone,
        userId,
        codeHash,
        purpose,
        status: OtpStatus.ACTIVE,
        attempts: 0,
        maxAttempts: this.maxAttempts,
        expiresAt: new Date(now.getTime() + this.ttlMs),
        ipAddress: context?.ip?.slice(0, 64),
        panel,
      },
    });

    await this.redis.del(this.failKey(phone, purpose));

    // Yetkazish (Telegram/email) javobni kechiktirmaydi: fonda bajariladi, xato logga yoziladi.
    void this.deliver(route, phone, code, purpose, context?.resend === true).catch((error: unknown) => this.logger.error(`${purpose} kodini yuborishda xato: ${(error as Error).message}`));

    const metadata = {
      verificationRequired: true,
      expiresIn: this.ttlMs / 1000,
      resendAfter: this.resendMs / 1000,
      // Faqat parol tekshirilgan (kirish) holatda: kod qayerga yuborilgani. Ochiq so‘rovda email bor-yo‘qligi oshkor qilinmaydi.
      ...(context?.reveal ? { delivery: this.publicRoute(route), smsAvailable: this.sms.isEnabled() } : {}),
    };
    if (this.config.get<string>('app.environment') !== 'production' && process.env.OTP_DEV_ECHO === 'true') {
      return { ...metadata, developmentCode: code };
    }
    return metadata;
  }

  private maskEmail(email: string): string {
    return email.replace(/^(.{2})[^@]*(@.*)$/, '$1•••$2');
  }

  private maskPhone(phone: string): string {
    return phone.replace(/^(\+\d{3})\d+(\d{2})$/, '$1 •• ••• •• $2');
  }

  private publicRoute(route: DeliveryRoute): { channel: 'EMAIL' | 'SMS' | 'NONE'; destination?: string } {
    if (route.kind === 'EMAIL') return { channel: 'EMAIL', destination: this.maskEmail(route.email) };
    if (route.kind === 'SMS') return { channel: 'SMS', destination: this.maskPhone(route.phone) };
    return { channel: 'NONE' };
  }

  /**
   * Kod yo‘nalishi. Standart — foydalanuvchi emaili (bo‘lsa va pochta sozlangan bo‘lsa).
   * SMS: foydalanuvchi so‘raganda yoki emaili bo‘lmasa (SMS xizmati ulangan bo‘lsa). SMS ulanmagan holda so‘ralsa — xato.
   */
  private async resolveRoute(phone: string, requested?: 'SMS'): Promise<DeliveryRoute> {
    if (requested === 'SMS') {
      if (!this.sms.isEnabled()) throw new BadRequestException(ERRORS.SMS_NOT_AVAILABLE);
      return { kind: 'SMS', phone };
    }
    const user = await this.db.user.findUnique({ where: { phone }, select: { email: true } });
    if (user?.email && this.mail.isEnabled()) return { kind: 'EMAIL', email: user.email, phone };
    if (this.sms.isEnabled()) return { kind: 'SMS', phone };
    return { kind: 'NONE' };
  }

  /** Yetkazish: tanlangan yo‘nalish bo‘yicha. Email yuborilmasa va SMS ulangan bo‘lsa — kod SMS orqali jo‘natiladi. Telegram OTP chat — ichki (operator) nusxa. */
  private async deliver(route: DeliveryRoute, phone: string, code: string, purpose: OtpPurpose, resend = false): Promise<void> {
    const purposeLabel = resend ? `${OTP_PURPOSE_LABEL[purpose]} (kod qayta yuborildi)` : OTP_PURPOSE_LABEL[purpose];
    const ttlMinutes = this.ttlMs / 60_000;
    const telegramCopy = this.telegram.sendOtp({ phone, code, purposeLabel, ttlMinutes });
    let sent = false;
    if (route.kind === 'EMAIL') {
      try {
        await this.mail.sendVerificationCode(route.email, code, purpose, ttlMinutes);
        sent = true;
      } catch (error) {
        this.logger.error(`${purpose} uchun OTP emailga yuborib bo‘lmadi: ${(error as Error).message}`);
        if (this.sms.isEnabled()) route = { kind: 'SMS', phone };
      }
    }
    if (route.kind === 'SMS') {
      try {
        await this.sms.send(phone, `Quyosh: tasdiqlash kodi ${code}. Kod ${Math.round(ttlMinutes)} daqiqa amal qiladi. Uni hech kimga bermang.`);
        sent = true;
      } catch (error) {
        this.logger.error(`${purpose} uchun OTP SMS yuborib bo‘lmadi: ${(error as Error).message}`);
      }
    }
    const operatorCopy = await telegramCopy;
    if (!sent && !operatorCopy) {
      this.logger.warn(`${purpose} kodini yuborish uchun kanal yo‘q (email/SMTP, SMS va Telegram sozlanmagan)`);
    }
  }

  private failKey(phone: string, purpose: OtpPurpose): string {
    return `otpfail:${purpose}:${phone}`;
  }

  /**
   * Kodni tekshirish. Xato urinishlar soni telefon bo‘yicha YAGONA hisoblanadi (raqam bazada bor-yo‘qligidan qat’i nazar):
   * mavjud va mavjud bo‘lmagan raqamlar bir xil javob (400, so‘ng 429) va bir xil vaqt oladi — raqamlarni aniqlab bo‘lmaydi.
   */
  async verify(phoneInput: string, purpose: OtpPurpose, code: string) {
    const phone = this.normalizePhone(phoneInput);
    const key = this.failKey(phone, purpose);
    const max = this.maxAttempts;
    if (Number((await this.redis.get(key)) ?? 0) >= max) {
      this.metrics.otpAbused('attempts_exceeded');
      throw new TooManyRequestsException(ERRORS.VERIFICATION_ATTEMPTS_EXCEEDED);
    }
    try {
      const result = await this.verifyRecord(phone, purpose, code);
      await this.redis.del(key);
      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof TooManyRequestsException) {
        const limit = 1_000_000;
        const { remaining } = await this.redis.consume(key, limit, Math.ceil(this.ttlMs / 1000));
        if (error instanceof TooManyRequestsException || limit - remaining >= max) {
          this.metrics.otpAbused('attempts_exceeded');
          throw new TooManyRequestsException(ERRORS.VERIFICATION_ATTEMPTS_EXCEEDED);
        }
        throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
      }
      throw error;
    }
  }

  private async verifyRecord(phone: string, purpose: OtpPurpose, code: string) {
    const record = await this.db.otpCode.findFirst({
      where: {
        phone,
        purpose,
        status: OtpStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      await verifySecret(code, await dummyHash()); // vaqt farqi bilinmasligi uchun
      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
    }

    if (record.expiresAt <= new Date()) {
      await verifySecret(code, await dummyHash());
      await this.db.otpCode.updateMany({
        where: { id: record.id, status: OtpStatus.ACTIVE },
        data: { status: OtpStatus.EXPIRED },
      });
      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
    }

    if (record.attempts >= record.maxAttempts) {
      await this.db.otpCode.updateMany({
        where: { id: record.id, status: OtpStatus.ACTIVE },
        data: { status: OtpStatus.BLOCKED },
      });
      {
        this.metrics.otpAbused('attempts_exceeded');
        throw new TooManyRequestsException(ERRORS.VERIFICATION_ATTEMPTS_EXCEEDED);
      }
    }

    const valid = await verifySecret(code, record.codeHash);

    if (!valid) {
      const update = await this.db.otpCode.updateMany({
        where: {
          id: record.id,
          status: OtpStatus.ACTIVE,
          attempts: { lt: record.maxAttempts },
        },
        data: { attempts: { increment: 1 } },
      });

      if (update.count === 0) {
        {
        this.metrics.otpAbused('attempts_exceeded');
        throw new TooManyRequestsException(ERRORS.VERIFICATION_ATTEMPTS_EXCEEDED);
      }
      }

      if (record.attempts + 1 >= record.maxAttempts) {
        await this.db.otpCode.updateMany({
          where: { id: record.id, status: OtpStatus.ACTIVE },
          data: { status: OtpStatus.BLOCKED },
        });
        {
        this.metrics.otpAbused('attempts_exceeded');
        throw new TooManyRequestsException(ERRORS.VERIFICATION_ATTEMPTS_EXCEEDED);
      }
      }

      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
    }

    const verified = await this.db.otpCode.updateMany({
      where: {
        id: record.id,
        status: OtpStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: OtpStatus.VERIFIED,
        verifiedAt: new Date(),
      },
    });

    if (verified.count !== 1) {
      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
    }

    return true;
  }

  normalizePhone(value: string) {
    const digits = value.replace(/\D/g, '');
    if (!/^998\d{9}$/.test(digits)) {
      throw new BadRequestException(ERRORS.INVALID_PHONE);
    }
    return `+${digits}`;
  }
}
