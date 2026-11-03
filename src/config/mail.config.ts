import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.SMTP_HOST ?? '',
  port: Number(process.env.SMTP_PORT ?? 587),
  user: process.env.SMTP_USER ?? '',
  password: process.env.SMTP_PASSWORD ?? '',
  from: process.env.SMTP_FROM ?? '',
}));
