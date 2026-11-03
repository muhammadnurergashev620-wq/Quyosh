import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsObject, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { IsUUID } from '../../../common/validators/any-uuid';

/** Klient hodisalari allowlist’i (PII yo‘q). */
export const CLIENT_EVENTS = ['home_view', 'page_view', 'calc_started', 'calc_result', 'shop_view', 'product_view', 'knowledge_view', 'cta_click'] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

class EventDto {
  @IsIn(CLIENT_EVENTS) eventType!: ClientEvent;
  @IsOptional() @IsUUID() shopId?: string;
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsString() @MaxLength(32) regionCode?: string;
  @IsOptional() @IsObject() properties?: Record<string, unknown>;
}

export class TrackEventsDto {
  @Matches(/^[A-Za-z0-9_-]{8,64}$/) anonymousId!: string;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => EventDto) events!: EventDto[];
}

export class RangeDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(32) region?: string;
}
