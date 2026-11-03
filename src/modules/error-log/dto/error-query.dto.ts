import { IsUUID } from '../../../common/validators/any-uuid';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ErrorListQueryDto {
  @IsOptional() @IsIn(['SERVER', 'CLIENT'])
  source?: 'SERVER' | 'CLIENT';

  @IsOptional() @IsIn(['ERROR', 'WARNING'])
  severity?: 'ERROR' | 'WARNING';

  @IsOptional() @IsIn(['HTTP', 'UNHANDLED', 'UI_CRASH', 'UI_ERROR', 'API_ERROR', 'NETWORK'])
  kind?: string;

  @IsOptional() @IsIn(['CUSTOMER', 'SHOP', 'ADMIN'])
  panel?: string;

  @IsOptional() @IsIn(['web', 'android', 'ios'])
  platform?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(599)
  status?: number;

  /** 4xx (mijoz xatolari) | 5xx (server xatolari) | none (status yo‘q: interfeys, tarmoq). */
  @IsOptional() @IsIn(['4xx', '5xx', 'none'])
  statusClass?: '4xx' | '5xx' | 'none';

  @IsOptional() @IsIn(['open', 'resolved'])
  state?: 'open' | 'resolved';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  accountNumber?: number;

  @IsOptional() @IsString() @MaxLength(64)
  fingerprint?: string;

  @IsOptional() @IsString() @MaxLength(200)
  q?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}

export class ErrorGroupsQueryDto {
  @IsOptional() @IsIn(['open', 'resolved'])
  state?: 'open' | 'resolved';

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(599)
  status?: number;

  @IsOptional() @IsIn(['4xx', '5xx', 'none'])
  statusClass?: '4xx' | '5xx' | 'none';

  @IsOptional() @IsIn(['SERVER', 'CLIENT'])
  source?: 'SERVER' | 'CLIENT';

  @IsOptional() @Type(() => Number) @IsIn([1, 7, 30])
  days?: number;
}

export class ResolveErrorsDto {
  @IsOptional() @IsUUID('4', { each: true })
  ids?: string[];

  @IsOptional() @IsString() @MaxLength(64)
  fingerprint?: string;

  @IsOptional()
  value?: boolean;
}

/** Xatolar sahifasi: sana oralig‘i bo‘yicha umumiy ko‘rinish (kartalar, grafik, kategoriyalar). */
export class ErrorOverviewQueryDto {
  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}

/** Xatolar sahifasi: bir xil xatolar guruhlari (sahifalab, filtr va saralash bilan). */
export class ErrorGroupsPageQueryDto {
  @IsOptional() @IsString() @MaxLength(200)
  q?: string;

  @IsOptional() @IsIn(['ERROR', 'WARNING'])
  severity?: 'ERROR' | 'WARNING';

  @IsOptional() @IsIn(['open', 'resolved'])
  state?: 'open' | 'resolved';

  @IsOptional() @IsIn(['SERVER', 'CLIENT'])
  source?: 'SERVER' | 'CLIENT';

  @IsOptional() @IsIn(['CUSTOMER', 'SHOP', 'ADMIN'])
  panel?: string;

  @IsOptional() @IsIn(['4xx', '5xx', 'none'])
  statusClass?: '4xx' | '5xx' | 'none';

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(599)
  status?: number;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @IsIn(['last', 'count', 'users'])
  sort?: 'last' | 'count' | 'users';

  @IsOptional() @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
