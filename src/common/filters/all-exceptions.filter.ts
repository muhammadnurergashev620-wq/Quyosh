import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERRORS } from '../constants/error-messages';

const DEFAULT_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

const DEFAULT_MESSAGES: Record<number, string> = {
  400: ERRORS.BAD_REQUEST,
  401: ERRORS.UNAUTHORIZED,
  403: ERRORS.FORBIDDEN,
  404: ERRORS.NOT_FOUND_PAGE,
  409: ERRORS.CONFLICT,
  413: ERRORS.PAYLOAD_TOO_LARGE,
  422: ERRORS.UNPROCESSABLE_ENTITY,
  429: ERRORS.TOO_MANY_REQUESTS,
  500: ERRORS.INTERNAL_SERVER_ERROR,
  503: ERRORS.SERVICE_UNAVAILABLE,
};

const NEST_ENGLISH_MESSAGES = [
  'Unauthorized',
  'Forbidden',
  'Forbidden resource',
  'Not Found',
  'Bad Request',
  'Conflict',
  'Internal Server Error',
  'Too Many Requests',
  'Payload Too Large',
  'Service Unavailable',
  'Unprocessable Entity',
  'Validation failed',
];

export interface ErrorNotifier {
  notifyError(alert: {
    status: number;
    code: string;
    message: string;
    method?: string;
    path?: string;
    requestId?: string | null;
    stack?: string;
    req?: unknown;
    details?: string[];
  }): void;
}

interface ErrorResult {
  status: number;
  code: string;
  message: string;
  details?: string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private readonly notifiers: ErrorNotifier[];

  constructor(notifier?: ErrorNotifier | ErrorNotifier[]) {
    this.notifiers = Array.isArray(notifier) ? notifier : notifier ? [notifier] : [];
  }

  private isBodyParserError(exception: unknown): exception is { status: number; type: string } {
    const error = exception as { status?: unknown; type?: unknown } | null;
    return (
      typeof error === 'object' &&
      error !== null &&
      typeof error.type === 'string' &&
      /^(entity\.|encoding\.|request\.|charset\.|stream\.)/.test(error.type) &&
      typeof error.status === 'number' &&
      error.status >= 400 &&
      error.status < 500
    );
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    let result: ErrorResult;
    if (exception instanceof HttpException) {
      result = this.fromHttpException(exception);
      // JSON parser xabarlari (pozitsiya, kutilgan belgi) ichki tafsilot hisoblanadi — umumiy xabar bilan almashtiriladi.
      if (/JSON|Unexpected (token|end)|position \d+/.test(result.message)) result = { ...result, message: ERRORS.BAD_REQUEST, details: undefined };
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      result = this.fromPrismaError(exception);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      result = { status: 400, code: 'VALIDATION_ERROR', message: ERRORS.PRISMA_INVALID_VALUE };
    } else if (this.isBodyParserError(exception)) {
      // Body-parser xatolari (juda katta tana, buzuq JSON, noto‘g‘ri kodlash): 5xx emas, 4xx; ichki tafsilot oshkor qilinmaydi.
      const status = exception.status;
      result = { status, code: DEFAULT_CODES[status] ?? 'VALIDATION_ERROR', message: DEFAULT_MESSAGES[status] ?? ERRORS.BAD_REQUEST };
    } else {
      result = { status: 500, code: 'INTERNAL_ERROR', message: ERRORS.INTERNAL_SERVER_ERROR };
    }

    if (result.status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`Kutilmagan xatolik: ${req.method} ${req.url}`, stack);
    }

    try {
      const alert = {
        status: result.status,
        code: result.code,
        message: result.message,
        method: req.method,
        path: req.url,
        requestId: req.id ?? req.headers['x-request-id'] ?? null,
        stack: result.status >= 500 && exception instanceof Error ? exception.stack : undefined,
        req,
        details: result.details,
      };
      for (const notifier of this.notifiers) {
        try {
          notifier.notifyError(alert);
        } catch {
          // bir bildirgich ishlamasa, boshqasi to‘xtamasin
        }
      }
    } catch {
    }

    res.status(result.status).json({
      success: false,
      statusCode: result.status,
      code: result.code,
      message: result.message,
      ...(result.details ? { details: result.details } : {}),
      timestamp: new Date().toISOString(),
      path: req.url,
      requestId: req.id ?? req.headers['x-request-id'] ?? null,
    });
  }

  private fromHttpException(exception: HttpException): ErrorResult {
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

    let message = typeof raw === 'string' ? raw : body.message;
    let details: string[] | undefined;
    if (Array.isArray(body.details)) {
      details = body.details as string[];
    }
    if (Array.isArray(message)) {
      details = message as string[];
      message = ERRORS.VALIDATION_FAILED;
    }

    let text = typeof message === 'string' ? message : '';
    if (text === '' || NEST_ENGLISH_MESSAGES.includes(text) || text.startsWith('Cannot ')) {
      text = DEFAULT_MESSAGES[status] ?? ERRORS.INTERNAL_SERVER_ERROR;
    }
    if (text.startsWith('Unexpected token') || text.includes('is not valid JSON')) {
      text = ERRORS.INVALID_JSON;
    }

    const code = typeof body.code === 'string' ? body.code : (DEFAULT_CODES[status] ?? 'INTERNAL_ERROR');
    return { status, code, message: text, details };
  }

  private fromPrismaError(exception: Prisma.PrismaClientKnownRequestError): ErrorResult {
    if (exception.code === 'P2002') {
      return { status: HttpStatus.CONFLICT, code: 'CONFLICT', message: ERRORS.PRISMA_UNIQUE };
    }
    if (exception.code === 'P2025') {
      return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: ERRORS.PRISMA_NOT_FOUND };
    }
    if (exception.code === 'P2003') {
      return { status: HttpStatus.BAD_REQUEST, code: 'FOREIGN_KEY_ERROR', message: ERRORS.PRISMA_FOREIGN_KEY };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: ERRORS.INTERNAL_SERVER_ERROR };
  }
}
