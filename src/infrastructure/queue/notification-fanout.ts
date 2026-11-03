import { Injectable, Logger } from '@nestjs/common';

/** In-app bildirishnoma yaratilgandan keyin boshqa kanallarga (SMS, email) tarqatish uchun hodisa. */
export interface FanoutEvent {
  outboxEventId: string;
  eventName: string;
  userId: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
}

type Handler = (event: FanoutEvent) => Promise<void>;

/**
 * Kanal adapterlari (TZ 14.3: provider adapter bilan izolyatsiya) o‘zini shu yerda ro‘yxatdan o‘tkazadi;
 * outbox processor modul qatlamiga bog‘lanmasdan tranzaksiya yakunlangach chaqiradi. Xato asosiy oqimni to‘xtatmaydi.
 */
@Injectable()
export class NotificationFanout {
  private readonly logger = new Logger(NotificationFanout.name);
  private readonly handlers: Handler[] = [];

  register(handler: Handler) {
    this.handlers.push(handler);
  }

  async dispatch(event: FanoutEvent) {
    for (const handler of this.handlers) {
      await handler(event).catch((error: Error) => this.logger.warn(`Kanalga tarqatib bo‘lmadi (${event.eventName}): ${error.message}`));
    }
  }
}
