import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { zipSingle } from '../../common/utils/zip';
import { ConfigService } from '@nestjs/config';
import { describeDevice, isPrivateIp, lookupIpLocation } from '../../common/utils/geo-ip';

export interface ErrorAlert {
  status: number;
  code: string;
  message: string;
  method?: string;
  path?: string;
  requestId?: string | null;
  stack?: string;
}

const MAX_ATTEMPTS = 3;
const MAX_MESSAGE_LENGTH = 3800;
const MAX_STACK_LINES = 6;
const MAX_TRACKED_KEYS = 500;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

@Injectable()
export class TelegramAlertService implements OnModuleInit {
  private readonly logger = new Logger(TelegramAlertService.name);
  private botToken = '';
  private chatId = '';
  private otpChatId = '';
  private otpThreadId: number | undefined;
  private credentialsChatId = '';
  private credentialsThreadId: number | undefined;
  private securityThreadId: number | undefined;
  private sessionsThreadId: number | undefined;
  private alertsThreadId: number | undefined;
  private blockedChatIds = new Set<string>();
  private minStatus = 500;
  private dedupeWindowMs = 300_000;
  private timeoutMs = 8_000;
  private retryDelayMs = 800;
  private environment = 'development';
  private appName = 'Quyosh';
  private readonly lastSent = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.botToken = this.config.get<string>('telegram.botToken', '');
    this.chatId = this.config.get<string>('telegram.chatId', '');
    this.otpChatId = this.config.get<string>('telegram.otpChatId', '');
    this.otpThreadId = this.config.get<number | undefined>('telegram.otpThreadId', undefined);
    this.credentialsChatId = this.config.get<string>('telegram.credentialsChatId', '');
    this.credentialsThreadId = this.config.get<number | undefined>('telegram.credentialsThreadId', undefined);
    this.securityThreadId = this.config.get<number | undefined>('telegram.securityThreadId', undefined);
    this.sessionsThreadId = this.config.get<number | undefined>('telegram.sessionsThreadId', undefined);
    this.alertsThreadId = this.config.get<number | undefined>('telegram.alertsThreadId', undefined);
    this.blockedChatIds = new Set(this.config.get<string[]>('telegram.blockedChatIds', []));
    this.minStatus = this.config.get<number>('telegram.minStatus', 500);
    this.dedupeWindowMs = this.config.get<number>('telegram.dedupeWindowMs', 300_000);
    this.timeoutMs = this.config.get<number>('telegram.timeoutMs', 8_000);
    this.retryDelayMs = this.config.get<number>('telegram.retryDelayMs', 800);
    this.environment = this.config.get<string>('app.environment', 'development');
    this.appName = this.config.get<string>('app.name', 'Quyosh');
    if (!this.isEnabled()) {
      this.logger.warn('TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID sozlanmagan — Telegram xato xabarlari O‘CHIRILGAN.');
    }
    if (!this.isOtpEnabled()) {
      this.logger.warn('TELEGRAM_BOT_TOKEN/TELEGRAM_OTP_CHAT_ID sozlanmagan — OTP kodlar Telegram’ga YUBORILMAYDI.');
    }
  }

  isOtpEnabled(): boolean {
    return !!this.botToken && !!this.otpChatId;
  }

  async sendOtp(input: { phone: string; code: string; purposeLabel: string; ttlMinutes: number }): Promise<boolean> {
    if (!this.isOtpEnabled()) return false;
    const text = [
      `🔐 <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — ${escapeHtml(input.purposeLabel)}`,
      `Telefon: <code>${escapeHtml(input.phone)}</code>`,
      `Kod: <code>${escapeHtml(input.code)}</code>`,
      `Amal qilish muddati: ${input.ttlMinutes} daqiqa`,
    ].join('\n');
    return this.post(this.otpChatId, text, `OTP (${input.purposeLabel})`, this.otpThreadId);
  }

  /**
   * Yangi foydalanuvchining login va paroli — FAQAT yopiq (superadmin) guruhga. Parol bazada baribir faqat bcrypt xesh sifatida saqlanadi.
   * Xabar matni hech qayerda loglanmaydi (post() faqat yorliqni yozadi).
   */
  notifyNewCredentials(input: { phone: string; name: string; password: string; role?: string }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    const text = [
      `🔐 <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — yangi hisob (kod tasdiqlanishi kutilmoqda)`,
      `Akkaunt roli: <b>${escapeHtml(input.role ?? 'Mijoz')}</b>`,
      `Ism familiya: ${input.name ? escapeHtml(input.name) : '—'}`,
      `Login: <code>${escapeHtml(input.phone)}</code>`,
      `Parol: <code>${escapeHtml(input.password)}</code>`,
      '⚠️ Maxfiy ma’lumot — faqat superadmin uchun.',
    ]
      .filter((line): line is string => !!line)
      .join('\n');
    void this.post(this.credentialsChatId, text, 'yangi hisob ma’lumotlari', this.credentialsThreadId);
  }

  /** Superadmin yangi admin yaratganda: kim yaratdi, yangi admin ma’lumotlari va login/parol — yopiq (login-parol) guruhga. */
  notifyAdminCreated(input: { creatorName: string; creatorAccount: number; adminName: string; adminAccount: number; isSuperAdmin: boolean; permissions?: string[]; phone: string; password: string; ip?: string | null }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    const text = [
      `👤 <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — yangi admin yaratildi`,
      `Kim yaratdi: <b>${escapeHtml(input.creatorName || '—')}</b> (ID ${input.creatorAccount})`,
      `Yangi admin: <b>${escapeHtml(input.adminName || '—')}</b> (ID ${input.adminAccount})`,
      `Roli: <b>${input.isSuperAdmin ? 'Superadmin' : 'Admin'}</b>`,
      !input.isSuperAdmin && input.permissions?.length ? `Ruxsat berilgan bo‘limlar: ${escapeHtml(input.permissions.join(', '))}` : undefined,
      `Login: <code>${escapeHtml(input.phone)}</code>`,
      `Parol: <code>${escapeHtml(input.password)}</code>`,
      input.ip ? `IP: <code>${escapeHtml(input.ip)}</code>` : undefined,
      `Vaqt: ${escapeHtml(new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }))}`,
      '⚠️ Maxfiy ma’lumot — faqat superadmin uchun.',
    ]
      .filter((line): line is string => !!line)
      .join('\n');
    void this.post(this.credentialsChatId, text, 'yangi admin yaratildi', this.credentialsThreadId);
  }

  /**
   * Admin foydalanuvchi parolini o‘zgartirganda: kim, kimning, qachon, sababi va yangi login/parol — yopiq guruhga.
   * Parol bazada baribir faqat bcrypt xesh sifatida saqlanadi; matn hech qayerda loglanmaydi.
   */
  notifyPasswordChanged(input: {
    adminName: string;
    adminAccount: number;
    userName: string;
    userAccount: number;
    userRole: string;
    login: string;
    password: string;
    reason?: string | null;
    ip?: string | null;
  }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    const text = [
      `🔑 <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — admin foydalanuvchi parolini o‘zgartirdi`,
      `Kim o‘zgartirdi: <b>${escapeHtml(input.adminName || '—')}</b> (ID ${input.adminAccount})`,
      `Akkaunt: <b>${escapeHtml(input.userName || '—')}</b> (ID ${input.userAccount}), roli: <b>${escapeHtml(input.userRole)}</b>`,
      `Login: <code>${escapeHtml(input.login)}</code>`,
      `Yangi parol: <code>${escapeHtml(input.password)}</code>`,
      input.reason ? `Sabab: ${escapeHtml(input.reason)}` : undefined,
      input.ip ? `IP: <code>${escapeHtml(input.ip)}</code>` : undefined,
      `Vaqt: ${escapeHtml(new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }))}`,
      '⚠️ Maxfiy ma’lumot — faqat superadmin uchun. Foydalanuvchi barcha qurilmalardan chiqarildi.',
    ]
      .filter((line): line is string => !!line)
      .join('\n');
    void this.post(this.credentialsChatId, text, 'parol o‘zgartirildi', this.credentialsThreadId);
  }

  /**
   * Mavjud telefon/email bilan yangi hisob ochishga urinish haqida adminga xabar (yopiq guruh). Urinishda yozilgan parol yuborilmaydi.
   * Bir xil raqam+IP uchun takroriy xabarlar `dedupeWindowMs` davomida bostiriladi.
   */
  notifyDuplicateRegistration(input: {
    reason: 'phone' | 'email';
    phone: string;
    email?: string | null;
    name: string;
    ip?: string | null;
    panel?: string | null;
    userAgent?: string | null;
    /** Qurilma GPS si (foydalanuvchi ruxsat bergan bo‘lsa). */
    location?: { latitude: number; longitude: number; accuracy?: number } | null;
  }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    if (!this.shouldSend(`dup:${input.reason}:${input.phone}:${input.ip ?? ''}`)) return;
    void this.sendDuplicateRegistration(input);
  }

  private async sendDuplicateRegistration(input: Parameters<TelegramAlertService['notifyDuplicateRegistration']>[0]): Promise<void> {
    const gps = input.location ?? null;
    const location = input.ip ? await lookupIpLocation(input.ip) : null;
    const where = location
      ? [location.city, location.region, location.country].filter(Boolean).join(', ')
      : input.ip && isPrivateIp(input.ip)
        ? 'lokal tarmoq (joylashuvni aniqlab bo‘lmaydi)'
        : 'aniqlanmadi';
    const ipMap = location && (location.latitude || location.longitude) ? `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=11/${location.latitude}/${location.longitude}` : null;
    const gpsMap = gps ? `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}` : null;
    const locationLine = gps
      ? `📍 Aniq joylashuv (qurilma GPS, foydalanuvchi ruxsati bilan): <a href="${gpsMap}">${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}</a>${gps.accuracy ? ` (±${Math.round(gps.accuracy)} m)` : ''}`
      : `Joylashuv (taxminiy, IP bo‘yicha): ${escapeHtml(where)}${ipMap ? ` — <a href="${ipMap}">xaritada</a>` : ''}`;
    const time = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tashkent', hour12: false });
    const block = (lines: Array<string | undefined>) => lines.filter((line): line is string => !!line).join('\n');
    const text = [
      `⚠️ <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — mavjud ma’lumot bilan ro‘yxatdan o‘tishga urinish`,
      `Sabab: ${input.reason === 'phone' ? 'Telefon raqami allaqachon ro‘yxatdan o‘tgan' : 'Email allaqachon ro‘yxatdan o‘tgan'}`,
      block([
        `Telefon: <code>${escapeHtml(input.phone)}</code>`,
        input.email ? `Email: <code>${escapeHtml(input.email)}</code>` : undefined,
        `Kiritilgan ism: ${input.name ? escapeHtml(input.name) : '—'}`,
        `Qurilma: ${escapeHtml(describeDevice(input.userAgent))}${input.panel ? ` (panel: ${escapeHtml(input.panel)})` : ''}`,
      ]),
      block([
        `IP manzil: <code>${escapeHtml(input.ip ?? 'noma’lum')}</code>`,
        locationLine,
        gps && where !== 'aniqlanmadi' ? `IP bo‘yicha taxminiy joy: ${escapeHtml(where)}` : undefined,
        location?.provider ? `Internet provayder: ${escapeHtml(location.provider)}` : undefined,
      ]),
      `Vaqt: ${escapeHtml(time)}`,
      'Foydalanuvchiga hech narsa bildirilmadi (raqam mavjudligi sir saqlanadi); hisob ochilmadi.',
    ].join('\n\n');
    await this.post(this.credentialsChatId, text, 'takroriy ro‘yxatdan o‘tish urinishi', this.securityThreadId ?? this.credentialsThreadId);
  }

  /** Foydalanuvchi tizimga kirdi / chiqdi (yopiq guruhga). Parol yoki tokenlar bu xabarda hech qachon bo‘lmaydi. */
  notifySession(input: {
    event: 'login' | 'logout' | 'logout-all';
    name: string;
    accountNumber: number;
    roles: string;
    login: string;
    ip?: string | null;
    panel?: string | null;
    userAgent?: string | null;
  }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    void this.sendSession(input);
  }

  private async sendSession(input: Parameters<TelegramAlertService['notifySession']>[0]): Promise<void> {
    const location = input.ip ? await lookupIpLocation(input.ip) : null;
    const where = location
      ? [location.city, location.region, location.country].filter(Boolean).join(', ')
      : input.ip && isPrivateIp(input.ip)
        ? 'lokal tarmoq (joylashuvni aniqlab bo‘lmaydi)'
        : 'aniqlanmadi';
    const map = location && (location.latitude || location.longitude) ? ` — <a href="https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=11/${location.latitude}/${location.longitude}">xaritada</a>` : '';
    const title =
      input.event === 'login'
        ? '🟢 foydalanuvchi tizimga kirdi'
        : input.event === 'logout'
          ? '🔴 foydalanuvchi tizimdan chiqdi'
          : '🔴 foydalanuvchi barcha qurilmalardan chiqdi';
    const time = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tashkent', hour12: false });
    const block = (lines: Array<string | undefined>) => lines.filter((line): line is string => !!line).join('\n');
    const text = [
      `<b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — ${title}`,
      block([
        `Foydalanuvchi: <b>${escapeHtml(input.name || '—')}</b> (ID ${input.accountNumber})`,
        `Akkaunt roli: <b>${escapeHtml(input.roles)}</b>`,
        `Login: <code>${escapeHtml(input.login)}</code>`,
      ]),
      `Qurilma: ${escapeHtml(describeDevice(input.userAgent))}${input.panel ? ` (panel: ${escapeHtml(input.panel)})` : ''}`,
      block([
        `IP manzil: <code>${escapeHtml(input.ip ?? 'noma’lum')}</code>`,
        `Joylashuv (taxminiy, IP bo‘yicha): ${escapeHtml(where)}${map}`,
        location?.provider ? `Internet provayder: ${escapeHtml(location.provider)}` : undefined,
      ]),
      `Vaqt: ${escapeHtml(time)}`,
    ].join('\n\n');
    await this.post(this.credentialsChatId, text, `kirish/chiqish (${input.event})`, this.sessionsThreadId ?? this.credentialsThreadId);
  }

  /**
   * Autentifikatsiya bilan bog‘liq ogohlantirish (yopiq guruh, xavfsizlik mavzusi): masalan, ro‘yxatdan o‘tmagan raqamga
   * kirishga urinish yoki ro‘yxatdan o‘tish kodini qayta yuborish. Parol hech qachon yuborilmaydi.
   * Bir xil kalit (`dedupeKey`) uchun takroriy xabarlar `dedupeWindowMs` davomida bostiriladi.
   */
  notifyAuthWarning(input: {
    title: string;
    reason: string;
    note?: string;
    phone: string;
    ip?: string | null;
    panel?: string | null;
    userAgent?: string | null;
    dedupeKey?: string;
  }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    if (input.dedupeKey && !this.shouldSend(`warn:${input.dedupeKey}`)) return;
    void this.sendAuthWarning(input);
  }

  private async sendAuthWarning(input: Parameters<TelegramAlertService['notifyAuthWarning']>[0]): Promise<void> {
    const location = input.ip ? await lookupIpLocation(input.ip) : null;
    const where = location
      ? [location.city, location.region, location.country].filter(Boolean).join(', ')
      : input.ip && isPrivateIp(input.ip)
        ? 'lokal tarmoq (joylashuvni aniqlab bo‘lmaydi)'
        : 'aniqlanmadi';
    const map = location && (location.latitude || location.longitude) ? ` — <a href="https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=11/${location.latitude}/${location.longitude}">xaritada</a>` : '';
    const time = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tashkent', hour12: false });
    const block = (lines: Array<string | undefined>) => lines.filter((line): line is string => !!line).join('\n');
    const text = [
      `⚠️ <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — ${escapeHtml(input.title)}`,
      `Sabab: ${escapeHtml(input.reason)}`,
      block([`Telefon: <code>${escapeHtml(input.phone)}</code>`, `Qurilma: ${escapeHtml(describeDevice(input.userAgent))}${input.panel ? ` (panel: ${escapeHtml(input.panel)})` : ''}`]),
      block([
        `IP manzil: <code>${escapeHtml(input.ip ?? 'noma’lum')}</code>`,
        `Joylashuv (taxminiy, IP bo‘yicha): ${escapeHtml(where)}${map}`,
        location?.provider ? `Internet provayder: ${escapeHtml(location.provider)}` : undefined,
      ]),
      `Vaqt: ${escapeHtml(time)}`,
      input.note ? escapeHtml(input.note) : undefined,
    ]
      .filter((part): part is string => !!part)
      .join('\n\n');
    await this.post(this.credentialsChatId, text, 'autentifikatsiya ogohlantirishi', this.securityThreadId ?? this.credentialsThreadId);
  }

  /** Telefon kod bilan tasdiqlangach: hisob haqida xabar (yopiq guruhga). Parol bu xabarda yo‘q — bazada faqat xesh bor. */
  notifyAccountVerified(input: { phone: string; name: string; role?: string }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    const text = [
      `✅ <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — hisob tasdiqlandi`,
      `Akkaunt roli: <b>${escapeHtml(input.role ?? 'Mijoz')}</b>`,
      `Ism familiya: ${input.name ? escapeHtml(input.name) : '—'}`,
      `Login: <code>${escapeHtml(input.phone)}</code>`,
      'Telefon raqami kod bilan tasdiqlandi, hisob faol.',
    ].join('\n');
    void this.post(this.credentialsChatId, text, 'hisob tasdiqlandi', this.credentialsThreadId);
  }

  /** Xato ogohlantirishlari: alohida guruh berilmagan bo‘lsa — asosiy («Quyosh») guruhning mavzusiga yuboriladi. */
  private alertTarget(): { chatId: string; threadId?: number } {
    if (this.chatId) return { chatId: this.chatId };
    return { chatId: this.credentialsChatId, threadId: this.alertsThreadId ?? this.securityThreadId ?? this.credentialsThreadId };
  }

  isEnabled(): boolean {
    return !!this.botToken && !!this.alertTarget().chatId;
  }

  notifyError(alert: ErrorAlert): void {
    if (!this.isEnabled() || alert.status < this.minStatus) return;
    const key = `${alert.method ?? ''} ${alert.path ?? ''} ${alert.code} ${alert.message}`;
    if (!this.shouldSend(key)) return;
    const target = this.alertTarget();
    void this.post(target.chatId, this.format(alert), `xato ${alert.status} ${alert.code}`, target.threadId);
  }

  private shouldSend(key: string): boolean {
    const now = Date.now();
    const last = this.lastSent.get(key);
    if (last !== undefined && now - last < this.dedupeWindowMs) return false;
    if (this.lastSent.size >= MAX_TRACKED_KEYS) {
      for (const [storedKey, at] of this.lastSent) {
        if (now - at >= this.dedupeWindowMs) this.lastSent.delete(storedKey);
      }
      if (this.lastSent.size >= MAX_TRACKED_KEYS) this.lastSent.clear();
    }
    this.lastSent.set(key, now);
    return true;
  }

  private format(alert: ErrorAlert): string {
    const path = alert.path?.split('?')[0];
    const lines = [
      `🚨 <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — ${alert.status} ${escapeHtml(alert.code)}`,
      alert.method && path ? `<b>${escapeHtml(alert.method)}</b> <code>${escapeHtml(path)}</code>` : undefined,
      `Xabar: ${escapeHtml(alert.message)}`,
      alert.requestId ? `Request ID: <code>${escapeHtml(alert.requestId)}</code>` : undefined,
      alert.stack ? `<pre>${escapeHtml(alert.stack.split('\n').slice(0, MAX_STACK_LINES).join('\n'))}</pre>` : undefined,
    ].filter((line): line is string => !!line);
    const text = lines.join('\n');
    return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
  }

  private async post(chatId: string, text: string, label = 'xabar', threadId?: number): Promise<boolean> {
    // Taqiqlangan guruhlarga hech qachon yuborilmaydi.
    if (this.blockedChatIds.has(String(chatId).trim())) {
      this.logger.warn(`Telegram: taqiqlangan guruhga yuborilmadi (${label}).`);
      return false;
    }
    let thread = threadId;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const outcome = await this.postOnce(chatId, text, thread);
      // Guruh «mavzular» rejimida emas bo‘lsa — mavzusiz qayta yuboriladi.
      if (outcome === 'bad-thread' && thread !== undefined) {
        thread = undefined;
        continue;
      }
      if (outcome === 'sent') {
        this.logger.log(`Telegram’ga yuborildi: ${label}${attempt > 1 ? ` (${attempt}-urinishda)` : ''}.`);
        return true;
      }
      if (outcome === 'rejected' || attempt === MAX_ATTEMPTS) return false;
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
    }
    return false;
  }

  private async postOnce(chatId: string, text: string, threadId?: number): Promise<'sent' | 'rejected' | 'retry' | 'bad-thread'> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(threadId !== undefined ? { message_thread_id: threadId } : {}) }),
        signal: controller.signal,
      });
      if (response.ok) return 'sent';
      if (response.status === 400 && threadId !== undefined) {
        const info = (await response.json().catch(() => null)) as { description?: string } | null;
        if (/thread/i.test(info?.description ?? '')) return 'bad-thread';
      }
      this.logger.warn(`Telegram xabarni qabul qilmadi (HTTP ${response.status}).`);
      return response.status === 429 || response.status >= 500 ? 'retry' : 'rejected';
    } catch (error) {
      const cause = (error as { cause?: { code?: string } }).cause?.code;
      const detail = (error as Error).message.split(this.botToken).join('***').slice(0, 120);
      this.logger.warn(`Telegram’ga yuborib bo‘lmadi (${(error as Error).name}${cause ? `: ${cause}` : ''}: ${detail}).`);
      return 'retry';
    } finally {
      clearTimeout(timer);
    }
  }

  /** Qo‘ng‘iroq yozuvi tayinlangan guruhga yuboriladi (video → video guruh, audio → audio guruh). Hech qayerda saqlanmaydi; sozlanmagan bo‘lsa false. */
  async sendCallRecording(input: { kind: 'VIDEO' | 'AUDIO'; data: Buffer; mimeType: string; caption: string; fileBase: string }): Promise<boolean> {
    const video = input.kind === 'VIDEO';
    const chatId = this.config.get<string>(video ? 'telegram.callsVideoChatId' : 'telegram.callsAudioChatId', '');
    let thread = this.config.get<number | undefined>(video ? 'telegram.callsVideoThreadId' : 'telegram.callsAudioThreadId', undefined);
    if (!this.botToken || !chatId || this.blockedChatIds.has(chatId.trim())) {
      this.logger.warn(`Telegram: ${video ? 'video' : 'audio'} qo‘ng‘iroqlar guruhi sozlanmagan — yozuv yuborilmadi va o‘chirildi.`);
      return false;
    }
    const ext = input.mimeType.includes('mp4') ? 'mp4' : input.mimeType.includes('ogg') ? 'ogg' : 'webm';
    const base = input.fileBase;
    const archive = zipSingle(`${base}.${ext}`, input.data);
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const form = new FormData();
      form.set('chat_id', chatId);
      if (thread !== undefined) form.set('message_thread_id', String(thread));
      form.set('caption', input.caption.slice(0, 1000));
      form.set('parse_mode', 'HTML');
      form.set('document', new Blob([new Uint8Array(archive)], { type: 'application/zip' }), `${base}.zip`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120_000);
      try {
        const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendDocument`, { method: 'POST', body: form, signal: controller.signal });
        if (response.ok) {
          this.logger.log(`Telegram’ga qo‘ng‘iroq yozuvi yuborildi: ${video ? 'video' : 'audio'}, ${Math.round(archive.length / 1024)} KB.`);
          return true;
        }
        if (response.status === 400 && thread !== undefined) {
          const info = (await response.json().catch(() => null)) as { description?: string } | null;
          if (/thread/i.test(info?.description ?? '')) {
            thread = undefined;
            continue;
          }
        }
        this.logger.warn(`Telegram qo‘ng‘iroq yozuvini qabul qilmadi (HTTP ${response.status}).`);
        if (response.status !== 429 && response.status < 500) return false;
      } catch (error) {
        this.logger.warn(`Telegram’ga qo‘ng‘iroq yozuvini yuborib bo‘lmadi (${(error as Error).name}).`);
      } finally {
        clearTimeout(timer);
      }
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
    }
    return false;
  }
}
