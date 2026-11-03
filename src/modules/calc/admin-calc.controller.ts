import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsDateString, IsOptional } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { REGION_KEYS } from '../../common/constants/regions';
import { DomainException } from '../../common/exceptions/business.exception';
import { AdminCalcService } from './admin-calc.service';
import { CalcAdminQueryDto, ExportRuleDto, FinancingProductDto, GridLimitDto, RegionalYieldDto, SettingsVersionDto, TariffDto } from './dto/admin-calc.dto';

class UntilDto {
  @IsOptional() @IsDateString() effectiveUntil?: string | null;
}

/** Admin: tariflar, eksport qoidalari va ulanish limitlari (huquq — TARIFFS). */
@Controller('admin')
@Roles(Role.ADMIN)
@RequiresPermission('TARIFFS')
export class AdminTariffsController {
  constructor(private readonly admin: AdminCalcService) {}

  @Get('tariffs')
  tariffs(@Query() query: CalcAdminQueryDto) {
    return this.admin.listTariffs(query);
  }

  @Post('tariffs')
  createTariff(@CurrentUser('sub') actorId: string, @Body() dto: TariffDto) {
    return this.admin.createTariff(actorId, dto);
  }

  @Put('tariffs/:id')
  updateTariff(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TariffDto) {
    return this.admin.updateTariff(actorId, id, dto);
  }

  @Post('tariffs/:id/copy')
  copyTariff(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.copyTariff(actorId, id);
  }

  @Post('tariffs/:id/publish')
  publishTariff(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.setTariffStatus(actorId, id, 'PUBLISHED');
  }

  @Post('tariffs/:id/archive')
  archiveTariff(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.setTariffStatus(actorId, id, 'ARCHIVED');
  }

  @Patch('tariffs/:id/until')
  tariffUntil(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UntilDto) {
    return this.admin.setTariffUntil(actorId, id, dto.effectiveUntil ?? null);
  }

  @Get('export-rules')
  exportRules(@Query() query: CalcAdminQueryDto) {
    return this.admin.listExportRules(query);
  }

  @Post('export-rules')
  createExportRule(@CurrentUser('sub') actorId: string, @Body() dto: ExportRuleDto) {
    return this.admin.saveExportRule(actorId, dto);
  }

  @Put('export-rules/:id')
  updateExportRule(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ExportRuleDto) {
    return this.admin.saveExportRule(actorId, dto, id);
  }

  @Post('export-rules/:id/publish')
  publishExportRule(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.setExportRuleStatus(actorId, id, 'PUBLISHED');
  }

  @Post('export-rules/:id/archive')
  archiveExportRule(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.setExportRuleStatus(actorId, id, 'ARCHIVED');
  }

  @Get('grid-limits')
  gridLimits() {
    return this.admin.listGridLimits();
  }

  @Post('grid-limits')
  createGridLimit(@CurrentUser('sub') actorId: string, @Body() dto: GridLimitDto) {
    return this.admin.createGridLimit(actorId, dto);
  }

  @Post('grid-limits/:id/archive')
  archiveGridLimit(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.setGridLimitStatus(actorId, id, 'ARCHIVED');
  }
}

/** Admin: hisob sozlamalari, moliyalashtirish, viloyat unumdorligi, solar kesh (huquq — CALCULATOR). */
@Controller('admin/calc')
@Roles(Role.ADMIN)
@RequiresPermission('CALCULATOR')
export class AdminCalcController {
  constructor(private readonly admin: AdminCalcService) {}

  @Get('settings')
  settings() {
    return this.admin.listSettings();
  }

  @Get('settings/defaults')
  defaults() {
    return this.admin.defaults();
  }

  @Post('settings')
  createSettings(@CurrentUser('sub') actorId: string, @Body() dto: SettingsVersionDto) {
    return this.admin.createSettings(actorId, dto);
  }

  @Post('settings/:id/publish')
  publishSettings(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.publishSettings(actorId, id);
  }

  @Get('financing')
  financing() {
    return this.admin.listFinancing();
  }

  @Post('financing')
  createFinancing(@CurrentUser('sub') actorId: string, @Body() dto: FinancingProductDto) {
    return this.admin.saveFinancing(actorId, dto);
  }

  @Put('financing/:id')
  updateFinancing(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FinancingProductDto) {
    return this.admin.saveFinancing(actorId, dto, id);
  }

  @Post('financing/:id/publish')
  publishFinancing(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.setFinancingStatus(actorId, id, 'PUBLISHED');
  }

  @Post('financing/:id/archive')
  archiveFinancing(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.setFinancingStatus(actorId, id, 'ARCHIVED');
  }

  @Get('regional-yields')
  regionalYields() {
    return this.admin.listRegionalYields();
  }

  @Put('regional-yields/:regionCode')
  saveRegionalYield(@CurrentUser('sub') actorId: string, @Param('regionCode') regionCode: string, @Body() dto: RegionalYieldDto) {
    if (!(REGION_KEYS as string[]).includes(regionCode)) throw new DomainException(422, 'VALIDATION_ERROR', 'Hudud noto‘g‘ri');
    return this.admin.saveRegionalYield(actorId, regionCode, dto);
  }

  @Get('solar-datasets')
  solarDatasets() {
    return this.admin.solarDatasets();
  }
}
