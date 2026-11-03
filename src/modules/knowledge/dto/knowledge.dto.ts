import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ArticleType, CtaType, PublishStatus } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';

export class ArticlesQueryDto {
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsEnum(ArticleType) type?: ArticleType;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class HelpfulDto {
  @IsBoolean() helpful!: boolean;
}

export class CategoryDto {
  @Matches(/^[a-z0-9-]{2,120}$/) slug!: string;
  @IsObject() nameI18n!: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class ArticleDto {
  @Matches(/^[a-z0-9-]{2,160}$/) slug!: string;
  @IsEnum(ArticleType) articleType!: ArticleType;
  @IsUUID() categoryId!: string;
  @IsObject() titleI18n!: Record<string, string>;
  @IsObject() summaryI18n!: Record<string, string>;
  @IsObject() bodyI18n!: Record<string, string>;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) @MaxLength(500) videoUrl?: string | null;
  @IsOptional() @IsUUID() coverFileId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsObject() seoTitleI18n?: Record<string, string>;
  @IsOptional() @IsObject() seoDescriptionI18n?: Record<string, string>;
  @IsOptional() @IsEnum(CtaType) ctaType?: CtaType;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { each: true }) @MaxLength(1000, { each: true }) sourceUrls?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(10) beginnerOrder?: number | null;
  @IsOptional() @IsDateString() verifiedAt?: string | null;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: PublishStatus;
}
