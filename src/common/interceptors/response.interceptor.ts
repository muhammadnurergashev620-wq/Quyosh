import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { decorateAvatars } from '../utils/avatar';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [context.getHandler(), context.getClass()]);
    if (raw) return next.handle();

    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(map(data => ({ success: true, data: decorateAvatars(data), requestId: req.id ?? req.headers['x-request-id'] ?? null })));
  }
}
