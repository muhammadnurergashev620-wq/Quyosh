import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PolicyType } from '@prisma/client';

export class CreatePolicyDto {
  @IsEnum(PolicyType)
  type!: PolicyType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  version!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
