import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CustomerType, PaymentType, SystemType } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';

/** Pul maydonlari uchun yuqori chegara (so‘m) — juda katta qiymat hisobni Infinity/NaN ga olib bormasin. */
const MAX_MONEY = 1_000_000_000_000;

export class ApplianceDto {
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000) powerW!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(500) count!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(24) hoursPerDay!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsInt({ each: true }) @Min(1, { each: true }) @Max(12, { each: true }) months?: number[];
  @IsOptional() @IsBoolean() isCritical?: boolean;
}

/** TZ 10.1: oylik kWh 1..100 000; nol faqat «hozircha iste’mol yo‘q» bilan. */
export class ConsumptionDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100_000) monthlyKwh?: number;
  @IsOptional() @IsArray() @ArrayMinSize(12) @ArrayMaxSize(12) @Type(() => Number) @IsNumber({}, { each: true }) @Min(0, { each: true }) @Max(100_000, { each: true }) months?: number[];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(1_000_000_000) billAmount?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(80) @ValidateNested({ each: true }) @Type(() => ApplianceDto) appliances?: ApplianceDto[];
  @IsOptional() @IsString() @MaxLength(40) templateCode?: string;
  @IsOptional() @IsBoolean() noConsumptionYet?: boolean;
}

export class FinancingInputDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(2) annualRate?: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(360) termMonths!: number;
  @IsOptional() @IsEnum(PaymentType) paymentType?: PaymentType;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(MAX_MONEY) downPayment?: number;
}

/** Saqlanmagan maydon poligoni (guest yoki chizilayotgan): server tekshiradi va o‘lchaydi, saqlamaydi. */
export class DraftAreaDto {
  @IsObject() polygon!: Record<string, unknown>;
  @IsOptional() @IsIn(['FLAT', 'PITCHED']) roofShape?: 'FLAT' | 'PITCHED';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(90) tiltDeg?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(359) azimuthDeg?: number;
  @IsOptional() @IsIn(['NONE', 'LIGHT', 'HEAVY']) shadingLevel?: 'NONE' | 'LIGHT' | 'HEAVY';
}

/** U8.7: foydalanuvchi kiritgan xarajatlar (so‘m). */
export class CostsDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(MAX_MONEY) equipmentCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(MAX_MONEY) installationCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(MAX_MONEY) deliveryCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(MAX_MONEY) otherCost?: number;
}

export class EstimateDto {
  @IsIn(['QUICK', 'DETAILED']) mode!: 'QUICK' | 'DETAILED';
  @IsOptional() @IsEnum(SystemType) systemType?: SystemType;
  @IsOptional() @IsEnum(CustomerType) customerType?: CustomerType;
  @IsOptional() @IsUUID() siteId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) areaIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => DraftAreaDto) areas?: DraftAreaDto[];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lon?: number;
  /** Tez hisob: «Kichik (≈20 m²) / O‘rtacha (≈40) / Katta (≈80)» (TZ 4.1). */
  @IsOptional() @IsIn(['SMALL', 'MEDIUM', 'LARGE']) areaPreset?: 'SMALL' | 'MEDIUM' | 'LARGE';
  /** Maydon raqam bilan (xarita mavjud bo‘lmaganda — TZ 12.1 fallback). */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(50_000) areaM2?: number;
  @IsOptional() @IsIn(['FLAT', 'PITCHED']) roofShape?: 'FLAT' | 'PITCHED';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(90) tiltDeg?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(359) azimuthDeg?: number;
  @IsOptional() @IsIn(['NONE', 'LIGHT', 'HEAVY']) shadingLevel?: 'NONE' | 'LIGHT' | 'HEAVY';
  @ValidateNested() @Type(() => ConsumptionDto) consumption!: ConsumptionDto;
  @IsOptional() @IsString() @MaxLength(40) loadProfileCode?: string;
  @IsOptional() @IsUUID() panelModelId?: string;
  @IsOptional() @IsUUID() inverterModelId?: string;
  @IsOptional() @IsUUID() batteryModelId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.3) @Max(1000) kwp?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(2000) batteryKwh?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(MAX_MONEY) budget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.5) @Max(72) backupHours?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-0.2) @Max(0.5) tariffGrowth?: number;
  @IsOptional() @ValidateNested() @Type(() => FinancingInputDto) financing?: FinancingInputDto;
  @IsOptional() @ValidateNested() @Type(() => CostsDto) costs?: CostsDto;
}

export class FinancingEstimateDto {
  @Type(() => Number) @IsNumber() @Min(1) @Max(MAX_MONEY) initialCost!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(MAX_MONEY) downPayment?: number;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(2) annualRate?: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(360) termMonths!: number;
  @IsOptional() @IsEnum(PaymentType) paymentType?: PaymentType;
  @IsOptional() @IsArray() @ArrayMinSize(12) @ArrayMaxSize(12) @Type(() => Number) @IsNumber({}, { each: true }) monthlySaving?: number[];
}

export class OutageEstimateDto {
  @IsEnum(SystemType) systemType!: SystemType;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ApplianceDto) criticalItems!: ApplianceDto[];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(2000) batteryKwh?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.5) @Max(500) inverterKw?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.5) @Max(72) backupHours?: number;
}

export class CompatibilityDto {
  @IsUUID() panelModelId!: string;
  @IsUUID() inverterModelId!: string;
  @IsOptional() @IsUUID() batteryModelId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(60) seriesCount!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(40) parallelStrings!: number;
}
