import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform, ValidationPipe } from '@nestjs/common';
import { extname } from 'node:path';
import { ValidationError } from 'class-validator';
import { ERRORS } from '../constants/error-messages';
import { collectValidationMessages } from '../constants/validation-messages';


function containsNul(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return value.includes('\u0000');
  if (depth > 8 || value === null || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some((item) => containsNul(item, depth + 1));
}

class SafeValidationPipe extends ValidationPipe {
  override async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    if (metadata.type !== 'custom' && containsNul(value)) {
      throw new BadRequestException(ERRORS.NUL_CHARACTERS);
    }
    return super.transform(value, metadata);
  }
}

export function createValidationPipe(): ValidationPipe {
  return new SafeValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: ERRORS.VALIDATION_FAILED,
        details: collectValidationMessages(errors),
      }),
  });
}
