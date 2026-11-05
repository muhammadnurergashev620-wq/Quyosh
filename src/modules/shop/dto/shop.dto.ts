import { LOGIN_MESSAGE } from '../../../common/utils/login';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BranchStatus, PricingModel, ServiceType, Currency } from '@prisma/client';
import { IsUUID } from '../../../common/validators/any-uuid';
import { SHOP_PERMISSIONS } from '../../../common/constants/shop-permissions';
import { REGION_KEYS } from '../../../common/constants/regions';

const STIR = /^\d{9}$/;
const PHONE = /^\+?998[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;

export class UpdateShopDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @Matches(PHONE, { message: 'PHONE_INVALID' })
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @Matches(STIR, { message: 'STIR_INVALID' })
  stir?: string;

  @IsOptional()
  @IsUUID()
  logoAssetId?: string;

  @IsOptional()
  @IsUUID()
  coverAssetId?: string;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsIn(['MANAGER', 'STAFF'])
  memberRole?: 'MANAGER' | 'STAFF';

  @IsOptional()
  @IsArray()
  @IsIn([...SHOP_PERMISSIONS], { each: true })
  permissions?: string[];
}

export class BranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsIn(REGION_KEYS)
  regionCode?: string;

  @IsOptional()
  @Matches(PHONE, { message: 'PHONE_INVALID' })
  phone?: string;

  /** {"mon":[["09:00","18:00"]], ...} — U11.8 hafta kunlari jadvali. */
  @IsOptional()
  @IsObject()
  openingHoursJson?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  holidayExceptionsJson?: unknown[];

  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;

  /** Xaritadagi nuqta (TZ 9.7: valid koordinata). Ikkalasi birga beriladi; null — nuqtani olib tashlash. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon?: number | null;
}

export class UpdateBranchDto extends BranchDto {
  /** Optimistic lock (TZ 6.6). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class ServiceDto {
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @IsEnum(PricingModel)
  pricingModel!: PricingModel;

  @IsOptional()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/, { message: 'MONEY_INVALID' })
  price?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** {uz, oz, ru} */
  @IsOptional()
  @IsObject()
  descriptionI18n?: Record<string, string>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  warrantyMonths?: number;

  @IsOptional()
  active?: boolean;
}

export class ReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export class AdminShopQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED'])
  status?: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'SUSPENDED';

  @IsOptional()
  @IsIn(['NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'])
  verificationStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsIn(['SELF', 'ADMIN'])
  source?: 'SELF' | 'ADMIN';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/** TZ 3.7.1: admin do‘kon + egasining hisobini yaratadi (parolni tizim yaratadi). */
export class AdminCreateShopDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Matches(STIR, { message: 'STIR_INVALID' })
  stir!: string;

  @Matches(PHONE, { message: 'PHONE_INVALID' })
  phone!: string;

  @IsIn(REGION_KEYS)
  regionCode!: string;

  /** Birinchi filial manzili. */
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ownerFirstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerLastName?: string;

  /** Egasining logini (administrator beradi): lotin harflari, raqamlar va . _ - */
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/, { message: LOGIN_MESSAGE })
  ownerLogin!: string;

  /** Egasining telefoni (ixtiyoriy, aloqa uchun). */
  @IsOptional()
  @Matches(PHONE, { message: 'PHONE_INVALID' })
  ownerPhone?: string;

  /** Shu telefon bilan boshqa do‘kon bo‘lsa ogohlantirishni tasdiqlab o‘tish (STIR to‘qnashuvi baribir bloklanadi). */
  @IsOptional()
  @IsBoolean()
  confirmDuplicates?: boolean;
}

/** TZ 3.7.2: admin do‘konga xodim qo‘shadi (login + vaqtincha parol). */
export class AdminAddMemberDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  /** Xodimning logini (administrator beradi). */
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/, { message: LOGIN_MESSAGE })
  login!: string;

  /** Xodim telefoni (ixtiyoriy). */
  @IsOptional()
  @Matches(PHONE, { message: 'PHONE_INVALID' })
  phone?: string;

  @IsIn(['MANAGER', 'STAFF'])
  memberRole!: 'MANAGER' | 'STAFF';

  @IsOptional()
  @IsArray()
  @IsIn([...SHOP_PERMISSIONS], { each: true })
  permissions?: string[];
}

/** Egani almashtirish: mavjud a’zo yangi OWNER bo‘ladi, eski ega MANAGER. */
export class ChangeOwnerDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export class DuplicateQueryDto {
  @IsOptional()
  @Matches(STIR, { message: 'STIR_INVALID' })
  stir?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

export class PublicShopQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** Sertifikat belgisi bo‘yicha filtr (TZ 4.11): faqat amaldagi tasdiqlanganlar. */
  @IsOptional()
  @IsIn(['OFFICIAL_DEALER', 'CERTIFIED_INSTALLER', 'LICENSE'])
  cert?: 'OFFICIAL_DEALER' | 'CERTIFIED_INSTALLER' | 'LICENSE';

  @IsOptional()
  @IsEnum(ServiceType)
  service?: ServiceType;

  @IsOptional()
  @IsIn(REGION_KEYS)
  region?: string;

  @IsOptional()
  @IsIn(['rating', 'new', 'name'])
  sort?: 'rating' | 'new' | 'name';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
