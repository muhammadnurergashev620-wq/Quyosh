import { IsString, Matches, MaxLength } from 'class-validator';

export class UpdateNameDto {
  @IsString()
  @Matches(/\S/, { message: 'firstName kiritilishi shart' })
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @Matches(/\S/, { message: 'lastName kiritilishi shart' })
  @MaxLength(100)
  lastName!: string;
}
