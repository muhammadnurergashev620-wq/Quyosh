import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ESKIZ_BASE = 'https://notify.eskiz.uz/api';
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000; // Eskiz tokeni ~30 kun amal qiladi

/**
 * SMS yuborish (Eskiz.uz). `ESKIZ_EMAIL` va `ESKIZ_PASSWORD` berilmasa — o‘chirilgan (`isEnabled() === false`),
 * shunda kod faqat email orqali yuboriladi va interfeysda SMS tugmasi ko‘rsatilmaydi.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  private get email(): string {
    return this.config.get<string>('ESKIZ_EMAIL') ?? process.env.ESKIZ_EMAIL ?? '';
  }
  private get password(): string {
    return this.config.get<string>('ESKIZ_PASSWORD') ?? process.env.ESKIZ_PASSWORD ?? '';
  }
  private get sender(): string {
    return this.config.get<string>('ESKIZ_FROM') ?? process.env.ESKIZ_FROM ?? '4546';
  }

  isEnabled(): boolean {
    return !!this.email && !!this.password;
  }

  private async authToken(force = false): Promise<string> {
    if (!force && this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const form = new FormData();
    form.set('email', this.email);
    form.set('password', this.password);
    const response = await fetch(`${ESKIZ_BASE}/auth/login`, { method: 'POST', body: form, signal: AbortSignal.timeout(10_000) });
    const body = (await response.json().catch(() => ({}))) as { data?: { token?: string } };
    const value = body.data?.token;
    if (!response.ok || !value) throw new Error(`Eskiz kirishi muvaffaqiyatsiz (${response.status})`);
    this.token = { value, expiresAt: Date.now() + TOKEN_TTL_MS };
    return value;
  }

  /** `phone` — +998901234567 ko‘rinishida; Eskiz «998901234567» kutadi. */
  async send(phone: string, text: string): Promise<void> {
    if (!this.isEnabled()) throw new Error('SMS xizmati sozlanmagan');
    const mobile = phone.replace(/\D/g, '');
    const post = async (token: string) => {
      const form = new FormData();
      form.set('mobile_phone', mobile);
      form.set('message', text);
      form.set('from', this.sender);
      return fetch(`${ESKIZ_BASE}/message/sms/send`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.timeout(10_000) });
    };
    let response = await post(await this.authToken());
    if (response.status === 401) response = await post(await this.authToken(true));
    if (!response.ok) {
      this.logger.error(`SMS yuborilmadi (${response.status})`);
      throw new Error(`SMS yuborilmadi (${response.status})`);
    }
  }
}
