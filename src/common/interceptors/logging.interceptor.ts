import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const started = Date.now();
    const route = String(req.route?.path ?? req.originalUrl ?? '').split('?')[0];

    const line = (statusCode: number) =>
      JSON.stringify({
        requestId: req.id ?? req.headers['x-request-id'] ?? null,
        method: req.method,
        route,
        statusCode,
        durationMs: Date.now() - started,
      });

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(line(res.statusCode)),
        error: (error: unknown) => {
          const status = error instanceof HttpException ? error.getStatus() : 500;
          if (status >= 500) this.logger.error(line(status));
          else this.logger.warn(line(status));
        },
      }),
    );
  }
}
