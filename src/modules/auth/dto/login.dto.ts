import { IsIn, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

export class SignInDto {
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  /** Kodni SMS orqali olish (standart — email). SMS xizmati ulangan bo‘lishi kerak. */
  @IsOptional()
  @IsIn(['SMS'])
  codeChannel?: 'SMS';
}
