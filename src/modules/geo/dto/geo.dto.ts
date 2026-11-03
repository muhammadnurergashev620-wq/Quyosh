import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AreaType, RoofShape, ServiceType, ShadingLevel, SiteType } from '@prisma/client';

export class LatLonDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lon!: number;
}

export class BboxQueryDto {
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) west!: number;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) south!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) east!: number;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) north!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(22) zoom!: number;
  @IsOptional() @IsEnum(ServiceType) serviceType?: ServiceType;
}

export class ServingQueryDto extends LatLonDto {
  @IsOptional() @IsEnum(ServiceType) serviceType?: ServiceType;
}

/** Xizmat hududi: GeoJSON (Polygon/MultiPolygon) yoki filial atrofida radius (km). */
export class ServiceAreaDto {
  @IsOptional() @IsObject() geometry?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(80) radiusKm?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsEnum(ServiceType, { each: true }) serviceTypes?: ServiceType[];
}

export class CreateSiteDto extends LatLonDto {
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @IsOptional() @IsEnum(SiteType) siteType?: SiteType;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateSiteDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @IsOptional() @IsEnum(SiteType) siteType?: SiteType;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lon?: number;
}

export class SiteAreaDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsEnum(AreaType) areaType?: AreaType;
  @IsOptional() @IsEnum(RoofShape) roofShape?: RoofShape;
  @IsObject() polygon!: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(90) tiltDeg?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(359) azimuthDeg?: number | null;
  @IsOptional() @IsEnum(ShadingLevel) shadingLevel?: ShadingLevel;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.05) @Max(1) usableFactor?: number;
}

export class UpdateSiteAreaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(AreaType) areaType?: AreaType;
  @IsOptional() @IsEnum(RoofShape) roofShape?: RoofShape;
  @IsOptional() @IsObject() polygon?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(90) tiltDeg?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(359) azimuthDeg?: number | null;
  @IsOptional() @IsEnum(ShadingLevel) shadingLevel?: ShadingLevel;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.05) @Max(1) usableFactor?: number;
}

export class GeocodeSearchDto {
  @IsString() @MinLength(2) @MaxLength(200) q!: string;
  @IsOptional() @IsIn(['uz', 'ru']) lang?: 'uz' | 'ru';
}

export class GeocodeReverseDto extends LatLonDto {
  @IsOptional() @IsIn(['uz', 'ru']) lang?: 'uz' | 'ru';
}
