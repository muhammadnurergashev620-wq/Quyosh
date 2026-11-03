import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { AccountType, UserLocale } from '@prisma/client';

export class OrganizationDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  name!: string;

  /** STIR — 9 raqam (TZ 7.2). */
  @Matches(/^\d{9}$/, { message: 'STIR_INVALID' })
  stir!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

/** Profil sozlamalari (TZ 7.2, U10.7): til, hisob turi va yuridik shaxs ma’lumoti. */
export class UpdateProfileDto {
  @IsOptional()
  @IsEnum(UserLocale)
  locale?: UserLocale;

  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationDto)
  organization?: OrganizationDto;
}
