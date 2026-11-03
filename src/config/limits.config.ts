import { registerAs } from '@nestjs/config';
import { boolEnv, intEnv, intListEnv } from './env.util';

export default registerAs('limits', () => ({
  /** Barcha so‘rovlar uchun umumiy IP chegarasi (alohida @RateLimit qo‘yilmagan yo‘llar): skraping/DoS'dan himoya. */
  global: { limit: intEnv('RATE_LIMIT_GLOBAL_MAX', 1200), windowSeconds: intEnv('RATE_LIMIT_GLOBAL_WINDOW_SECONDS', 60) },
  rate: {
    register: { limit: intEnv('RATE_LIMIT_REGISTER_MAX', 3), windowSeconds: intEnv('RATE_LIMIT_REGISTER_WINDOW_SECONDS', 3600) },
    login: { limit: intEnv('RATE_LIMIT_LOGIN_MAX', 30), windowSeconds: intEnv('RATE_LIMIT_LOGIN_WINDOW_SECONDS', 900) },
    otpRequest: { limit: intEnv('RATE_LIMIT_OTP_REQUEST_MAX', 3), windowSeconds: intEnv('RATE_LIMIT_OTP_REQUEST_WINDOW_SECONDS', 3600) },
    otpVerify: { limit: intEnv('RATE_LIMIT_OTP_VERIFY_MAX', 10), windowSeconds: intEnv('RATE_LIMIT_OTP_VERIFY_WINDOW_SECONDS', 900) },
    /** Qo‘ng‘iroq boshlash/signal: spamdan himoya (qo‘ng‘iroq boshlash alohida, signallar — ICE nomzodlari ko‘p bo‘lgani uchun keng). */
    call: { limit: intEnv('RATE_LIMIT_CALL_MAX', 12), windowSeconds: intEnv('RATE_LIMIT_CALL_WINDOW_SECONDS', 60), ipLimit: intEnv('RATE_LIMIT_CALL_IP_MAX', 120) },
    callSignal: { limit: intEnv('RATE_LIMIT_CALL_SIGNAL_MAX', 400), windowSeconds: intEnv('RATE_LIMIT_CALL_SIGNAL_WINDOW_SECONDS', 60), ipLimit: intEnv('RATE_LIMIT_CALL_SIGNAL_IP_MAX', 1500) },
    chat: {
      limit: intEnv('RATE_LIMIT_CHAT_MAX', 30),
      windowSeconds: intEnv('RATE_LIMIT_CHAT_WINDOW_SECONDS', 60),
      ipLimit: intEnv('RATE_LIMIT_CHAT_IP_MAX', 300),
    },
  },
  /**
   * Kuchayib boruvchi blok (auth urinishlari): oynada `limit` dan ko‘p urinish bo‘lsa — `ladder[0]` soniyaga bloklanadi;
   * `strikeWindowSeconds` (24 soat) ichida takrorlansa, blok muddati zinapoyadan keyingi qiymatga o‘sadi (oxirgisida qoladi).
   */
  escalation: {
    enabled: boolEnv('RATE_LIMIT_ESCALATION', true),
    limit: intEnv('RATE_LIMIT_ESCALATION_MAX', 3),
    windowSeconds: intEnv('RATE_LIMIT_ESCALATION_WINDOW_SECONDS', 60),
    ladder: intListEnv('RATE_LIMIT_BLOCK_LADDER', [300, 900, 3600, 21600, 86400]),
    strikeWindowSeconds: intEnv('RATE_LIMIT_STRIKE_WINDOW_SECONDS', 86400),
  },
  otp: {
    ttlSeconds: intEnv('OTP_TTL_SECONDS', 300),
    resendSeconds: intEnv('OTP_RESEND_SECONDS', 120),
    windowSeconds: intEnv('OTP_WINDOW_SECONDS', 3600),
    maxRequestsPerWindow: intEnv('OTP_MAX_REQUESTS', 3),
    ipMultiplier: intEnv('OTP_IP_MULTIPLIER', 3),
    maxAttempts: intEnv('OTP_MAX_ATTEMPTS', 5),
  },
  devices: {
    trustSeconds: intEnv('DEVICE_TRUST_SECONDS', 86400),
  },
  login: {
    maxFailures: intEnv('LOGIN_MAX_FAILURES', 10),
    failureWindowSeconds: intEnv('LOGIN_FAILURE_WINDOW_SECONDS', 600),
    lockSeconds: intEnv('LOGIN_LOCK_SECONDS', 120),
  },
}));
