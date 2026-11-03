import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERRORS } from '../constants/error-messages';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  IdempotencyInProgressException,
  IdempotencyKeyInvalidException,
  IdempotencyKeyRequiredException,
  IdempotencyKeyReusedException,
} from '../exceptions/business.exception';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',');
  return `{${body}}`;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return next.handle();

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const rawKey = req.headers?.['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!key) throw new IdempotencyKeyRequiredException();
    if (!/^[\x21-\x7e]{1,255}$/.test(key)) throw new IdempotencyKeyInvalidException();

    const userId: string | undefined = req.user?.sub;
    if (!userId) throw new IdempotencyKeyRequiredException();

    const method: string = req.method;
    const endpoint: string = String(req.originalUrl ?? req.url).split('?')[0];
    const requestHash = createHash('sha256').update(stableStringify(req.body ?? {})).digest('hex');

    return from(
      this.claim(userId, method, endpoint, key, requestHash),
    ).pipe(
      switchMap((claim) => {
        if (claim.replay) {
          const status = claim.responseStatus!;
          if (status >= 400) {
            return throwError(() => new HttpException(claim.responseBody as object, status));
          }
          res.status(status);
          return new Observable((subscriber) => {
            subscriber.next(claim.responseBody);
            subscriber.complete();
          });
        }

        return next.handle().pipe(
          switchMap((body) =>
            from(
              this.prisma.idempotencyKey.update({
                where: { id: claim.id },
                data: { responseStatus: res.statusCode ?? 200, responseBody: body ?? {} },
              }),
            ).pipe(switchMap(() => new Observable((subscriber) => {
              subscriber.next(body);
              subscriber.complete();
            }))),
          ),
          catchError((err) => {
            const status = err instanceof HttpException ? err.getStatus() : 500;
            if (status >= 500) {
              return from(this.prisma.idempotencyKey.delete({ where: { id: claim.id } })).pipe(
                switchMap(() => throwError(() => err)),
              );
            }
            const body = err instanceof HttpException ? err.getResponse() : { message: ERRORS.INTERNAL_SERVER_ERROR };
            return from(
              this.prisma.idempotencyKey.update({
                where: { id: claim.id },
                data: { responseStatus: status, responseBody: body as object },
              }),
            ).pipe(switchMap(() => throwError(() => err)));
          }),
        );
      }),
    );
  }

  private async claim(
    userId: string,
    method: string,
    endpoint: string,
    key: string,
    requestHash: string,
  ): Promise<{ id: string; replay: boolean; responseStatus?: number; responseBody?: unknown }> {
    try {
      const created = await this.prisma.idempotencyKey.create({
        data: {
          userId,
          method,
          endpoint,
          key,
          requestHash,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        },
      });
      return { id: created.id, replay: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.idempotencyKey.findUniqueOrThrow({
          where: { userId_method_endpoint_key: { userId, method, endpoint, key } },
        });
        if (existing.expiresAt <= new Date()) {
          await this.prisma.idempotencyKey.deleteMany({ where: { id: existing.id } });
          return this.claim(userId, method, endpoint, key, requestHash);
        }
        if (existing.requestHash !== requestHash) throw new IdempotencyKeyReusedException();
        if (existing.responseStatus === null) throw new IdempotencyInProgressException();
        return {
          id: existing.id,
          replay: true,
          responseStatus: existing.responseStatus,
          responseBody: existing.responseBody,
        };
      }
      throw error;
    }
  }
}
