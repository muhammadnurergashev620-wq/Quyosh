import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { PushMessage, PushSendResult, PushTransport } from './push.transport';

const INVALID_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

/** Firebase Cloud Messaging (FCM v1): xizmat hisobi kaliti `FIREBASE_SERVICE_ACCOUNT_PATH` (yoki `FIREBASE_SERVICE_ACCOUNT_JSON`) orqali beriladi. */
export class FcmTransport implements PushTransport {
  private readonly logger = new Logger(FcmTransport.name);

  private constructor(private readonly app: App) {}

  /** Kalit berilmagan yoki o‘qib bo‘lmasa — `null` (push o‘chiq, ilova ishlashda davom etadi). */
  static create(env: { path?: string; json?: string }): FcmTransport | null {
    const logger = new Logger('FcmTransport');
    try {
      const raw = env.json?.trim() || (env.path?.trim() ? readFileSync(env.path.trim(), 'utf8') : '');
      if (!raw) return null;
      const credentials = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
      if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
        logger.warn('Firebase kalit fayli to‘liq emas: push bildirishnomalar o‘chiq');
        return null;
      }
      const existing = getApps().find((app) => app.name === 'quyosh-push');
      const app = existing ?? initializeApp({ credential: cert({ projectId: credentials.project_id, clientEmail: credentials.client_email, privateKey: credentials.private_key }) }, 'quyosh-push');
      return new FcmTransport(app);
    } catch (error) {
      logger.warn(`Firebase kalitini o‘qib bo‘lmadi, push o‘chiq: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async send(tokens: string[], message: PushMessage): Promise<PushSendResult> {
    if (tokens.length === 0) return { invalidTokens: [], sent: 0 };
    const isCall = message.kind === 'call';
    const response = await getMessaging(this.app).sendEachForMulticast({
      tokens,
      notification: { title: message.title, body: message.body },
      data: { ...(message.data ?? {}), kind: message.kind ?? 'default' },
      // Brauzer (Web Push): xizmat skripti `data` ni o‘qib, bildirishnomani ko‘rsatadi va bosilganda sahifani ochadi.
      webpush: { headers: { Urgency: 'high', TTL: String(isCall ? 30 : 24 * 60 * 60) } },
      android: {
        priority: 'high',
        ttl: isCall ? 30_000 : 24 * 60 * 60 * 1000,
        notification: { channelId: isCall ? 'calls' : 'default', sound: 'default', priority: isCall ? 'max' : 'high' },
      },
    });
    const invalidTokens: string[] = [];
    response.responses.forEach((item, index) => {
      if (!item.success && item.error && INVALID_CODES.has(item.error.code)) invalidTokens.push(tokens[index]!);
      else if (!item.success) this.logger.warn(`FCM xatosi (${item.error?.code ?? 'noma’lum'}): ${item.error?.message ?? ''}`.trim());
    });
    return { invalidTokens, sent: response.successCount };
  }
}
