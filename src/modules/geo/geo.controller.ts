import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { MapService } from './map.service';
import { SitesService } from './sites.service';
import { GeocodingService } from './geocoding.service';
import { BboxQueryDto, CreateSiteDto, GeocodeReverseDto, GeocodeSearchDto, ServingQueryDto, SiteAreaDto, UpdateSiteAreaDto, UpdateSiteDto } from './dto/geo.dto';

/** Ochiq xarita API (TZ 9.8). */
@Public()
@Controller('map')
export class MapController {
  constructor(private readonly map: MapService) {}

  @Get('config')
  config() {
    return this.map.mapConfig();
  }

  @Get('shops')
  shops(@Query() query: BboxQueryDto) {
    return this.map.shops(query);
  }

  @Get('shops/serving')
  serving(@Query() query: ServingQueryDto) {
    return this.map.serving(query);
  }

  @Get('shops/:id')
  card(@Param('id', ParseUUIDPipe) id: string) {
    return this.map.shopCard(id);
  }
}

/** Geocoding: rate limit 30/daqiqa/IP (TZ 10.3); natija saqlanmaydi. */
@Public()
@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @RateLimit({ scope: 'ip', limit: 30, windowSeconds: 60 })
  @Post('search')
  search(@Body() dto: GeocodeSearchDto) {
    return this.geocoding.search(dto.q, dto.lang);
  }

  @RateLimit({ scope: 'ip', limit: 30, windowSeconds: 60 })
  @Post('reverse')
  reverse(@Body() dto: GeocodeReverseDto) {
    return this.geocoding.reverse(dto.lat, dto.lon, dto.lang);
  }
}

/** Mijoz obyektlari — faqat egasi (ownership). */
@Controller('sites')
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.sites.list(userId);
  }

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateSiteDto) {
    return this.sites.create(userId, dto);
  }

  @Get(':id')
  get(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.sites.get(userId, id);
  }

  @Patch(':id')
  update(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSiteDto) {
    return this.sites.update(userId, id, dto);
  }

  @Post(':id/archive')
  archive(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.sites.archive(userId, id);
  }

  @Post(':id/areas')
  addArea(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SiteAreaDto) {
    return this.sites.addArea(userId, id, dto);
  }

  @Patch(':id/areas/:areaId')
  updateArea(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Param('areaId', ParseUUIDPipe) areaId: string, @Body() dto: UpdateSiteAreaDto) {
    return this.sites.updateArea(userId, id, areaId, dto);
  }

  @Delete(':id/areas/:areaId')
  deleteArea(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Param('areaId', ParseUUIDPipe) areaId: string) {
    return this.sites.deleteArea(userId, id, areaId);
  }
}
