import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetTwoFactorDto {
  @IsBoolean()
  enabled!: boolean;

  /** O‘chirishda majburiy: joriy parol (qurilma o‘g‘irlansa ham himoya o‘chib ketmasligi uchun). */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}
