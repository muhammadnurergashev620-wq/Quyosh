import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class SiteBlockDraftDto {
  /** { uz: {...}, ru: {...}, oz?: {...} } — maydonlar blok turiga qarab servisda tekshiriladi. */
  @IsObject() content!: Record<string, unknown>;
}

export class SiteBlockUpdateDto {
  @IsOptional() @IsBoolean() hidden?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sortOrder?: number;
}

export class SiteBlockReorderDto {
  @IsArray() @ArrayMaxSize(20) ids!: string[];
}

