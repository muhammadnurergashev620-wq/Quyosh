import { IsUUID } from '../../../common/validators/any-uuid';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsNotEmpty, IsPhoneNumber, IsString, MaxLength, ValidateIf, IsOptional } from 'class-validator';

export class GoogleSignInDto {
  /** Google ID token (hisobni ulash va eski oqim uchun). */
  @ValidateIf((o: GoogleSignInDto) => !o.accessToken)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  credential?: string;

  /** Google OAuth access token (profil + telefon bir martalik ruxsat bilan). */
  @ValidateIf((o: GoogleSignInDto) => !o.credential)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  accessToken?: string;
}

export class GoogleRegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  signupToken!: string;

  @IsOptional()
  @IsPhoneNumber('UZ')
  phone?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  acceptedPolicyIds!: string[];
}
