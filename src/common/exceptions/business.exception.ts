import { HttpException, HttpStatus } from '@nestjs/common';
import { ERRORS } from '../constants/error-messages';

export class DomainException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string) {
    super({ code, message }, status);
  }
}

export class TooManyRequestsException extends DomainException {
  constructor(message: string = ERRORS.TOO_MANY_REQUESTS) {
    super(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', message);
  }
}

export class LoginLockedException extends DomainException {
  constructor(retryAfterSeconds: number) {
    super(HttpStatus.TOO_MANY_REQUESTS, 'LOGIN_LOCKED', ERRORS.LOGIN_LOCKED(retryAfterSeconds));
  }
}

export class IdempotencyKeyRequiredException extends DomainException {
  constructor() {
    super(HttpStatus.BAD_REQUEST, 'IDEMPOTENCY_KEY_REQUIRED', ERRORS.IDEMPOTENCY_KEY_REQUIRED);
  }
}

export class IdempotencyKeyInvalidException extends DomainException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      'IDEMPOTENCY_KEY_INVALID',
      ERRORS.IDEMPOTENCY_KEY_INVALID,
    );
  }
}

export class IdempotencyKeyReusedException extends DomainException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      'IDEMPOTENCY_CONFLICT',
      ERRORS.IDEMPOTENCY_CONFLICT,
    );
  }
}

export class IdempotencyInProgressException extends DomainException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      'IDEMPOTENCY_IN_PROGRESS',
      ERRORS.IDEMPOTENCY_IN_PROGRESS,
    );
  }
}

