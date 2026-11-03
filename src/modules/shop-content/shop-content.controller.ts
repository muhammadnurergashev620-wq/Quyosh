import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentShop, RequireShopPermission, type ShopContext } from '../../common/decorators/shop-permission.decorator';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { clientIpOf } from '../../common/utils/client-ip';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { ShopContentService } from './shop-content.service';
import { WidgetService } from './widget.service';
import { renderEmbedScript, renderWidgetFrame } from './widget-frame';
import { AdminCertQueryDto, CertificationDto, ProjectDto, ReviewCertificationDto, WidgetConfigDto, WidgetEstimateDto, WidgetLeadDto, WidgetOtpDto } from './dto/shop-content.dto';

const apiBase = (req: Request) => {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0];
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host')).split(',')[0];
  return `${proto}://${host}`;
};

/** Do‘kon: portfolio (U11.10), sertifikatlar (U11.12), vidjet (U11.13). */
@Controller('manage/shops/:shopId')
@UseGuards(ShopAccessGuard)
export class ManageShopContentController {
  constructor(
    private readonly content: ShopContentService,
    private readonly widget: WidgetService,
  ) {}

  @Get('projects')
  projects(@CurrentShop() ctx: ShopContext, @Req() req: Request) {
    return this.content.projects(ctx, apiBase(req));
  }

  @RequireShopPermission('portfolio.write')
  @Post('projects')
  createProject(@CurrentShop() ctx: ShopContext, @Body() dto: ProjectDto) {
    return this.content.createProject(ctx, dto);
  }

  @RequireShopPermission('portfolio.write')
  @Put('projects/:id')
  updateProject(@CurrentShop() ctx: ShopContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProjectDto) {
    return this.content.updateProject(ctx, id, dto);
  }

  @RequireShopPermission('portfolio.write')
  @Delete('projects/:id')
  deleteProject(@CurrentShop() ctx: ShopContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.deleteProject(ctx, id);
  }

  @Get('certifications')
  certifications(@CurrentShop() ctx: ShopContext) {
    return this.content.certifications(ctx);
  }

  @RequireShopPermission('shop.profile')
  @Post('certifications')
  createCertification(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Body() dto: CertificationDto) {
    return this.content.createCertification(ctx, dto, userId);
  }

  @RequireShopPermission('shop.profile')
  @Put('certifications/:id')
  updateCertification(@CurrentShop() ctx: ShopContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CertificationDto) {
    return this.content.updateCertification(ctx, id, dto);
  }

  @RequireShopPermission('shop.profile')
  @Delete('certifications/:id')
  deleteCertification(@CurrentShop() ctx: ShopContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.deleteCertification(ctx, id);
  }

  @RequireShopPermission('widget.manage')
  @Get('widget')
  getWidget(@CurrentShop() ctx: ShopContext) {
    return this.widget.get(ctx);
  }

  @RequireShopPermission('widget.manage')
  @Put('widget')
  updateWidget(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Body() dto: WidgetConfigDto) {
    return this.widget.update(ctx, dto, userId);
  }
}

/** Ommaviy: portfolio va vidjet (iframe). */
@Controller()
export class PublicShopContentController {
  constructor(
    private readonly content: ShopContentService,
    private readonly widget: WidgetService,
  ) {}

  @Public()
  @Get('shops/:slug/projects')
  projects(@Param('slug') slug: string, @Req() req: Request) {
    return this.content.publicProjects(slug, apiBase(req));
  }

  /** iframe sahifasi: CSP frame-ancestors faqat allowedDomains (+ do‘kon paneli preview’i). */
  @Public()
  @RateLimit({ scope: 'ip', limit: 120, windowSeconds: 60 })
  @Get('widget/:publicKey/frame')
  async frame(@Param('publicKey') publicKey: string, @Res() res: Response) {
    const data = await this.widget.frame(publicKey);
    const nonce = randomBytes(16).toString('base64');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; form-action 'none'; base-uri 'none'; frame-ancestors ${data.ancestors.join(' ') || "'none'"}`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(renderWidgetFrame({ publicKey, nonce, shopName: data.shopName, theme: data.theme, regions: data.regions, platformUrl: data.platformUrl }));
  }

  @Public()
  @Get('widget/:publicKey/embed.js')
  async embed(@Param('publicKey') publicKey: string, @Req() req: Request, @Res() res: Response) {
    await this.widget.frame(publicKey);
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(renderEmbedScript(`${apiBase(req)}/api/v1/widget/${encodeURIComponent(publicKey)}/frame`, publicKey));
  }

  @Public()
  @RateLimit({ scope: 'ip', limit: 20, windowSeconds: 60 })
  @Post('widget/:publicKey/estimate')
  estimate(@Param('publicKey') publicKey: string, @Body() dto: WidgetEstimateDto) {
    return this.widget.estimate(publicKey, dto, null);
  }

  @Public()
  @RateLimit({ scope: 'ip', limit: 5, windowSeconds: 600 })
  @Post('widget/:publicKey/otp')
  otp(@Param('publicKey') publicKey: string, @Body() dto: WidgetOtpDto, @Req() req: Request) {
    return this.widget.sendOtp(publicKey, dto.phone, clientIpOf(req) ?? null);
  }

  @Public()
  @RateLimit({ scope: 'ip', limit: 10, windowSeconds: 600 })
  @Post('widget/:publicKey/lead')
  lead(@Param('publicKey') publicKey: string, @Body() dto: WidgetLeadDto, @Req() req: Request) {
    return this.widget.lead(publicKey, dto, clientIpOf(req) ?? null);
  }
}

/** Admin: sertifikatlarni tekshirish (TZ 9.11). */
@Controller('admin/certifications')
@Roles(Role.ADMIN)
@RequiresPermission('SHOPS')
export class AdminCertificationsController {
  constructor(private readonly content: ShopContentService) {}

  @Get()
  list(@Query() query: AdminCertQueryDto) {
    return this.content.adminCertifications(query);
  }

  @Patch(':id')
  review(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewCertificationDto) {
    return this.content.reviewCertification(adminId, id, dto);
  }
}
