import { IsUUID } from '../../../common/validators/any-uuid';
import { IsEnum, IsIn, IsNotEmpty } from 'class-validator';
import { MediaAssetKind } from '@prisma/client';

export class InitiateUploadDto {
  @IsEnum(MediaAssetKind)
  kind!: MediaAssetKind;

  @IsIn(['Shop', 'User', 'RequestShop', 'Installation'])
  linkType!: 'Shop' | 'User' | 'RequestShop' | 'Installation';

  @IsUUID()
  @IsNotEmpty()
  linkId!: string;
}
