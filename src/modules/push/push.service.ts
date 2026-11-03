import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PUSH_TRANSPORT } from './push.transport';
import type { PushMessage, PushTransport } from './push.transport';
import type { RegisterPushTokenDto } from './dto/register-token.dto';

const MAX_TOKENS_PER_USER = 10;

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly db: PrismaService,
    @Optional() @Inject(PUSH_TRANSPORT) private readonly transport: PushTransport | null,
  ) {
    if (!this.transport) this.logger.warn('Push bildirishnomalar o‘chiq: FIREBASE_SERVICE_ACCOUNT_PATH berilmagan');
  }

  get enabled(): boolean {
    return !!this.transport;
  }

  /** Qurilma tokenini saqlaydi (token boshqa foydalanuvchida bo‘lsa, unga ko‘chiriladi). Foydalanuvchi uchun eng yangi 10 ta token qoladi. */
  async register(userId: string, dto: RegisterPushTokenDto) {
    const saved = await this.db.pushToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform ?? 'android', panel: dto.panel },
      update: { userId, platform: dto.platform ?? 'android', panel: dto.panel, lastSeenAt: new Date() },
      select: { id: true },
    });
    const stale = await this.db.pushToken.findMany({ where: { userId }, orderBy: { lastSeenAt: 'desc' }, skip: MAX_TOKENS_PER_USER, select: { id: true } });
    if (stale.length > 0) await this.db.pushToken.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
    return { registered: true, id: saved.id };
  }

  async unregister(userId: string, token: string) {
    const removed = await this.db.pushToken.deleteMany({ where: { userId, token } });
    return { removed: removed.count };
  }

  /** Foydalanuvchida kamida bitta qurilma tokeni bormi (offline qo‘ng‘iroqni push bilan jiringlatish uchun). */
  async hasTokens(userId: string): Promise<boolean> {
    if (!this.transport) return false;
    return (await this.db.pushToken.count({ where: { userId } })) > 0;
  }

  /** Foydalanuvchining barcha qurilmalariga yuboradi. Hech qachon xato tashlamaydi: push muvaffaqiyatsiz bo‘lsa ham asosiy jarayon to‘xtamasin. */
  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    if (!this.transport) return;
    try {
      const rows = await this.db.pushToken.findMany({ where: { userId }, select: { token: true } });
      if (rows.length === 0) return;
      const result = await this.transport.send(
        rows.map((row) => row.token),
        message,
      );
      if (result.invalidTokens.length > 0) await this.db.pushToken.deleteMany({ where: { token: { in: result.invalidTokens } } });
    } catch (error) {
      this.logger.warn(`Push yuborilmadi (${userId}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/** Bildirishnoma `data` qismini FCM uchun satr qiymatlariga aylantiradi (ichma-ich obyektlar tashlanadi). */
export function toPushData(template: string | null | undefined, data: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (template) out.type = template;
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = String(value);
    }
  }
  return out;
}
