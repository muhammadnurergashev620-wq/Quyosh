import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { CurrentShop, RequireShopPermission, type ShopContext } from '../../common/decorators/shop-permission.decorator';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { ERRORS } from '../../common/constants/error-messages';
import { decodeFilename } from '../../common/utils/filename';
import { CatalogService } from './catalog.service';
import { ShopCatalogService } from './shop-catalog.service';
import { ImportService } from './import.service';
import { ExchangeRateService } from './exchange-rate.service';
import { IMPORT_MAX_BYTES, IMPORT_TEMPLATE_CSV } from './import-parse';
import {
  AdminModelQueryDto, AdminUpdateModelDto, BulkProductsDto, CategoryDto, CompareQueryDto, ExchangeRateQueryDto, MergeModelDto, ModelQueryDto, OfferDto, OfferQueryDto, ProposeModelDto, ShopProductDto, ShopProductQueryDto, UpdateOfferDto, UpdateShopProductDto,
} from './dto/catalog.dto';

const sendCsv = (res: Response, filename: string, body: string) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
};

/** Ochiq katalog (TZ 9.5). */
@Public()
@Controller()
export class PublicCatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly rates: ExchangeRateService,
  ) {}

  @Get('categories')
  categories(@Query('parentId') parentId?: string) {
    return this.catalog.categories(parentId || undefined);
  }

  @Get('product-models')
  models(@Query() query: ModelQueryDto) {
    return this.catalog.listModels(query);
  }

  @Get('product-models/brands')
  brands(@Query('categoryId') categoryId?: string) {
    return this.catalog.brands(categoryId || undefined);
  }

  @Get('product-models/compare')
  compare(@Query() query: CompareQueryDto) {
    return this.catalog.compare(query.ids);
  }

  @Get('product-models/:slug')
  model(@Param('slug') slug: string) {
    return this.catalog.modelBySlug(slug);
  }

  @Get('product-models/:slug/offers')
  offers(@Param('slug') slug: string, @Query() query: OfferQueryDto) {
    return this.catalog.offers(slug, query);
  }

  @Get('exchange-rates/latest')
  latestRate(@Query() query: ExchangeRateQueryDto) {
    return this.rates.latestOrThrow(query.currency ?? 'USD');
  }
}

