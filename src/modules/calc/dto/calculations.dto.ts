import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { IsUUID } from '../../../common/validators/any-uuid';
import { EstimateDto } from './calc.dto';

export class SaveCalculationDto {
  @ValidateNested() @Type(() => EstimateDto) input!: EstimateDto;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
}

export class CompareCalculationsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(3) @IsUUID('all', { each: true }) ids!: string[];
}

export class ShareDto {
  @IsOptional() @IsIn([7, 30, null]) expiresDays?: 7 | 30 | null;
}

export class DraftDto {
  @IsObject() input!: Record<string, unknown>;
}
