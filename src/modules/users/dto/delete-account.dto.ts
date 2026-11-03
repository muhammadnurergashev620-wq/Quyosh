import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  /** Parolli akkauntda majburiy: akkauntni faqat egasi o‘chira olishi uchun. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}
