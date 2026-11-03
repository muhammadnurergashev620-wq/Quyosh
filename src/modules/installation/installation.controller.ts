import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentShop, RequireShopPermission, type ShopContext } from '../../common/decorators/shop-permission.decorator';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { panelOf } from '../../common/utils/panel';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { InstallationService } from './installation.service';
import { ConfirmInstallationDto, DisputeDto, InstallationsQueryDto, ResolveDisputeDto, SaveChecklistDto, UpdateInstallationDto } from './dto/installation.dto';

/** Montaj va qabul chek-listi (TZ 9.10, 13.7). */
@Controller('installations')
export class InstallationsController {
  constructor(private readonly service: InstallationService) {}

  @Get()
  mine(@CurrentUser('sub') userId: string, @Query() query: InstallationsQueryDto) {
    return this.service.listMine(userId, query);
  }

  @Get(':id')
  get(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.get(userId, id, panelOf(req));
  }

  @Patch(':id')
  update(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInstallationDto, @Req() req: Request) {
    return this.service.update(userId, id, panelOf(req), dto);
  }

  @Get(':id/checklist')
  checklist(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.checklist(userId, id, panelOf(req));
  }

  @Put(':id/checklist')
  saveChecklist(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveChecklistDto) {
    return this.service.saveChecklist(userId, id, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmInstallationDto) {
    return this.service.confirm(userId, id, dto);
  }

  @Post(':id/request-fix')
  requestFix(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.requestFix(userId, id);
  }

  @Post(':id/dispute')
  dispute(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DisputeDto) {
    return this.service.dispute(userId, id, dto);
  }
}

@Controller('manage/shops/:shopId/installations')
@UseGuards(ShopAccessGuard)
export class ShopInstallationsController {
  constructor(private readonly service: InstallationService) {}

  @RequireShopPermission('requests.read')
  @Get()
  list(@CurrentShop() ctx: ShopContext, @Query() query: InstallationsQueryDto) {
    return this.service.listForShop(ctx, query);
  }
}

/** Admin: montaj e’tirozlari (DISPUTED → CONFIRMED/CANCELLED). */
@Controller('admin/installations')
@Roles(Role.ADMIN)
@RequiresPermission('REVIEWS')
export class AdminInstallationsController {
  constructor(private readonly service: InstallationService) {}

  @Get('disputes')
  disputes() {
    return this.service.listDisputes();
  }

  @Post(':id/resolve')
  resolve(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDisputeDto) {
    return this.service.resolveDispute(adminId, id, dto);
  }
}
