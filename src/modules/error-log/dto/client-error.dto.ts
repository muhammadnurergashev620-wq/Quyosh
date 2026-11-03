import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const CLIENT_ERROR_KINDS = ['UI_CRASH', 'UI_ERROR', 'API_ERROR', 'NETWORK'] as const;

export class ClientErrorDto {
  @IsIn(CLIENT_ERROR_KINDS)
  kind!: (typeof CLIENT_ERROR_KINDS)[number];

  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional() @IsString() @MaxLength(8000)
  stack?: string;

  @IsOptional() @IsInt() @Min(0) @Max(599)
  status?: number;

  @IsOptional() @IsString() @MaxLength(100)
  code?: string;

  @IsOptional() @IsString() @MaxLength(10)
  method?: string;

  /** So‘ralgan API yo‘li. */
  @IsOptional() @IsString() @MaxLength(500)
  path?: string;

  /** Foydalanuvchi turgan sahifa. */
  @IsOptional() @IsString() @MaxLength(500)
  pageUrl?: string;

  @IsOptional() @IsString() @MaxLength(100)
  requestId?: string;

  @IsOptional() @IsIn(['web', 'android', 'ios'])
  platform?: 'web' | 'android' | 'ios';

  @IsOptional() @IsString() @MaxLength(40)
  appVersion?: string;

  @IsOptional() @IsObject()
  context?: Record<string, unknown>;
}
