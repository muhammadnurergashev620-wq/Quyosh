import type { NextFunction, Request, Response } from 'express';
import type { MetricsService } from './metrics.service';
import type { RequestRateService } from './request-rate.service';

export function createMetricsMiddleware(metrics: MetricsService, requestRate: RequestRateService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = (req.route?.path as string | undefined) ?? 'unmatched';
      metrics.observeHttp(req.method, route, res.statusCode, seconds);
      const path = (req.originalUrl ?? '').split('?')[0] ?? '';
      const segment = path.replace(/^\/api\/v\d+/, '').split('/').filter(Boolean)[0];
      if (segment === 'health' || segment === 'metrics') return; // monitoring so‘rovlari trafik hisobiga kirmaydi
      requestRate.record({ route: segment ? `/api/${segment}` : 'boshqa', status: res.statusCode, durationMs: seconds * 1000 });
    });
    next();
  };
}
