import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetEmailDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  /** Parolli akkauntda majburiy: tasdiqlash kodlari yuboriladigan manzilni faqat egasi o‘zgartira olishi uchun. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}
