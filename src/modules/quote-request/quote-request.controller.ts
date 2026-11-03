import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { CurrentShop, RequireShopPermission, type ShopContext } from '../../common/decorators/shop-permission.decorator';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { panelOf } from '../../common/utils/panel';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { QuoteRequestService } from './quote-request.service';
import {
  AddShopsDto, CreateQuoteRequestDto, DeclineDto, LeadNoteDto, MessagesQueryDto, ProposeSiteVisitDto, RevealContactDto, SendMessageDto, ShopRequestsQueryDto, UpdateLeadDto, UpdateSiteVisitDto,
} from './dto/quote-request.dto';

/** Mijoz: taklif so‘rovlari (TZ 9.10). */
@Controller('quote-requests')
export class QuoteRequestsController {
  constructor(private readonly service: QuoteRequestService) {}

  @RateLimit({ scope: 'user', limit: 10, windowSeconds: 3600 })
  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateQuoteRequestDto) {
    return this.service.create(userId, dto);
  }

  @Get('me')
  mine(@CurrentUser('sub') userId: string) {
    return this.service.listMine(userId);
  }

  @Get('limits')
  limits(@CurrentUser('sub') userId: string) {
    return this.service.limits(userId);
  }

  @Get(':id')
  get(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getForCustomer(userId, id);
  }

  @Post(':id/shops')
  addShops(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddShopsDto) {
    return this.service.addShops(userId, id, dto);
  }

  @Post(':id/reveal-contact')
  reveal(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevealContactDto) {
    return this.service.revealContact(userId, id, dto.shopId);
  }

  @Post(':id/close')
  close(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.close(userId, id);
  }
}

/** Yozishma va o‘lchov — ikki tomon (TZ 9.10, U9.3–U9.4). */
@Controller('request-shops')
export class RequestShopsController {
  constructor(private readonly service: QuoteRequestService) {}

  @Get('conversations')
  conversations(@CurrentUser('sub') userId: string) {
    return this.service.customerConversations(userId);
  }

  @Get(':id')
  get(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.conversation(userId, id, panelOf(req));
  }

  @Get(':id/messages')
  messages(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Query() query: MessagesQueryDto, @Req() req: Request) {
    return this.service.messages(userId, id, panelOf(req), query);
  }

  @RateLimit({ scope: 'user', limit: 60, windowSeconds: 60 })
  @Post(':id/messages')
  send(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto, @Req() req: Request) {
    return this.service.sendMessage(userId, id, panelOf(req), dto);
  }

  @Post(':id/messages/read')
  read(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.markRead(userId, id, panelOf(req));
  }

  @Post(':id/site-visits')
  propose(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProposeSiteVisitDto, @Req() req: Request) {
    return this.service.proposeSiteVisit(userId, id, panelOf(req), dto);
  }

  @Patch(':id/site-visits/:visitId')
  updateVisit(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Param('visitId', ParseUUIDPipe) visitId: string, @Body() dto: UpdateSiteVisitDto, @Req() req: Request) {
    return this.service.updateSiteVisit(userId, id, visitId, panelOf(req), dto);
  }

  @RawResponse()
  @Get(':id/site-visits/:visitId/ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="olchov.ics"')
  ics(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Param('visitId', ParseUUIDPipe) visitId: string, @Req() req: Request) {
    return this.service.siteVisitIcs(userId, id, visitId, panelOf(req));
  }
}

/** Do‘kon: kelgan so‘rovlar (inbox) va lead pipeline (TZ 9.x, U11.3). */
@Controller('manage/shops/:shopId/requests')
@UseGuards(ShopAccessGuard)
export class ShopRequestsController {
  constructor(private readonly service: QuoteRequestService) {}

  @RequireShopPermission('requests.read')
  @Get()
  list(@CurrentShop() ctx: ShopContext, @Query() query: ShopRequestsQueryDto) {
    return this.service.listForShop(ctx, query);
  }

  @RequireShopPermission('requests.read')
  @Get(':requestShopId')
  get(@CurrentShop() ctx: ShopContext, @Param('requestShopId', ParseUUIDPipe) id: string) {
    return this.service.getForShop(ctx, id);
  }

  @RequireShopPermission('requests.assign')
  @Patch(':requestShopId')
  update(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('requestShopId', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.service.updateLead(ctx, id, dto, userId);
  }

  @RequireShopPermission('requests.read')
  @Post(':requestShopId/decline')
  decline(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('requestShopId', ParseUUIDPipe) id: string, @Body() dto: DeclineDto) {
    return this.service.decline(ctx, id, dto, userId);
  }

  @RequireShopPermission('requests.read')
  @Get(':requestShopId/notes')
  async notes(@CurrentShop() ctx: ShopContext, @Param('requestShopId', ParseUUIDPipe) id: string) {
    return (await this.service.shopView((await this.service.getForShop(ctx, id)).id)).notes;
  }

  @RequireShopPermission('requests.read')
  @Post(':requestShopId/notes')
  addNote(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('requestShopId', ParseUUIDPipe) id: string, @Body() dto: LeadNoteDto) {
    return this.service.addNote(ctx, id, dto.body, userId);
  }
}
