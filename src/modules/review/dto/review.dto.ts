import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ComplaintReason, ComplaintStatus, ComplaintTargetType, ModerationStatus } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';

export class CreateReviewDto {
  @IsUUID() installationId!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class ReviewReplyDto {
  @IsString() @MinLength(2) @MaxLength(2000) body!: string;
}

export class ModerateReviewDto {
  @IsIn(['PUBLISHED', 'HIDDEN']) decision!: 'PUBLISHED' | 'HIDDEN';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class AdminReviewsQueryDto {
  @IsOptional() @IsEnum(ModerationStatus) status?: ModerationStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class CreateComplaintDto {
  @IsEnum(ComplaintTargetType) targetType!: ComplaintTargetType;
  @IsUUID() targetId!: string;
  @IsEnum(ComplaintReason) reason!: ComplaintReason;
  @IsOptional() @IsString() @MaxLength(2000) details?: string;
}

export class ResolveComplaintDto {
  @IsIn(['RESOLVED', 'REJECTED']) status!: 'RESOLVED' | 'REJECTED';
}

export class ComplaintsQueryDto {
  @IsOptional() @IsEnum(ComplaintStatus) status?: ComplaintStatus;
}

export class FavoriteDto {
  @IsOptional() @IsUUID() shopId?: string;
  @IsOptional() @IsUUID() productModelId?: string;
}

export class ModerationSettingsDto {
  @IsObject() rules!: Record<string, unknown>;
}

export class PublicReviewsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(50) limit?: number;
}
