import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopMembersService } from './shop-members.service';
import { ShopOperationsService } from './shop-operations.service';
import { AdminShopsService } from './admin-shops.service';
import { PublicShopsService } from './public-shops.service';
import { AdminShopsController, ManageShopController, PublicShopsController, ShopContactController, ShopController } from './shop.controller';

@Module({
  controllers: [ShopController, AdminShopsController, ManageShopController, ShopContactController, PublicShopsController],
  providers: [ShopService, ShopMembersService, ShopOperationsService, AdminShopsService, PublicShopsService],
  exports: [ShopService],
})
export class ShopModule {}
