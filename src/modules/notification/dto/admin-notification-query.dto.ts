import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsUUID } from '../../../common/validators/any-uuid';

export class AdminNotificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['PAYMENT', 'DISPUTE', 'DOCUMENT', 'USER', 'ORDER', 'CHAT', 'POST', 'SYSTEM'])
  category?: string;

  @IsOptional()
  @IsIn(['HIGH', 'MEDIUM', 'LOW'])
  priority?: string;

  @IsOptional()
  @IsIn(['UNREAD', 'READ'])
  state?: 'UNREAD' | 'READ';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';
}

export class BulkReadDto {
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];
}
