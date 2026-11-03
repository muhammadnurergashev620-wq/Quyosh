import { registerAs } from '@nestjs/config';

/**
 * Qo‘ng‘iroq yozuvlari manzili. Qabul qilinadigan shakllar:
 *  - `-1001234567890` yoki `-1001234567890:55` (guruh ID si [: mavzu ID si]);
 *  - mavzuning havolasi: `https://t.me/c/1234567890/55` (guruh ID si `-100` bilan to‘ldiriladi).
 */
export function parseCallTarget(raw: string | undefined): { chatId: string; threadId: number | undefined } {
  const value = (raw ?? '').trim();
  const link = /(?:t\.me|telegram\.me)\/c\/(\d+)(?:\/(\d+))?/i.exec(value);
  if (link) return { chatId: `-100${link[1]}`, threadId: link[2] ? Number(link[2]) : undefined };
  const [chat, thread] = value.split(':');
  return { chatId: (chat ?? '').trim(), threadId: thread && Number.isFinite(Number(thread)) ? Number(thread) : undefined };
}

function callTarget(kind: 'VIDEO' | 'AUDIO', raw: string | undefined) {
  const { chatId, threadId } = parseCallTarget(raw);
  return kind === 'VIDEO' ? { callsVideoChatId: chatId, callsVideoThreadId: threadId } : { callsAudioChatId: chatId, callsAudioThreadId: threadId };
}

export default registerAs('telegram', () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  chatId: process.env.TELEGRAM_CHAT_ID ?? '',
  otpChatId: process.env.TELEGRAM_OTP_CHAT_ID ?? '',
  // OTP guruhi «mavzular» rejimida bo‘lsa — OTP kodlar yuboriladigan mavzu ID si.
  otpThreadId: process.env.TELEGRAM_OTP_THREAD_ID ? Number(process.env.TELEGRAM_OTP_THREAD_ID) : undefined,
  // Yangi foydalanuvchi login/paroli yuboriladigan YOPIQ guruh (faqat superadmin). Berilmasa OTP guruhi ishlatiladi.
  credentialsChatId: process.env.TELEGRAM_CREDENTIALS_CHAT_ID || process.env.TELEGRAM_OTP_CHAT_ID || '',
  // Guruh «mavzular» (topic) rejimida bo‘lsa — xabar yuboriladigan mavzu ID si (t.me/c/<guruh>/<mavzu> havolasidagi oxirgi son).
  credentialsThreadId: process.env.TELEGRAM_CREDENTIALS_THREAD_ID ? Number(process.env.TELEGRAM_CREDENTIALS_THREAD_ID) : undefined,
  // Xavfsizlik hodisalari (masalan, mavjud raqam bilan ro‘yxatdan o‘tishga urinish) uchun mavzu ID si; bo‘sh bo‘lsa credentials mavzusi ishlatiladi.
  securityThreadId: process.env.TELEGRAM_SECURITY_THREAD_ID ? Number(process.env.TELEGRAM_SECURITY_THREAD_ID) : undefined,
  // Foydalanuvchilarning kirish/chiqish hodisalari mavzusi.
  sessionsThreadId: process.env.TELEGRAM_SESSIONS_THREAD_ID ? Number(process.env.TELEGRAM_SESSIONS_THREAD_ID) : undefined,
  // Alohida «xato ogohlantirishlari» mavzusi (credentials guruhida). Bo‘sh bo‘lsa xavfsizlik mavzusi ishlatiladi.
  alertsThreadId: process.env.TELEGRAM_ALERTS_THREAD_ID ? Number(process.env.TELEGRAM_ALERTS_THREAD_ID) : undefined,
  // Bot HECH QACHON xabar yubormaydigan guruhlar (vergul bilan ajratilgan chat ID lar).
  blockedChatIds: (process.env.TELEGRAM_BLOCKED_CHAT_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean),
  // Qo‘ng‘iroq yozuvlari: video qo‘ng‘iroqlar TELEGRAM_VIDEO_CALL, audio qo‘ng‘iroqlar TELEGRAM_AUDIO_CALL guruhiga yuboriladi (tizimda SAQLANMAYDI).
  // Qiymat: guruh ID si, mavzulari bor guruh bo‘lsa «guruhID:mavzuID».
  ...callTarget('VIDEO', process.env.TELEGRAM_VIDEO_CALL),
  ...callTarget('AUDIO', process.env.TELEGRAM_AUDIO_CALL),
  minStatus: Number(process.env.TELEGRAM_ALERT_MIN_STATUS ?? 500),
  dedupeWindowMs: Number(process.env.TELEGRAM_ALERT_DEDUPE_SECONDS ?? 300) * 1000,
  timeoutMs: 8_000,
  retryDelayMs: 800,
}));
