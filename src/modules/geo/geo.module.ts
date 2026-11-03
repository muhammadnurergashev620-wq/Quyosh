import { Global, Module } from '@nestjs/common';
import { GeoRepository } from './geo.repository';
import { MapService } from './map.service';
import { SitesService } from './sites.service';
import { GeocodingService } from './geocoding.service';
import { GeocodingController, MapController, SitesController } from './geo.controller';

@Global()
@Module({
  controllers: [MapController, GeocodingController, SitesController],
  providers: [GeoRepository, MapService, SitesService, GeocodingService],
  exports: [GeoRepository],
})
export class GeoModule {}
