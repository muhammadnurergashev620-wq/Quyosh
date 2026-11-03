import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Currency, ShopProductStatus, StockStatus } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';
import { REGION_KEYS } from '../../../common/constants/regions';

const MONEY = /^\d{1,16}(\.\d{1,2})?$/;
const toBool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);
const toList = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : value);

export class I18nTextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  uz!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  oz?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ru?: string;
}

export class CategoryDto {
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @Matches(/^[a-z0-9-]{2,120}$/, { message: 'SLUG_INVALID' })
  slug!: string;

  @IsObject()
  @Type(() => I18nTextDto)
  nameI18n!: I18nTextDto;

  @IsOptional()
  @IsObject()
  descriptionI18n?: Record<string, string>;

  /** [{key, type: number|string|enum, unit?, label{uz,oz,ru}, options?, filter?: range|select}] */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  attributeSchemaJson?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

/** TZ 7.4 typed xususiyatlar — hammasi ixtiyoriy, kategoriyaga qarab to‘ldiriladi. */
export class ProductSpecsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2_000_000) nominalPowerW?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) efficiencyPct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) widthMm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) heightMm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100_000) weightKg?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-5) @Max(5) tempCoeffPmaxPctPerC?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(2000) vocV?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(2000) vmpV?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1000) iscA?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1000) impA?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10) degradationPctPerYear?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100_000) inverterAcKw?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5000) inverterMaxDcV?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5000) mpptMinV?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5000) mpptMaxV?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5000) mpptMaxCurrentA?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5000) batteryVoltageV?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100_000) batteryCapacityKwh?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) batteryUsableDod?: number;
  @IsOptional() @IsString() @MaxLength(40) batteryChemistry?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000) batteryCycles?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(600) warrantyMonths?: number;
  @IsOptional() @IsObject() specsJson?: Record<string, unknown>;
  @IsOptional() @IsUUID() datasheetFileId?: string;
}

/** Do‘kon yangi model taklif qiladi (PENDING, admin moderatsiyasi). */
export class ProposeModelDto extends ProductSpecsDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  brand!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  model!: string;
}

export class AdminUpdateModelDto extends ProductSpecsDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) brand?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) model?: string;
  @IsOptional() @IsIn(['APPROVED', 'REJECTED']) status?: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(2000) rejectReason?: string;
}

export class MergeModelDto {
  /** Asosiy (qoladigan) model. */
  @IsUUID()
  targetId!: string;
}

export class ModelQueryDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(120) categorySlug?: string;
  @IsOptional() @IsString() @MaxLength(120) brand?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPowerW?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPowerW?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @IsIn(['IN_STOCK', 'ANY']) stock?: 'IN_STOCK' | 'ANY';
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(['price', '-price', 'power', '-power', 'new', 'offers']) sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) limit?: number;
}

export class AdminModelQueryDto {
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'MERGED']) status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MERGED';
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class OfferQueryDto {
  @IsOptional() @IsIn(REGION_KEYS) region?: string;
  @IsOptional() @IsIn(['price', 'updated']) sort?: 'price' | 'updated';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

export class CompareQueryDto {
  @Transform(toList)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class OfferDto {
  @IsOptional() @IsUUID() branchId?: string | null;
  @Matches(MONEY, { message: 'MONEY_INVALID' }) price!: string;
  @IsOptional() @IsEnum(Currency) currency?: Currency;
  @IsOptional() @Transform(toBool) @IsBoolean() vatIncluded?: boolean;
  @IsOptional() @IsEnum(StockStatus) stockStatus?: StockStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) quantity?: number | null;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string | null;
}

export class UpdateOfferDto extends OfferDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class ShopProductDto {
  @IsUUID() productModelId!: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsEnum(ShopProductStatus) status?: ShopProductStatus;
  /** Birinchi narx (ixtiyoriy) — U11.6 «Mahsulot qo‘shish». */
  @IsOptional() @IsObject() @Type(() => OfferDto) offer?: OfferDto;
}

export class UpdateShopProductDto {
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsEnum(ShopProductStatus) status?: ShopProductStatus;
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class ShopProductQueryDto {
  @IsOptional() @IsEnum(ShopProductStatus) status?: ShopProductStatus;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

/** U11.6 ommaviy amallar: narxni foizga o‘zgartirish, zaxira holati, arxivlash. */
export class BulkProductsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsUUID('all', { each: true }) ids!: string[];
  @IsIn(['PRICE_PERCENT', 'STOCK', 'ARCHIVE', 'ACTIVATE']) action!: 'PRICE_PERCENT' | 'STOCK' | 'ARCHIVE' | 'ACTIVATE';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(500) percent?: number;
  @IsOptional() @IsEnum(StockStatus) stockStatus?: StockStatus;
}

export class ExchangeRateQueryDto {
  @IsOptional() @IsEnum(Currency) currency?: Currency;
}
