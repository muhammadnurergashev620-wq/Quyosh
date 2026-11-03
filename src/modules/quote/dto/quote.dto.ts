import { Type } from 'class-transformer';
import { OmitType } from '@nestjs/mapped-types';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { FinancingType, PaymentType, QuoteItemType, SystemType } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';

export class QuoteItemDto {
  @IsEnum(QuoteItemType) itemType!: QuoteItemType;
  @IsOptional() @IsUUID() productModelId?: string;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(1_000_000) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1e13) unitPrice!: number;
}

export class QuoteFinancingDto {
  @IsEnum(FinancingType) financingType!: FinancingType;
  @IsString() @MinLength(2) @MaxLength(200) providerName!: string;
  /** Yillik stavka ulushda (0.24 = 24 %). */
  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) @Max(1) annualRate!: number;
  @IsInt() @Min(1) @Max(120) termMonths!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(0.9) downPaymentPct?: number;
  @IsOptional() @IsEnum(PaymentType) paymentType?: PaymentType;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class QuoteFieldsDto {
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => QuoteItemDto) items?: QuoteItemDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => QuoteFinancingDto) financingOptions?: QuoteFinancingDto[];
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) deliveryCost?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) otherCosts?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discountAmount?: number;
  @IsOptional() @IsBoolean() vatIncluded?: boolean;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(30) vatRate?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(5000) systemPowerKw?: number;
  @IsOptional() @IsEnum(SystemType) systemType?: SystemType;
  @IsOptional() @IsInt() @Min(0) @Max(600) warrantyEquipmentMonths?: number;
  @IsOptional() @IsInt() @Min(0) @Max(600) warrantyInstallationMonths?: number;
  @IsOptional() @IsString() @MaxLength(4000) warrantyText?: string;
  @IsOptional() @IsInt() @Min(1) @Max(365) durationDays?: number;
  @IsOptional() @IsString() @MaxLength(4000) includedScope?: string;
  @IsOptional() @IsString() @MaxLength(4000) excludedScope?: string;
  @IsOptional() @IsDateString() validUntil?: string;
}

export class CreateQuoteDto extends QuoteFieldsDto {
  @IsUUID() shopId!: string;
}

export class UpdateQuoteDto extends QuoteFieldsDto {
  @IsInt() @Min(1) version!: number;
}

export class RejectQuoteDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class QuotePdfQueryDto {
  @IsOptional() @IsIn(['uz', 'oz', 'ru']) lang?: 'uz' | 'oz' | 'ru';
}

export class BuilderCatalogQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

/** Taklif shabloni (TZ 13.3): qatorlar + standart shartlar; muddat (validUntil) har safar yangidan. */
export class QuoteTemplateDefaultsDto extends OmitType(QuoteFieldsDto, ['items', 'validUntil'] as const) {}

export class SaveQuoteTemplateDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => QuoteItemDto) items!: QuoteItemDto[];
  @IsOptional() @ValidateNested() @Type(() => QuoteTemplateDefaultsDto) defaults?: QuoteTemplateDefaultsDto;
}
