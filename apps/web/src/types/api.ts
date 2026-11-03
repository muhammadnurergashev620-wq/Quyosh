export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  requestId: string | null;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  requestId: string | null;
}

export interface ApiErrorEnvelope extends ApiErrorBody {
  success: false;
  details?: string[];
  timestamp?: string;
  path?: string;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly details: string[];
  /** Sessiya yangilanmadi (refresh muvaffaqiyatsiz): bu «parol noto‘g‘ri» emas, qayta kirish kerak. */
  sessionExpired = false;

  constructor(body: ApiErrorBody & { details?: string[] }) {
    super(body.message);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.requestId = body.requestId;
    this.details = body.details ?? [];
  }

  get isValidation(): boolean {
    return this.statusCode === 400;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  get isConflict(): boolean {
    return this.statusCode === 409;
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
