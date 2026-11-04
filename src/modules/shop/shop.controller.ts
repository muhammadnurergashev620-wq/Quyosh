import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { CurrentShop, RequireShopPermission, type ShopContext } from '../../common/decorators/shop-permission.decorator';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { ShopService } from './shop.service';
import { ServiceAreaDto } from '../geo/dto/geo.dto';
import { ShopMembersService } from './shop-members.service';
import { ShopOperationsService } from './shop-operations.service';
import { AdminShopsService } from './admin-shops.service';
import { PublicShopsService } from './public-shops.service';
import {
  AdminAddMemberDto, AdminCreateShopDto, AdminShopQueryDto, BranchDto, ChangeOwnerDto, DuplicateQueryDto, PublicShopQueryDto, ReasonDto, ServiceDto, UpdateBranchDto, UpdateMemberDto, UpdateShopDto,
} from './dto/shop.dto';

/** Foydalanuvchining o‘z do‘konlari (do‘kon almashtirgich). Do‘kon ochish va taklif qabul qilish yo‘q (v3.1: do‘konni admin yaratadi). */
@Controller()
export class ShopController {
  constructor(private readonly shops: ShopService) {}

  @Get('me/shops')
  myShops(@CurrentUser('sub') userId: string) {
    return this.shops.myShops(userId);
  }
}

/** Ochiq katalog: tasdiqlangan do‘konlar. */
@Public()
@Controller('shops')
export class PublicShopsController {
  constructor(private readonly publicShops: PublicShopsService) {}

  @Get()
  list(@Query() query: PublicShopQueryDto) {
    return this.publicShops.list(query);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.publicShops.bySlug(slug);
  }

  @Get(':slug/products')
  products(@Param('slug') slug: string, @Query('page') page?: string) {
    return this.publicShops.products(slug, Math.max(1, Number(page) || 1));
  }
}

/** To‘liq aloqa ma’lumoti — faqat tizimga kirgan foydalanuvchiga (U7.4). */
@Controller('shops')
export class ShopContactController {
  constructor(private readonly publicShops: PublicShopsService) {}

  @Get(':slug/contact')
  contact(@Param('slug') slug: string) {
    return this.publicShops.contact(slug);
  }
}

/** Do‘kon paneli: /manage/shops/:shopId/* — a’zolik va ruxsat ShopAccessGuard’da. */
@Controller('manage/shops/:shopId')
@UseGuards(ShopAccessGuard)
export class ManageShopController {
  constructor(
    private readonly shops: ShopService,
    private readonly members: ShopMembersService,
    private readonly ops: ShopOperationsService,
  ) {}

  @Get()
  get(@CurrentShop() ctx: ShopContext) {
    return this.shops.getManaged(ctx);
  }

  @RequireShopPermission('shop.profile')
  @Patch()
  update(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Body() dto: UpdateShopDto) {
    return this.shops.updateProfile(ctx, userId, dto);
  }

  @RequireShopPermission('members.manage')
  @Get('members')
  listMembers(@CurrentShop() ctx: ShopContext) {
    return this.members.listMembers(ctx.shopId);
  }

  @RequireShopPermission('members.manage')
  @Patch('members/:memberId')
  updateMember(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('memberId', ParseUUIDPipe) memberId: string, @Body() dto: UpdateMemberDto) {
    return this.members.updateMember(ctx, userId, memberId, dto);
  }

  @RequireShopPermission('members.manage')
  @Delete('members/:memberId')
  removeMember(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.members.removeMember(ctx, userId, memberId);
  }

  @Get('branches')
  branches(@CurrentShop() ctx: ShopContext) {
    return this.ops.listBranches(ctx.shopId);
  }

  @RequireShopPermission('branches.write')
  @Post('branches')
  createBranch(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Body() dto: BranchDto) {
    return this.ops.createBranch(ctx.shopId, userId, dto);
  }

