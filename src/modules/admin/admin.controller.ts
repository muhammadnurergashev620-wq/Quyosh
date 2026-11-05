import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { AdminUsersService } from './admin-users.service';
import { AdminBadgesService } from './admin-badges.service';
import { AdminBadgesQueryDto } from './dto/badges-query.dto';
import { AdminDevopsService } from './admin-devops.service';
import { DevopsQueryDto } from './dto/devops-query.dto';
import { DeleteUserDto, RegistrationBlockDto, SetUserPasswordDto, SetUserStatusDto } from './dto/user-action.dto';
import { BulkUserStatusDto, UserQueryDto } from './dto/user-query.dto';
import { CreateAdminDto, SetAdminDelegationDto, SetAdminPermissionsDto, SetSuperAdminDto, SetTwoFactorValueDto } from './dto/admin-account.dto';
import { AdminService } from './admin.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly users: AdminUsersService,
    private readonly badges: AdminBadgesService,
    private readonly devops: AdminDevopsService,
  ) {}

  /** Administratorning o‘z profili (qo‘shimcha huquq talab qilinmaydi). */
  @Get('me/profile')
  myProfile(@CurrentUser('sub') adminId: string) {
    return this.users.myProfile(adminId);
  }

  @RequiresPermission('DEVOPS')
  @Get('devops')
  getDevops(@Query() query: DevopsQueryDto) {
    return this.devops.snapshot(query.window ?? '1h');
  }

  @Get('badges')
  getBadges(@Query() query: AdminBadgesQueryDto) {
    return this.badges.get(query);
  }

  @RequiresPermission('REPORTS')
  @Get('dashboard/overview')
  getOverview(@Query('days') days?: string) {
    return this.adminService.getOverview(days ? Number(days) : undefined);
  }

  @RequiresPermission('REPORTS')
  @Get('dashboard')
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.adminService.getDashboard(query);
  }

  @RequiresPermission('USERS')
  @Get('users')
  findAllUsers(@Query() query: UserQueryDto) {
    return this.users.findAll(query);
  }

  @RequiresPermission('USERS')
  @Get('users/stats')
  userStats() {
    return this.users.stats();
  }

  @RequiresPermission('USERS')
  @Post('users/bulk-status')
  bulkUserStatus(@CurrentUser('sub') adminId: string, @Body() dto: BulkUserStatusDto, @Req() req: Request) {
    return this.users.bulkStatus(adminId, dto, req);
  }

  @RequiresPermission('USERS')
  @Get('users/by-number/:number')
  lookupUser(@Param('number', ParseIntPipe) number: number) {
    return this.users.lookupByNumber(number);
  }

  @RequiresPermission('USERS')
  @Get('users/:id')
  findUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  @RequiresPermission('USERS')
  @Patch('users/:id/status')
  setUserStatus(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
    @Req() req: Request,
  ) {
    return this.users.setStatus(adminId, id, dto, req);
  }

  @RequiresPermission('USERS')
  @Post('users/:id/password')
  setUserPassword(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPasswordDto,
    @Req() req: Request,
  ) {
    return this.users.setPassword(adminId, id, dto, req);
  }

  @RequiresPermission('USERS')
  @Post('users/:id/delete')
  removeUser(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteUserDto,
    @Req() req: Request,
  ) {
    return this.users.remove(adminId, id, dto, req);
  }

  @Get('admins')
  listAdmins(@CurrentUser('sub') adminId: string) {
    return this.users.listAdmins(adminId);
  }

  @Get('admins/:id/details')
  adminDetails(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.adminDetails(adminId, id);
  }

  @Post('admins')
  createAdmin(@CurrentUser('sub') adminId: string, @Body() dto: CreateAdminDto, @Req() req: Request) {
    return this.users.createAdmin(adminId, dto, req);
  }

  @Patch('admins/:id/permissions')
  setAdminPermissions(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAdminPermissionsDto,
    @Req() req: Request,
  ) {
    return this.users.setAdminPermissions(adminId, id, dto, req);
  }

  @Patch('admins/:id/delegation')
  setAdminDelegation(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAdminDelegationDto,
    @Req() req: Request,
  ) {
    return this.users.setAdminDelegation(adminId, id, dto, req);
  }

  @Patch('admins/:id/super')
  setSuperAdmin(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSuperAdminDto,
    @Req() req: Request,
  ) {
    return this.users.setSuperAdmin(adminId, id, dto.value, req);
  }

  @Patch('users/:id/two-factor')
  setUserTwoFactor(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTwoFactorValueDto,
    @Req() req: Request,
  ) {
    return this.users.setUserTwoFactor(adminId, id, dto.enabled, req);
  }

  @RequiresPermission('USERS')
  @Post('users/:id/registration-block')
  blockRegistration(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrationBlockDto,
    @Req() req: Request,
  ) {
    return this.users.setRegistrationBlock(adminId, id, true, dto, req);
  }

  @RequiresPermission('USERS')
  @Post('users/:id/registration-unblock')
  unblockRegistration(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrationBlockDto,
    @Req() req: Request,
  ) {
    return this.users.setRegistrationBlock(adminId, id, false, dto, req);
  }
}
