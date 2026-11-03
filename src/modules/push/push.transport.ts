/** FCM orqali yuborish uchun minimal interfeys (testlarda soxta uzatuvchi bilan almashtiriladi). */
export interface PushMessage {
  title: string;
  body: string;
  /** Faqat satr qiymatlari (FCM talabi): sahifaga o‘tish uchun url, orderId va h.k. */
  data?: Record<string, string>;
  /** `call` — kiruvchi qo‘ng‘iroq: yuqori ustuvorlik va alohida kanal. */
  kind?: 'default' | 'call';
}

export interface PushSendResult {
  /** Token bo‘yicha: yuborildi (true) yoki yaroqsiz (false) — yaroqsizlari bazadan o‘chiriladi. */
  invalidTokens: string[];
  sent: number;
}

export interface PushTransport {
  send(tokens: string[], message: PushMessage): Promise<PushSendResult>;
}

export const PUSH_TRANSPORT = Symbol('PUSH_TRANSPORT');
