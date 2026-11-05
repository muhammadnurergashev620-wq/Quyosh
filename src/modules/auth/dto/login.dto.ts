import { IsIn, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { LOGIN_MESSAGE } from '../../../common/utils/login';

export class SignInDto {
  /** Mijoz paneli: telefon raqami. Do‘kon va admin panellarida `login` ishlatiladi. */
  @ValidateIf((o: SignInDto) => !o.login)
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phone?: string;

  /** Do‘kon va admin panellari: administrator bergan login. */
  @ValidateIf((o: SignInDto) => !o.phone)
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/, { message: LOGIN_MESSAGE })
  login?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  /** Kodni SMS orqali olish (standart — email). SMS xizmati ulangan bo‘lishi kerak. */
  @IsOptional()
  @IsIn(['SMS'])
  codeChannel?: 'SMS';
}
