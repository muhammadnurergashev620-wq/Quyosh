import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PipelineStage, RequestShopStatus, SystemType } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';

export class CreateQuoteRequestDto {
  @IsOptional() @IsUUID() calculationId?: string;
  @IsOptional() @IsUUID() siteId?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsEnum(SystemType) systemType!: SystemType;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.3) @Max(5000) requiredCapacityKw?: number;
  @IsOptional() @IsBoolean() batteryNeeded?: boolean;
  @IsOptional() @IsBoolean() installationNeeded?: boolean;
  @IsOptional() @IsBoolean() financingInterest?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsUUID('all', { each: true }) shopIds!: string[];
}

export class AddShopsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsUUID('all', { each: true }) shopIds!: string[];
}

export class RevealContactDto {
  @IsUUID() shopId!: string;
}

export class SendMessageDto {
  @IsOptional() @IsString() @MaxLength(4000) body?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsUUID('all', { each: true }) attachmentIds?: string[];
  /** Klient tomonidagi id — qayta yuborishda dublikat bo‘lmasin (U9.3). */
  @IsOptional() @IsString() @MaxLength(64) clientId?: string;
  /** Do‘kon: savol sifatida yuborish — CLARIFICATION_REQUESTED (13.1). */
  @IsOptional() @IsBoolean() asClarification?: boolean;
}

export class MessagesQueryDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class SlotDto {
  @IsDateString() start!: string;
  @IsDateString() end!: string;
}

export class ProposeSiteVisitDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => SlotDto) slots!: SlotDto[];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateSiteVisitDto {
  @IsIn(['CONFIRM', 'CANCEL', 'DONE', 'REQUEST_OTHER']) action!: 'CONFIRM' | 'CANCEL' | 'DONE' | 'REQUEST_OTHER';
  @IsOptional() @IsInt() @Min(0) @Max(2) slotIndex?: number;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class ShopRequestsQueryDto {
  @IsOptional() @IsEnum(RequestShopStatus) status?: RequestShopStatus;
  @IsOptional() @IsEnum(PipelineStage) stage?: PipelineStage;
  @IsOptional() @IsIn(['mine']) assigned?: 'mine';
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class UpdateLeadDto {
  @IsOptional() @IsEnum(PipelineStage) pipelineStage?: PipelineStage;
  /** null — tayinlashni olib tashlash. */
  @IsOptional() @IsUUID() assignedMemberId?: string | null;
  @IsOptional() @IsBoolean() unassign?: boolean;
}

export class DeclineDto {
  @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}

export class LeadNoteDto {
  @IsString() @MinLength(1) @MaxLength(4000) body!: string;
}
