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

export class RequestAlreadyBookedException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, 'REQUEST_ALREADY_BOOKED', ERRORS.REQUEST_ALREADY_BOOKED);
  }
}

export class MasterTimeUnavailableException extends DomainException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      'MASTER_TIME_UNAVAILABLE',
      ERRORS.MASTER_TIME_UNAVAILABLE,
    );
  }
}

export class InvalidTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(
      HttpStatus.CONFLICT,
      'INVALID_TRANSITION',
      ERRORS.INVALID_TRANSITION(from, to),
    );
  }
}

export class OfferNotAvailableException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, 'OFFER_NOT_AVAILABLE', ERRORS.OFFER_NOT_AVAILABLE);
  }
}

export class RequestNotOpenForOffersException extends DomainException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      'REQUEST_NOT_OPEN_FOR_OFFERS',
      ERRORS.REQUEST_NOT_OPEN_FOR_OFFERS,
    );
  }
}

export class AlreadyOfferedException extends DomainException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      'ALREADY_OFFERED',
      ERRORS.ALREADY_OFFERED,
    );
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
      'IDEMPOTENCY_KEY_REUSED',
      ERRORS.IDEMPOTENCY_KEY_REUSED,
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

export class RefundExceedsCapturedException extends DomainException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      'REFUND_EXCEEDS_CAPTURED',
      ERRORS.REFUND_EXCEEDS_CAPTURED,
    );
  }
}

export class OrderNotPayableException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, 'ORDER_NOT_PAYABLE', ERRORS.ORDER_NOT_PAYABLE);
  }
}

export class PaymentNotRefundableException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, 'PAYMENT_NOT_REFUNDABLE', ERRORS.PAYMENT_NOT_REFUNDABLE);
  }
}

export class PaymentRequiredException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, 'PAYMENT_REQUIRED', ERRORS.PAYMENT_REQUIRED);
  }
}

export class OrderAlreadyPaidException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, 'ORDER_ALREADY_PAID', ERRORS.ORDER_ALREADY_PAID);
  }
}

export class WebhookVerificationFailedException extends DomainException {
  constructor() {
    super(HttpStatus.BAD_REQUEST, 'WEBHOOK_VERIFICATION_FAILED', ERRORS.WEBHOOK_VERIFICATION_FAILED);
  }
}

export class WorkTooEarlyException extends DomainException {
  constructor(scheduledAt: string) {
    super(HttpStatus.CONFLICT, 'WORK_TOO_EARLY', ERRORS.WORK_TOO_EARLY(scheduledAt));
  }
}

export class RescheduleNotAllowedException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, 'RESCHEDULE_NOT_ALLOWED', ERRORS.RESCHEDULE_NOT_ALLOWED);
  }
}

export class RescheduleNotPendingException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, 'RESCHEDULE_NOT_PENDING', ERRORS.RESCHEDULE_NOT_PENDING);
  }
}

export class RescheduleOwnProposalException extends DomainException {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'RESCHEDULE_OWN_PROPOSAL', ERRORS.RESCHEDULE_OWN_PROPOSAL);
  }
}
