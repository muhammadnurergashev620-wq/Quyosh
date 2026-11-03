import { registerAs } from '@nestjs/config';

export default registerAs('scanner', () => ({
  host: process.env.CLAMAV_HOST ?? '',
  port: Number(process.env.CLAMAV_PORT ?? 3310),
  timeoutMs: Number(process.env.CLAMAV_TIMEOUT_MS ?? 60_000),
}));
