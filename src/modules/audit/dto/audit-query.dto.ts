import { IsUUID } from '../../../common/validators/any-uuid';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/cursor-query.dto';

export type ActorRole = 'ADMIN' | 'SHOP' | 'CUSTOMER' | 'SYSTEM';
/** Filtr uchun: USERS — mijoz yoki usta (admin va tizimdan tashqari barcha bajaruvchilar). */
export type ActorRoleFilter = ActorRole | 'USERS';

export class AuditQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  /** Bajaruvchining raqamli ID si (akkaunt raqami). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  actorNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  action?: string;

  /** Amal nomi shu prefiks bilan boshlanadi (masalan, AUTH_, VERIFICATION_). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetType?: string;

  @IsOptional()
  @IsUUID()
  targetId?: string;

  /** Amalni kim bajargani: admin, usta, mijoz yoki tizim (bajaruvchisiz). */
  @IsOptional()
  @IsIn(['ADMIN', 'SHOP', 'CUSTOMER', 'SYSTEM', 'USERS'])
  actorRole?: ActorRoleFilter;

  /** Amal nomi yoki sababdan qidirish. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Sahifalab (raqamli) ko‘rsatish: berilsa, javobda jami son va sahifalar soni bo‘ladi. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  /** SUCCESS — oddiy bajarilgan amallar; FAILED — rad etilgan yoki xato bilan tugaganlar. */
  @IsOptional()
  @IsIn(['SUCCESS', 'FAILED'])
  outcome?: 'SUCCESS' | 'FAILED';

  /** security — xavfsizlik bilan bog‘liq amallar (parol, sessiya, bloklash, huquqlar va h.k.). */
  @IsOptional()
  @IsIn(['security'])
  kind?: 'security';

  /** true — texnik yozuvlar (sessiya tokenini yangilash) ham ko‘rsatiladi. */
  @IsOptional()
  @IsIn(['true'])
  technical?: 'true';
}
