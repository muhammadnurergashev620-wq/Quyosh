import { IsNotEmpty, IsOptional, IsPhoneNumber, IsString, Length, Matches } from 'class-validator';

export class VerifyOTPDto {
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
