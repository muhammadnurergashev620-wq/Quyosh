import { IsEnum, IsOptional } from 'class-validator';
import { PolicyStatus, PolicyType } from '@prisma/client';

export class PolicyQueryDto {
  @IsOptional()
  @IsEnum(PolicyType)
  type?: PolicyType;

  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus;
}
