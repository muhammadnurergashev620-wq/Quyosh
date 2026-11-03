import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SetUserStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'BLOCKED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class SetUserPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DeleteUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class RegistrationBlockDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
