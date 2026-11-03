import { Type } from 'class-transformer';
import { UserStatus } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsUUID } from '../../../common/validators/any-uuid';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class UserQueryDto extends CursorQueryDto {
  // Adminlar bu ro‘yxatda hech qachon ko‘rinmasligi kerak (faqat mijoz/usta boshqaruvi uchun),
  // shuning uchun rol filtri ham ADMIN’ni qabul qilmaydi — aks holda admin boshqa adminlarni
  // shu umumiy ro‘yxatdan ochiq qidirib topa olardi.
  @IsOptional()
  @IsIn(['CUSTOMER', 'SHOP'])
  role?: 'CUSTOMER' | 'SHOP';

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Sahifalab (raqamli) ko‘rsatish: berilsa, javobda jami son va sahifalar soni ham bo‘ladi (cursor ishlatilmaydi). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @IsOptional()
  @IsIn(['createdAt', 'lastLoginAt', 'name'])
  sort?: 'createdAt' | 'lastLoginAt' | 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  /** Ro‘yxatdan o‘tgan sana oralig‘i. */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

}

export class BulkUserStatusDto {
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];

  @IsIn(['ACTIVE', 'SUSPENDED', 'BLOCKED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
