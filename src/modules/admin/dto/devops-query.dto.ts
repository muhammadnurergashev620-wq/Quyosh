import { IsIn, IsOptional } from 'class-validator';

export class DevopsQueryDto {
  @IsOptional()
  @IsIn(['1h', '24h', '7d', '30d'])
  window?: '1h' | '24h' | '7d' | '30d';
}
