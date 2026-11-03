import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { MetricsService } from './infrastructure/metrics/metrics.service';
import { RequestRateService } from './infrastructure/metrics/request-rate.service';
import { createMetricsMiddleware } from './infrastructure/metrics/metrics.middleware';

(BigInt.prototype as unknown as { toJSON(): number }).toJSON = function toJSON() {
  return Number(this);
};

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    // API faqat JSON beradi: hech qanday faol kontent, ramkaga joylash yoki forma yuborish kerak emas.
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    // Shaxsiy ma'lumotli javoblar brauzer/proksi keshida qolmasin (fayl uzatish yo'li o'z Cache-Control'ini qo'yadi).
    res.setHeader('Cache-Control', 'no-store');
    if (config.get<string>('app.environment') === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  (app.getHttpAdapter().getInstance() as { disable(key: string): void }).disable('x-powered-by');
  app.enableShutdownHooks();
  const trustProxy = config.get<boolean | number | string>('app.trustProxy', false);
  if (trustProxy !== false) {
    (app.getHttpAdapter().getInstance() as { set(key: string, value: boolean | number | string): void }).set('trust proxy', trustProxy);
  }
  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
  app.use(createMetricsMiddleware(app.get(MetricsService), app.get(RequestRateService)));

  const origins = config.get<string[]>('app.corsOrigins', []);
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: true,
  });

  app.useGlobalPipes(createValidationPipe());
}
