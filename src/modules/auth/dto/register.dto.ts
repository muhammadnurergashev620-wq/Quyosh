import { IsUUID } from '../../../common/validators/any-uuid';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEmail, IsLatitude, IsLongitude, IsNumber, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, Matches, MaxLength, Max, Min, MinLength, ValidateNested } from 'class-validator';

/** Qurilma GPS joylashuvi: foydalanuvchi brauzer so‘rovida ruxsat bergan taqdirdagina yuboriladi. */
export class DeviceLocationDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  accuracy?: number;
}

export class RegisterDto {
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @Matches(/\S/, { message: 'firstName kiritilishi shart' })
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @Matches(/\S/, { message: 'lastName kiritilishi shart' })
  @MaxLength(100)
  lastName!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  acceptedPolicyIds!: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceLocationDto)
  location?: DeviceLocationDto;
}
