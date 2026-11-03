import { IsNotEmpty, IsPhoneNumber } from 'class-validator';
export class RequestOtpDto {
  @IsPhoneNumber('UZ') @IsNotEmpty() phone!: string;
}
