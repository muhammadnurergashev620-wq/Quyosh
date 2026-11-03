import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { OptionalAuth, Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { clientIpOf } from '../../common/utils/client-ip';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { SupportService } from './support.service';
import { AdminTicketsQueryDto, AdminUpdateTicketDto, AgentMessageDto, CreateTicketDto, GuestOtpDto, RateDto, ReplyTemplateDto, SuggestionsQueryDto, TicketMessageDto } from './dto/support.dto';

/** Yordam markazi (TZ 9.10): egasi; guest — OTP bilan. */
@Controller('support')
export class SupportController {
  constructor(private readonly service: SupportService, private readonly knowledge: KnowledgeService) {}

  @Public() @RateLimit({ scope: 'ip', limit: 60, windowSeconds: 60 }) @Get('suggestions')
  suggestions(@Query() q: SuggestionsQueryDto) {
    return this.knowledge.suggestions(q.q.trim());
  }

  @Public() @RateLimit({ scope: 'ip', limit: 5, windowSeconds: 600 }) @Post('guest-otp')
  guestOtp(@Body() dto: GuestOtpDto, @Req() req: Request) {
    return this.service.guestOtp(dto.phone, clientIpOf(req) ?? null);
  }

  @OptionalAuth() @RateLimit({ scope: 'ip', limit: 10, windowSeconds: 3600 }) @Post('tickets')
  create(@Body() dto: CreateTicketDto, @Req() req: Request, @CurrentUser('sub') userId?: string) {
    return this.service.create(userId ?? null, dto, clientIpOf(req) ?? null);
  }

  @Get('tickets') mine(@CurrentUser('sub') userId: string) { return this.service.mine(userId); }
  @Get('tickets/:id') get(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) { return this.service.get(userId, id); }
  @Post('tickets/:id/messages') reply(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TicketMessageDto) { return this.service.reply(userId, id, dto); }
  @Post('tickets/:id/resolve') resolve(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) { return this.service.resolveByUser(userId, id); }
  @Post('tickets/:id/reopen') reopen(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) { return this.service.reopen(userId, id); }
  @Post('tickets/:id/rate') rate(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RateDto) { return this.service.rate(userId, id, dto.score); }
}

@Controller('admin/support')
@Roles(Role.ADMIN)
@RequiresPermission('SUPPORT')
export class AdminSupportController {
  constructor(private readonly service: SupportService) {}

  @Get('tickets') list(@CurrentUser('sub') adminId: string, @Query() q: AdminTicketsQueryDto) { return this.service.adminList(adminId, q); }
  @Get('tickets/:id') get(@Param('id', ParseUUIDPipe) id: string) { return this.service.adminGet(id); }
  @Patch('tickets/:id') update(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateTicketDto) { return this.service.adminUpdate(adminId, id, dto); }
  @Post('tickets/:id/messages') reply(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AgentMessageDto) { return this.service.adminReply(adminId, id, dto); }
  @Get('reply-templates') templates() { return this.service.templates(); }
  @Post('reply-templates') createTemplate(@Body() dto: ReplyTemplateDto) { return this.service.createTemplate(dto); }
  @Put('reply-templates/:id') updateTemplate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyTemplateDto) { return this.service.updateTemplate(id, dto); }
  @Delete('reply-templates/:id') deleteTemplate(@Param('id', ParseUUIDPipe) id: string) { return this.service.deleteTemplate(id); }
}
