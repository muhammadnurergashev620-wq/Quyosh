import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { SupportPriority, SupportStatus } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';
import { SUPPORT_CATEGORIES } from '../sla';

class GuestDto {
  @IsString() @MinLength(9) @MaxLength(20) phone!: string;
  @Matches(/^\d{6}$/) code!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
}

export class CreateTicketDto {
  @IsIn(SUPPORT_CATEGORIES) category!: (typeof SUPPORT_CATEGORIES)[number];
  @IsString() @MinLength(3) @MaxLength(200) subject!: string;
  @IsString() @MinLength(5) @MaxLength(8000) body!: string;
  @IsOptional() @IsIn(['Calculation', 'QuoteRequest', 'Installation', 'Shop']) relatedType?: 'Calculation' | 'QuoteRequest' | 'Installation' | 'Shop';
  @IsOptional() @IsUUID() relatedId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsUUID('all', { each: true }) attachmentIds?: string[];
  @IsOptional() @IsString() @MaxLength(100) requestIdRef?: string;
  /** Kirmagan foydalanuvchi — telefon OTP bilan. */
  @IsOptional() @ValidateNested() @Type(() => GuestDto) guest?: GuestDto;
}

export class GuestOtpDto {
  @IsString() @MinLength(9) @MaxLength(20) phone!: string;
}

export class TicketMessageDto {
  @IsString() @MinLength(1) @MaxLength(8000) body!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsUUID('all', { each: true }) attachmentIds?: string[];
}

export class AgentMessageDto extends TicketMessageDto {
  @IsOptional() @IsBoolean() internal?: boolean;
  /** Javobdan keyin holat: odatda WAITING_USER; RESOLVED — hal qilindi. */
  @IsOptional() @IsIn(['WAITING_USER', 'IN_PROGRESS', 'RESOLVED']) status?: 'WAITING_USER' | 'IN_PROGRESS' | 'RESOLVED';
}

export class RateDto {
  @IsInt() @Min(1) @Max(5) score!: number;
}

export class SuggestionsQueryDto {
  @IsString() @MinLength(3) @MaxLength(200) q!: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
}

export class AdminTicketsQueryDto {
  @IsOptional() @IsEnum(SupportStatus) status?: SupportStatus;
  @IsOptional() @IsEnum(SupportPriority) priority?: SupportPriority;
  @IsOptional() @IsIn(['mine', 'unassigned']) assignee?: 'mine' | 'unassigned';
  @IsOptional() @IsString() @MaxLength(60) search?: string;
}

export class AdminUpdateTicketDto {
  @IsOptional() @IsEnum(SupportStatus) status?: SupportStatus;
  @IsOptional() @IsEnum(SupportPriority) priority?: SupportPriority;
  @IsOptional() @IsUUID() assigneeId?: string | null;
  @IsOptional() @IsBoolean() unassign?: boolean;
}

export class ReplyTemplateDto {
  @IsObject() titleI18n!: Record<string, string>;
  @IsObject() bodyI18n!: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
