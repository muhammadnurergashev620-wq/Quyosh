import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { SystemType } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';

class ComponentDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsNumber() @Min(1) @Max(10000) quantity?: number;
}

class WarrantyDto {
  @IsString() @MinLength(2) @MaxLength(200) component!: string;
  @IsInt() @Min(1) @Max(600) months!: number;
}

/** Platformadan tashqari o‘rnatilgan tizimni qo‘shish. */
export class CreateInstalledSystemDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(5000) systemPowerKw!: number;
  @IsEnum(SystemType) systemType!: SystemType;
  @IsDateString() installedAt!: string;
  @IsOptional() @IsUUID() siteId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ComponentDto) components?: ComponentDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => WarrantyDto) warranties?: WarrantyDto[];
}

export class ReadingDto {
  /** "YYYY-MM" */
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) period!: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) generatedKwh?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1e12) meterReading?: number;
}

export class ReminderActionDto {
  @IsIn(['DONE', 'SNOOZE', 'DISABLE', 'ENABLE']) action!: 'DONE' | 'SNOOZE' | 'DISABLE' | 'ENABLE';
}
