import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientErrorDto } from './dto/client-error.dto';
import { ErrorGroupsPageQueryDto, ErrorGroupsQueryDto, ErrorListQueryDto, ErrorOverviewQueryDto, ResolveErrorsDto } from './dto/error-query.dto';
import { ErrorLogService } from './error-log.service';

/** Veb va mobil ilova xatoliklarini qabul qiladi (kirmagan foydalanuvchilarda ham ishlaydi, tezligi cheklangan). */
@Controller('client-errors')
export class ClientErrorController {
  constructor(private readonly errors: ErrorLogService) {}

  @Public()
  @RateLimit({ scope: 'ip', limit: 40, windowSeconds: 60 })
  @HttpCode(202)
  @Post()
  async report(@Body() dto: ClientErrorDto, @Req() req: Request) {
    await this.errors.recordClient(dto, req);
    return { accepted: true };
  }
}

/** Faqat superadmin uchun. */
@Controller('admin/errors')
@Roles(Role.ADMIN)
export class AdminErrorController {
  constructor(private readonly errors: ErrorLogService) {}

  @Get()
  async list(@CurrentUser('sub') adminId: string, @Query() query: ErrorListQueryDto) {
    await this.errors.assertSuperAdmin(adminId);
    return this.errors.list(query);
  }

  @Get('summary')
  async summary(@CurrentUser('sub') adminId: string) {
    await this.errors.assertSuperAdmin(adminId);
    return this.errors.summary();
  }

  @Get('groups')
  async groups(@CurrentUser('sub') adminId: string, @Query() query: ErrorGroupsQueryDto) {
    await this.errors.assertSuperAdmin(adminId);
    return this.errors.groups(query);
  }

  @Get('overview')
  async overview(@CurrentUser('sub') adminId: string, @Query() query: ErrorOverviewQueryDto) {
    await this.errors.assertSuperAdmin(adminId);
    return this.errors.overview(query);
  }

  @Get('groups/page')
  async groupsPage(@CurrentUser('sub') adminId: string, @Query() query: ErrorGroupsPageQueryDto) {
    await this.errors.assertSuperAdmin(adminId);
    return this.errors.groupsPage(query);
  }

  @Get('groups/:fingerprint')
  async groupDetail(@CurrentUser('sub') adminId: string, @Param('fingerprint') fingerprint: string) {
    await this.errors.assertSuperAdmin(adminId);
    if (!/^[0-9a-f]{40}$/i.test(fingerprint)) throw new BadRequestException();
    const detail = await this.errors.groupDetail(fingerprint);
    if (!detail) throw new NotFoundException();
    return detail;
  }

  @Post('resolve')
  async resolve(@CurrentUser('sub') adminId: string, @Body() dto: ResolveErrorsDto) {
    await this.errors.assertSuperAdmin(adminId);
    if (!dto.fingerprint && !dto.ids?.length) throw new BadRequestException();
    return this.errors.resolve(dto, dto.value !== false);
  }
}
