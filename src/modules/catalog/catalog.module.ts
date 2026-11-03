import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ShopCatalogService } from './shop-catalog.service';
import { ImportService } from './import.service';
import { ExchangeRateService } from './exchange-rate.service';
import { AdminCatalogController, ManageCatalogController, PublicCatalogController } from './catalog.controller';

@Module({
  controllers: [PublicCatalogController, ManageCatalogController, AdminCatalogController],
  providers: [CatalogService, ShopCatalogService, ImportService, ExchangeRateService],
  exports: [CatalogService, ExchangeRateService],
})
export class CatalogModule {}