  @RequireShopPermission('branches.write')
  @Put('branches/:branchId')
  updateBranch(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('branchId', ParseUUIDPipe) branchId: string, @Body() dto: UpdateBranchDto) {
    return this.ops.updateBranch(ctx.shopId, userId, branchId, dto);
  }

  @RequireShopPermission('branches.write')
  @Delete('branches/:branchId')
  archiveBranch(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.ops.archiveBranch(ctx.shopId, userId, branchId);
  }

  @Get('branches/:branchId/service-area')
  serviceArea(@CurrentShop() ctx: ShopContext, @Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.ops.getServiceArea(ctx.shopId, branchId);
  }

  @RequireShopPermission('branches.write')
  @Put('branches/:branchId/service-area')
  putServiceArea(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('branchId', ParseUUIDPipe) branchId: string, @Body() dto: ServiceAreaDto) {
    return this.ops.putServiceArea(ctx.shopId, userId, branchId, dto);
  }

  @RequireShopPermission('branches.write')
  @Delete('branches/:branchId/service-area')
  deleteServiceArea(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.ops.deleteServiceArea(ctx.shopId, userId, branchId);
  }

  @Get('services')
  services(@CurrentShop() ctx: ShopContext) {
    return this.ops.listServices(ctx.shopId);
  }

  @RequireShopPermission('services.write')
  @Post('services')
  createService(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Body() dto: ServiceDto) {
    return this.ops.createService(ctx.shopId, userId, dto);
  }

  @RequireShopPermission('services.write')
  @Put('services/:serviceId')
  updateService(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('serviceId', ParseUUIDPipe) serviceId: string, @Body() dto: ServiceDto) {
    return this.ops.updateService(ctx.shopId, userId, serviceId, dto);
  }

  @RequireShopPermission('services.write')
  @Delete('services/:serviceId')
  deleteService(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.ops.deleteService(ctx.shopId, userId, serviceId);
  }
}

/** Admin: /admin/shops/* (huquq — SHOPS). Parol bor javoblar (create, members, reset-password) vaqtincha parolni bir marta qaytaradi. */
@Controller('admin/shops')
@Roles(Role.ADMIN)
@RequiresPermission('SHOPS')
export class AdminShopsController {
  constructor(private readonly admin: AdminShopsService) {}

  @Get()
  list(@Query() query: AdminShopQueryDto) {
    return this.admin.list(query);
  }

  @Get('duplicates')
  duplicates(@Query() query: DuplicateQueryDto) {
    return this.admin.duplicates(query.stir, query.phone);
  }

  @Post()
  create(@CurrentUser('sub') adminId: string, @Body() dto: AdminCreateShopDto) {
    return this.admin.create(adminId, dto);
  }

  @Get(':shopId')
  detail(@Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.admin.detail(shopId);
  }

  @Post(':shopId/members')
  addMember(@CurrentUser('sub') adminId: string, @Param('shopId', ParseUUIDPipe) shopId: string, @Body() dto: AdminAddMemberDto) {
    return this.admin.addMember(adminId, shopId, dto);
  }

  @Post(':shopId/members/:userId/reset-password')
  resetPassword(@CurrentUser('sub') adminId: string, @Param('shopId', ParseUUIDPipe) shopId: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.resetMemberPassword(adminId, shopId, userId);
  }

  @Post(':shopId/owner')
  changeOwner(@CurrentUser('sub') adminId: string, @Param('shopId', ParseUUIDPipe) shopId: string, @Body() dto: ChangeOwnerDto) {
    return this.admin.changeOwner(adminId, shopId, dto.userId, dto.reason);
  }

  @Post(':shopId/suspend')
  suspend(@CurrentUser('sub') adminId: string, @Param('shopId', ParseUUIDPipe) shopId: string, @Body() dto: ReasonDto) {
    return this.admin.suspend(adminId, shopId, dto.reason);
  }

  @Post(':shopId/resume')
  resume(@CurrentUser('sub') adminId: string, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.admin.resume(adminId, shopId);
  }
}
