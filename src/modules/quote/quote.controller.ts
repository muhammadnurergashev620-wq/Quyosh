import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentShop, RequireShopPermission, type ShopContext } from '../../common/decorators/shop-permission.decorator';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { panelOf } from '../../common/utils/panel';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { QuoteService } from './quote.service';
import { buildQuotePdf } from './quote-pdf';
import { BuilderCatalogQueryDto, CreateQuoteDto, QuotePdfQueryDto, RejectQuoteDto, SaveQuoteTemplateDto, UpdateQuoteDto } from './dto/quote.dto';
import { QuoteTemplateService } from './quote-template.service';

/** Takliflar (TZ 9.10, 13.3). Ruxsatlar servisda: do‘kon — quote.*; mijoz — so‘rov egasi. */
@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuoteService) {}

  @Post('quote-requests/:id/quotes')
  create(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) requestId: string, @Body() dto: CreateQuoteDto) {
    return this.quotes.createDraft(userId, requestId, dto);
  }

  @Get('quote-requests/:id/compare')
  compare(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) requestId: string) {
    return this.quotes.compare(userId, requestId);
  }

  @Get('quotes/:id')
  get(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.quotes.get(userId, id, panelOf(req));
  }

  @Get('quotes/:id/revisions/:revision')
  revision(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Param('revision', ParseIntPipe) revision: number, @Req() req: Request) {
    return this.quotes.revision(userId, id, revision, panelOf(req));
  }

  @Patch('quotes/:id')
  update(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.updateDraft(userId, id, dto);
  }

  @Post('quotes/:id/send')
  send(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.send(userId, id);
  }

  @Post('quotes/:id/revise')
  revise(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.revise(userId, id, dto);
  }

  @Post('quotes/:id/withdraw')
  withdraw(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.withdraw(userId, id);
  }

  @Post('quotes/:id/accept')
  accept(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.accept(userId, id);
  }

  @Post('quotes/:id/reject')
  reject(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectQuoteDto) {
    return this.quotes.reject(userId, id, dto);
  }

  @Get('quotes/:id/pdf')
  async pdf(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Query() query: QuotePdfQueryDto, @Req() req: Request, @Res() res: Response) {
    const { view, shop } = await this.quotes.forPdf(userId, id, panelOf(req));
    const buffer = await buildQuotePdf({ lang: query.lang ?? 'uz', view, shop });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="taklif-${view.request.number}-r${view.currentRevision}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(buffer);
  }
}

/** Do‘kon: quote builder yordamchilari. */
@Controller('manage/shops/:shopId')
@UseGuards(ShopAccessGuard)
export class ShopQuotesController {
  constructor(private readonly quotes: QuoteService, private readonly templates: QuoteTemplateService) {}

  @RequireShopPermission('quote.draft')
  @Get('quote-templates')
  listTemplates(@CurrentShop() ctx: ShopContext) {
    return this.templates.list(ctx);
  }

  @RequireShopPermission('quote.draft')
  @Post('quote-templates')
  createTemplate(@CurrentShop() ctx: ShopContext, @Body() dto: SaveQuoteTemplateDto) {
    return this.templates.create(ctx, dto);
  }

  @RequireShopPermission('quote.draft')
  @Put('quote-templates/:templateId')
  updateTemplate(@CurrentShop() ctx: ShopContext, @Param('templateId', ParseUUIDPipe) id: string, @Body() dto: SaveQuoteTemplateDto) {
    return this.templates.update(ctx, id, dto);
  }

  @RequireShopPermission('quote.draft')
  @Delete('quote-templates/:templateId')
  removeTemplate(@CurrentShop() ctx: ShopContext, @Param('templateId', ParseUUIDPipe) id: string) {
    return this.templates.remove(ctx, id);
  }

  @RequireShopPermission('quote.draft')
  @Get('quote-builder/catalog')
  catalog(@CurrentShop() ctx: ShopContext, @Query() query: BuilderCatalogQueryDto) {
    return this.quotes.builderCatalog(ctx, query);
  }

  @RequireShopPermission('requests.read')
  @Get('requests/:requestShopId/quote')
  quote(@CurrentShop() ctx: ShopContext, @Param('requestShopId', ParseUUIDPipe) id: string) {
    return this.quotes.forRequestShop(ctx, id);
  }
}
