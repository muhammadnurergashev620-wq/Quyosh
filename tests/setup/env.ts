import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

/** Mahalliy .env dagi (git'ga tushmaydigan) haqiqiy parollarni o‘qiydi; standart parollar endi ishlamaydi. */
function localEnv(): Record<string, string> {
  const file = resolve(__dirname, '../../.env');
  if (!existsSync(file)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1] as string] = (match[2] as string).replace(/^"|"$/g, '');
  }
  return values;
}
const LOCAL = localEnv();
const localDatabaseBase = /^(postgres(?:ql)?:\/\/[^/]+)\//.exec(LOCAL.DATABASE_URL ?? '')?.[1];

export const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: '3999',
  METRICS_DIR: resolve(tmpdir(), 'quyosh-test-metrics'),
  DATABASE_BASE_URL: process.env.TEST_DATABASE_BASE_URL || localDatabaseBase || 'postgresql://quyosh:quyosh_dev_only@localhost:55432',
  DATABASE_NAME: process.env.TEST_DATABASE_NAME || 'quyosh_test',
  REDIS_URL: process.env.TEST_REDIS_URL || 'redis://localhost:56379/15',
  JWT_SECRET: 'test-only-jwt-secret-0123456789abcdef0123456789',
  CLICK_SECRET_KEY: 'test-only-click-webhook-secret',
  STORAGE_ENDPOINT: process.env.TEST_STORAGE_ENDPOINT || LOCAL.STORAGE_ENDPOINT || 'http://localhost:59100',
  STORAGE_REGION: 'us-east-1',
  STORAGE_BUCKET: process.env.TEST_STORAGE_BUCKET || 'quyosh-test',
  STORAGE_ACCESS_KEY_ID: process.env.TEST_STORAGE_ACCESS_KEY_ID || LOCAL.STORAGE_ACCESS_KEY_ID || 'quyosh',
  STORAGE_SECRET_ACCESS_KEY: process.env.TEST_STORAGE_SECRET_ACCESS_KEY || LOCAL.STORAGE_SECRET_ACCESS_KEY || 'quyosh_dev_only',
  STORAGE_FORCE_PATH_STYLE: 'true',
  CLAMAV_HOST: process.env.TEST_CLAMAV_HOST || 'localhost',
  CLAMAV_PORT: process.env.TEST_CLAMAV_PORT || '53310',
  CLAMAV_TIMEOUT_MS: '60000',
  ADMIN_PHONE: '',
  ADMIN_PASSWORD: '',
  // Testlarda haqiqiy Firebase'ga hech qachon ulanilmaydi.
  FIREBASE_SERVICE_ACCOUNT_PATH: '',
  FIREBASE_SERVICE_ACCOUNT_JSON: '',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  TELEGRAM_OTP_CHAT_ID: '',
  // Testlar tashqi provayderlarga chiqmaydi: solar — viloyat o‘rtachasi (DEFAULT), kurs — yuklanmaydi.
  SOLAR_FETCH: 'false',
  EXCHANGE_RATE_FETCH: 'false',
  OTP_DEV_ECHO: 'true',
  OTP_DEV_ECHO_AUTH: 'false',
  MAX_ACTIVE_DEVICES: '2',
  DEVICE_TRUST_SECONDS: '86400',
  LOGIN_MAX_FAILURES: '10',
  LOGIN_FAILURE_WINDOW_SECONDS: '600',
  LOGIN_LOCK_SECONDS: '120',
  OTP_TTL_SECONDS: '300',
  OTP_RESEND_SECONDS: '60',
  OTP_WINDOW_SECONDS: '3600',
  OTP_MAX_REQUESTS: '5',
  OTP_IP_MULTIPLIER: '3',
  OTP_MAX_ATTEMPTS: '5',
  RATE_LIMIT_ESCALATION: 'false',
  RATE_LIMIT_REGISTER_MAX: '3',
  RATE_LIMIT_REGISTER_WINDOW_SECONDS: '3600',
  RATE_LIMIT_LOGIN_MAX: '30',
  RATE_LIMIT_LOGIN_WINDOW_SECONDS: '900',
  RATE_LIMIT_OTP_REQUEST_MAX: '5',
  RATE_LIMIT_OTP_REQUEST_WINDOW_SECONDS: '3600',
  RATE_LIMIT_OTP_VERIFY_MAX: '10',
  RATE_LIMIT_OTP_VERIFY_WINDOW_SECONDS: '900',
  RATE_LIMIT_CHAT_MAX: '30',
  RATE_LIMIT_CHAT_WINDOW_SECONDS: '60',
  RATE_LIMIT_CHAT_IP_MAX: '300',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_MINUTES: '30',
  OUTBOX_JOB_ATTEMPTS: '5',
  OUTBOX_JOB_BACKOFF_MS: '50',
  AUTH_COOKIE_SECURE: 'false',
  TRUST_PROXY: 'true',
} as const;

export const TEST_DATABASE_URL = `${TEST_ENV.DATABASE_BASE_URL}/${TEST_ENV.DATABASE_NAME}?schema=public`;

export function applyTestEnv(): void {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    if (key === 'DATABASE_BASE_URL' || key === 'DATABASE_NAME') continue;
    process.env[key] = value;
  }
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}