/** Do‘kon katalogi, narxlar va import (TZ 9.7). */
@Controller('manage/shops/:shopId')
@UseGuards(ShopAccessGuard)
export class ManageCatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly products: ShopCatalogService,
    private readonly imports: ImportService,
  ) {}

  @RequireShopPermission('catalog.read')
  @Get('product-models/search')
  searchModels(@CurrentShop() ctx: ShopContext, @Query('q') q = '') {
    return this.catalog.searchForShop(ctx.shopId, q);
  }

  @RequireShopPermission('catalog.write')
  @Post('product-models/propose')
  propose(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Body() dto: ProposeModelDto) {
    return this.catalog.propose(ctx.shopId, userId, dto);
  }

  @RequireShopPermission('catalog.read')
  @Get('products')
  list(@CurrentShop() ctx: ShopContext, @Query() query: ShopProductQueryDto) {
    return this.products.list(ctx.shopId, query);
  }

  @RequireShopPermission('catalog.write')
  @Post('products')
  create(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Body() dto: ShopProductDto) {
    return this.products.create(ctx.shopId, userId, dto);
  }

  @RequireShopPermission('catalog.write')
  @Post('products/bulk')
  bulk(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Body() dto: BulkProductsDto) {
    return this.products.bulk(ctx.shopId, userId, dto);
  }

  @RequireShopPermission('catalog.read')
  @Get('products/:productId')
  get(@CurrentShop() ctx: ShopContext, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.products.get(ctx.shopId, productId);
  }

  @RequireShopPermission('catalog.write')
  @Patch('products/:productId')
  update(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('productId', ParseUUIDPipe) productId: string, @Body() dto: UpdateShopProductDto) {
    return this.products.update(ctx.shopId, userId, productId, dto);
  }

  @RequireShopPermission('catalog.write')
  @Delete('products/:productId')
  archive(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.products.archive(ctx.shopId, userId, productId);
  }

  @RequireShopPermission('catalog.read')
  @Get('products/:productId/offers')
  listOffers(@CurrentShop() ctx: ShopContext, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.products.listOffers(ctx.shopId, productId);
  }

  @RequireShopPermission('offers.write')
  @Post('products/:productId/offers')
  createOffer(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('productId', ParseUUIDPipe) productId: string, @Body() dto: OfferDto) {
    return this.products.createOffer(ctx.shopId, userId, productId, dto);
  }

  @RequireShopPermission('offers.write')
  @Put('products/:productId/offers/:offerId')
  updateOffer(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('productId', ParseUUIDPipe) productId: string, @Param('offerId', ParseUUIDPipe) offerId: string, @Body() dto: UpdateOfferDto) {
    return this.products.updateOffer(ctx.shopId, userId, productId, offerId, dto);
  }

  @RequireShopPermission('offers.write')
  @Delete('products/:productId/offers/:offerId')
  deleteOffer(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('productId', ParseUUIDPipe) productId: string, @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.products.deleteOffer(ctx.shopId, userId, productId, offerId);
  }

  @RequireShopPermission('catalog.write')
  @Get('imports')
  imports_(@CurrentShop() ctx: ShopContext) {
    return this.imports.list(ctx.shopId);
  }

  @RequireShopPermission('catalog.write')
  @Get('imports/template.csv')
  template(@Res() res: Response) {
    sendCsv(res, 'quyosh-import-shablon.csv', `﻿${IMPORT_TEMPLATE_CSV}`);
  }

  @RequireShopPermission('catalog.write')
  @Post('imports')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: IMPORT_MAX_BYTES + 1 } }))
  upload(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException(ERRORS.FILE_REQUIRED);
    return this.imports.upload(ctx.shopId, userId, { buffer: file.buffer, originalname: decodeFilename(file.originalname), size: file.size });
  }

  @RequireShopPermission('catalog.write')
  @Get('imports/:importId')
  getImport(@CurrentShop() ctx: ShopContext, @Param('importId', ParseUUIDPipe) importId: string) {
    return this.imports.get(ctx.shopId, importId);
  }

  @RequireShopPermission('catalog.write')
  @Get('imports/:importId/errors.csv')
  async errors(@CurrentShop() ctx: ShopContext, @Param('importId', ParseUUIDPipe) importId: string, @Res() res: Response) {
    sendCsv(res, `import-xatolar-${importId.slice(0, 8)}.csv`, await this.imports.errorsCsv(ctx.shopId, importId));
  }

  @RequireShopPermission('catalog.write')
  @Post('imports/:importId/apply')
  apply(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('importId', ParseUUIDPipe) importId: string) {
    return this.imports.apply(ctx.shopId, userId, importId);
  }
}

/** Admin: kategoriyalar, model moderatsiyasi, kurslar (TZ 9.9). */
@Controller('admin')
@Roles(Role.ADMIN)
@RequiresPermission('CATALOG')
export class AdminCatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly rates: ExchangeRateService,
  ) {}

  @Get('categories')
  categories() {
    return this.catalog.categories(undefined, true);
  }

  @Post('categories')
  createCategory(@CurrentUser('sub') adminId: string, @Body() dto: CategoryDto) {
    return this.catalog.createCategory(adminId, dto);
  }

  @Put('categories/:id')
  updateCategory(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryDto) {
    return this.catalog.updateCategory(adminId, id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteCategory(adminId, id);
  }

  @Get('product-models')
  models(@Query() query: AdminModelQueryDto) {
    return this.catalog.adminModels(query);
  }

  @Patch('product-models/:id')
  updateModel(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateModelDto) {
    return this.catalog.adminUpdateModel(adminId, id, dto);
  }

  @Post('product-models/:id/merge')
  merge(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MergeModelDto) {
    return this.catalog.merge(adminId, id, dto.targetId);
  }

  @Get('exchange-rates')
  async exchangeRates(@Query() query: ExchangeRateQueryDto) {
    const currency = query.currency ?? 'USD';
    return { latest: await this.rates.latest(currency), history: await this.rates.history(currency) };
  }

  @Post('exchange-rates/refresh')
  refreshRates(@Query() query: ExchangeRateQueryDto) {
    return this.rates.refresh(query.currency ?? 'USD');
  }
}
