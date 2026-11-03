import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CompensationType, CustomerType, FinancingType, PaymentType, SettlementPeriod, TouPeriodType } from '@prisma/client';
import { REGION_KEYS } from '../../../common/constants/regions';

export class TariffTierDto {
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsInt({ each: true }) @Min(1, { each: true }) @Max(12, { each: true }) seasonMonths?: number[];
  @IsOptional() @IsEnum(TouPeriodType) touPeriod?: TouPeriodType;
  @Type(() => Number) @IsNumber() @Min(0) minKwh!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxKwh?: number | null;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1_000_000) ratePerKwh!: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class TouPeriodDto {
  @IsIn(['DAY', 'NIGHT']) touPeriod!: 'DAY' | 'NIGHT';
  @Type(() => Number) @IsInt() @Min(0) @Max(23) startHour!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(24) endHour!: number;
}

export class TariffDto {
  @IsIn(REGION_KEYS) regionCode!: string;
  @IsEnum(CustomerType) customerType!: CustomerType;
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) fixedChargeMonthly?: number | null;
  @IsOptional() @IsBoolean() touEnabled?: boolean;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) @MaxLength(1000) sourceUrl?: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveUntil?: string | null;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => TariffTierDto) tiers!: TariffTierDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => TouPeriodDto) touPeriods?: TouPeriodDto[];
}

export class ExportRuleDto {
  @IsIn(REGION_KEYS) regionCode!: string;
  @IsEnum(CustomerType) customerType!: CustomerType;
  @IsEnum(CompensationType) compensationType!: CompensationType;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) ratePerKwh?: number | null;
  @IsOptional() @IsEnum(SettlementPeriod) settlementPeriod?: SettlementPeriod;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxSystemKw?: number | null;
  @IsOptional() @IsObject() eligibilityJson?: Record<string, unknown>;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) @MaxLength(1000) sourceUrl?: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveUntil?: string | null;
}

export class GridLimitDto {
  @IsIn(REGION_KEYS) regionCode!: string;
  @IsEnum(CustomerType) customerType!: CustomerType;
  @Type(() => Number) @IsNumber() @Min(0.1) @Max(100_000) maxKw!: number;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) @MaxLength(1000) sourceUrl?: string;
  @IsDateString() effectiveFrom!: string;
}

export class FinancingProductDto {
  @IsString() @MinLength(2) @MaxLength(200) providerName!: string;
  @IsEnum(FinancingType) financingType!: FinancingType;
  @Type(() => Number) @IsNumber() @Min(0) @Max(2) annualRate!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(360) minTermMonths!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(360) maxTermMonths!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(24) @IsInt({ each: true }) allowedTerms?: number[];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) minDownPaymentPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxAmount?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) oneTimeFeePct?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) monthlyFee?: number;
  @IsOptional() @IsEnum(PaymentType) paymentType?: PaymentType;
  @IsArray() @ArrayMinSize(1) @IsEnum(CustomerType, { each: true }) customerTypes!: CustomerType[];
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) @MaxLength(1000) sourceUrl?: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveUntil?: string | null;
}

export class SettingsVersionDto {
  @IsString() @Matches(/^[a-z0-9.\-]{3,40}$/) modelVersion!: string;
  @IsObject() parametersJson!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(4000) sourceNotes?: string;
  @IsDateString() effectiveFrom!: string;
}

export class RegionalYieldDto {
  @IsArray() @ArrayMinSize(12) @ArrayMaxSize(12) @Type(() => Number) @IsNumber({}, { each: true }) @Min(0, { each: true }) @Max(400, { each: true }) monthly!: number[];
  @IsOptional() @IsString() @MaxLength(1000) sourceNote?: string;
}

export class CalcAdminQueryDto {
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  @IsOptional() @IsIn(REGION_KEYS) regionCode?: string;
  @IsOptional() @IsEnum(CustomerType) customerType?: CustomerType;
}
