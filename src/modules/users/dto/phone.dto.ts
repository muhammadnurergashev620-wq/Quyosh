import { IsNotEmpty, IsPhoneNumber, IsString, Length, Matches } from 'class-validator';

export class RequestPhoneDto {
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phone!: string;
}

export class VerifyPhoneDto extends RequestPhoneDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
