import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @IsOptional()
  @IsIn(['android', 'ios', 'web'])
  platform?: 'android' | 'ios' | 'web';

  @IsOptional()
  @IsIn(['customer', 'shop', 'admin'])
  panel?: 'customer' | 'shop' | 'admin';
}

export class RemovePushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}
