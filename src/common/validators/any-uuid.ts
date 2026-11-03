import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { registerDecorator } from 'class-validator';
import type { ValidationOptions } from 'class-validator';

/**
 * Har qanday UUID: 8-4-4-4-12 o‘n oltilik. Postgres `uuid` turi ham shuni qabul qiladi.
 * Standart `IsUUID`/`ParseUUIDPipe` faqat RFC versiya/variant raqamiga mos id’larni o‘tkazadi — tizimdagi tayyor akkaunt id’lari
 * («c0000000-0000-0000-0000-000000000001») bunga mos kelmaydi, ular sahifalash kursori yoki manzilda kelganda 400 xato chiqardi.
 */
export const ANY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isAnyUuid = (value: unknown): value is string => typeof value === 'string' && ANY_UUID.test(value);

/** `@IsUUID()` o‘rniga: har qanday UUID. Birinchi argument (versiya) e’tiborga olinmaydi — eski chaqiruvlar bilan moslik uchun. */
export function IsUUID(_version?: unknown, validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isUuid',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isAnyUuid(value),
        defaultMessage: () => '$property must be a UUID',
      },
    });
  };
}

/** `ParseUUIDPipe` o‘rniga: yo‘l parametri har qanday UUID bo‘lishi mumkin. */
@Injectable()
export class ParseUUIDPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (isAnyUuid(value)) return value;
    throw new BadRequestException('Validation failed (uuid is expected)');
  }
}
