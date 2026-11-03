import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMailDto {
  @IsEmail()
  to!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string;
}
