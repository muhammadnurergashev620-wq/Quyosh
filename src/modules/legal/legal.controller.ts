import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { Body, Controller, Get, Ip, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { PolicyQueryDto } from './dto/policy-query.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Public()
  @Get('policies')
  findAll(@Query() query: PolicyQueryDto) {
    return this.legalService.findAll(query);
  }

  @Get('admin/policies')
  @Roles(Role.ADMIN)
  @RequiresPermission('POLICIES')
  findAllForAdmin(@Query() query: PolicyQueryDto) {
    return this.legalService.findAllForAdmin(query);
  }

  @Get('my-acceptances')
  findAllAcceptances(@CurrentUser('sub') userId: string) {
    return this.legalService.findAllAcceptances(userId);
  }

  @Public()
  @Get('policies/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.legalService.findOne(id);
  }

  @Post('policies')
  @Roles(Role.ADMIN)
  @RequiresPermission('POLICIES')
  create(@CurrentUser('sub') adminId: string, @Body() dto: CreatePolicyDto) {
    return this.legalService.create(adminId, dto);
  }

  @Patch('policies/:id')
  @Roles(Role.ADMIN)
  @RequiresPermission('POLICIES')
  update(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.legalService.update(adminId, id, dto);
  }

  @Post('policies/:id/publish')
  @Roles(Role.ADMIN)
  @RequiresPermission('POLICIES')
  publish(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.legalService.publish(adminId, id);
  }

  @Post('policies/:id/accept')
  accept(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.legalService.accept(userId, id, ip);
  }
}
