import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CertType, SystemType } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';

export class ProjectDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(5000) systemPowerKw?: number;
  @IsOptional() @IsEnum(SystemType) systemType?: SystemType;
  @IsOptional() @IsDateString() completedAt?: string;
  @IsOptional() @IsUUID() installationId?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsBoolean() published?: boolean;
  /** Tartiblangan rasmlar (PORTFOLIO turidagi, shu do‘konga yuklangan). */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) imageIds?: string[];
}

/** Do‘kon belgisi (v3.1): faqat admin qo‘yadi; fayl shart emas. */
export class AdminBadgeDto {
  @IsEnum(CertType) certType!: CertType;
  @IsOptional() @IsString() @MaxLength(120) brand?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) issuer?: string;
  @IsOptional() @IsString() @MaxLength(120) certNumber?: string;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
}

class WidgetThemeDto {
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) primaryColor?: string;
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsIn(['uz', 'oz', 'ru', 'en']) lang?: 'uz' | 'oz' | 'ru' | 'en';
  @IsOptional() @IsBoolean() showLogo?: boolean;
}

export class WidgetConfigDto {
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(253, { each: true }) allowedDomains?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @ValidateNested() @Type(() => WidgetThemeDto) @IsObject() theme?: WidgetThemeDto;
}

export class WidgetEstimateDto {
  @IsString() @MaxLength(32) regionCode!: string;
  @IsNumber() @Min(30) @Max(100_000) monthlyKwh!: number;
  @IsOptional() @IsIn(['SMALL', 'MEDIUM', 'LARGE']) areaPreset?: 'SMALL' | 'MEDIUM' | 'LARGE';
}

export class WidgetOtpDto {
  @IsString() @MinLength(9) @MaxLength(20) phone!: string;
}

export class WidgetLeadDto extends WidgetEstimateDto {
  @IsString() @MinLength(9) @MaxLength(20) phone!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
  @IsString() @MinLength(2) @MaxLength(100) firstName!: string;
  @IsBoolean() consent!: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
