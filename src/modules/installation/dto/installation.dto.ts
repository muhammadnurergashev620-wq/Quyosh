import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { InstallationStatus } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';

export class UpdateInstallationDto {
  @IsIn(['SCHEDULE', 'MARK_INSTALLED', 'CANCEL']) action!: 'SCHEDULE' | 'MARK_INSTALLED' | 'CANCEL';
  @IsOptional() @IsDateString() scheduledDate?: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ChecklistItemDto {
  @IsString() @MaxLength(60) code!: string;
  @IsIn(['OK', 'ISSUE', 'NA']) status!: 'OK' | 'ISSUE' | 'NA';
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsUUID('all', { each: true }) photoFileIds?: string[];
}

export class SaveChecklistDto {
  @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => ChecklistItemDto) items!: ChecklistItemDto[];
}

export class ConfirmInstallationDto {
  /** "Muammo bor" bandlari bo‘lsa — "Baribir tasdiqlash" (13.7). */
  @IsOptional() @IsBoolean() acceptWithIssues?: boolean;
}

export class DisputeDto {
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsUUID('all', { each: true }) photoFileIds?: string[];
}

export class ResolveDisputeDto {
  @IsIn(['CONFIRMED', 'CANCELLED']) decision!: 'CONFIRMED' | 'CANCELLED';
  @IsString() @MinLength(3) @MaxLength(2000) note!: string;
}

export class InstallationsQueryDto {
  @IsOptional() @IsEnum(InstallationStatus) status?: InstallationStatus;
}
