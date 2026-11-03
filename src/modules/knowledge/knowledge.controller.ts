import { Body, Controller, Get, Header, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { KnowledgeService } from './knowledge.service';
import { ArticleDto, ArticlesQueryDto, CategoryDto, HelpfulDto } from './dto/knowledge.dto';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Public() @Get('categories')
  categories() {
    return this.service.categories();
  }

  @Public() @Get('articles')
  list(@Query() query: ArticlesQueryDto) {
    return this.service.list(query);
  }

  @Public() @Get('beginner')
  beginner() {
    return this.service.beginner();
  }

  @Public() @Get('glossary')
  glossary() {
    return this.service.glossary();
  }

  @Public() @Get('articles/:slug')
  get(@Param('slug') slug: string) {
    return this.service.get(slug);
  }

  @Public() @RateLimit({ scope: 'ip', limit: 30, windowSeconds: 3600 }) @Post('articles/:slug/helpful')
  helpful(@Param('slug') slug: string, @Body() dto: HelpfulDto) {
    return this.service.helpful(slug, dto.helpful);
  }
}

@Controller()
export class SitemapController {
  constructor(private readonly service: KnowledgeService, private readonly config: ConfigService) {}

  @Public() @RawResponse() @Header('Content-Type', 'application/xml; charset=utf-8') @Get('sitemap.xml')
  sitemap() {
    return this.service.sitemap(this.config.get<string>('app.customerUrl', ''));
  }
}

@Controller('admin/knowledge')
@Roles(Role.ADMIN)
@RequiresPermission('CONTENT')
export class AdminKnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Get('articles') list() { return this.service.adminList(); }
  @Get('articles/:id') get(@Param('id', ParseUUIDPipe) id: string) { return this.service.adminGet(id); }
  @Get('preview/:slug') preview(@Param('slug') slug: string) { return this.service.get(slug, true); }
  @Post('articles') create(@Body() dto: ArticleDto, @CurrentUser('sub') uid: string) { return this.service.create(dto, uid); }
  @Put('articles/:id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ArticleDto, @CurrentUser('sub') uid: string) { return this.service.update(id, dto, uid); }
  @Post('categories') createCategory(@Body() dto: CategoryDto) { return this.service.createCategory(dto); }
  @Patch('categories/:id') updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryDto) { return this.service.updateCategory(id, dto); }
}
