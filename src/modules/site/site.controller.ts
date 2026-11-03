import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { SiteService } from './site.service';
import { SiteBlockDraftDto, SiteBlockReorderDto, SiteBlockUpdateDto } from './site.dto';

@Controller('site')
export class SiteController {
  constructor(private readonly site: SiteService) {}

  @Public()
  @RateLimit({ scope: 'ip', limit: 60, windowSeconds: 60 })
  @Get('home')
  home() {
    return this.site.home();
  }
}

/** Admin: bosh sahifa bloklari (CONTENT ruxsati). */
@Controller('admin/site-blocks')
@Roles(Role.ADMIN)
@RequiresPermission('CONTENT')
export class AdminSiteController {
  constructor(private readonly site: SiteService) {}

  @Get() list() { return this.site.adminList(); }
  @Get('preview') preview() { return this.site.preview(); }
  @Post('reorder') reorder(@Body() dto: SiteBlockReorderDto, @CurrentUser('sub') uid: string) { return this.site.reorder(dto.ids, uid); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SiteBlockUpdateDto, @CurrentUser('sub') uid: string) { return this.site.update(id, dto, uid); }
  @Put(':id/draft') draft(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SiteBlockDraftDto, @CurrentUser('sub') uid: string) { return this.site.saveDraft(id, dto.content, uid); }
  @Post(':id/discard') discard(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') uid: string) { return this.site.discardDraft(id, uid); }
  @Post(':id/publish') publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') uid: string) { return this.site.publish(id, uid); }
  @Get(':id/versions') versions(@Param('id', ParseUUIDPipe) id: string) { return this.site.versions(id); }
  @Post(':id/versions/:versionId/restore') restore(@Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string, @CurrentUser('sub') uid: string) { return this.site.restore(id, versionId, uid); }
}
