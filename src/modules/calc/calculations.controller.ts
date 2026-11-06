import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalAuth, Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { CalculationsService } from './calculations.service';
import { ReportService } from './report/report.service';
import { IsIn, IsOptional } from 'class-validator';
import { CompareCalculationsDto, DraftDto, SaveCalculationDto, ShareDto } from './dto/calculations.dto';

const DRAFT_COOKIE = 'qs_calc_draft';

class ReportDto {
  @IsOptional() @IsIn(['uz', 'oz', 'ru', 'en']) lang?: 'uz' | 'oz' | 'ru' | 'en';
  @IsOptional() @IsIn(['SHARE', 'CABINET', 'NONE']) qrMode?: 'SHARE' | 'CABINET' | 'NONE';
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('=')) || null;
  }
  return null;
}

/** Saqlangan hisoblar — faqat egasi (TZ 9.9). */
@Controller('calculations')
export class CalculationsController {
  constructor(
    private readonly calculations: CalculationsService,
    private readonly config: ConfigService,
    private readonly reports: ReportService,
  ) {}

  private cookieOptions() {
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>('auth.cookieSameSite', 'lax');
    return { httpOnly: true, sameSite, secure: sameSite === 'none' ? true : this.config.get<boolean>('auth.cookieSecure', true), path: '/api/v1/calculations', maxAge: 7 * 86_400_000 };
  }

  // Draft — guest ham (cookie bo‘yicha), kirgan foydalanuvchi uchun hisobga biriktiriladi.
  @OptionalAuth()
  @Get('draft')
  getDraft(@Req() req: Request, @CurrentUser('sub') userId?: string) {
    return this.calculations.getDraft(readCookie(req, DRAFT_COOKIE), userId ?? null);
  }

  @OptionalAuth()
  @RateLimit({ scope: 'ip', limit: 60, windowSeconds: 60 })
  @Put('draft')
  async saveDraft(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: DraftDto, @CurrentUser('sub') userId?: string) {
    const result = await this.calculations.saveDraft(readCookie(req, DRAFT_COOKIE), userId ?? null, dto.input);
    res.cookie(DRAFT_COOKIE, result.token, this.cookieOptions());
    return { expiresAt: result.expiresAt };
  }

  @OptionalAuth()
  @Delete('draft')
  async deleteDraft(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser('sub') userId?: string) {
    const result = await this.calculations.deleteDraft(readCookie(req, DRAFT_COOKIE), userId ?? null);
    res.clearCookie(DRAFT_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
    return result;
  }

  @Post()
  save(@CurrentUser('sub') userId: string, @Body() dto: SaveCalculationDto) {
    return this.calculations.save(userId, dto.input, dto.title);
  }

  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.calculations.list(userId);
  }

  @Get('compare')
  compare(@CurrentUser('sub') userId: string, @Query() query: CompareCalculationsDto) {
    return this.calculations.compare(userId, query.ids);
  }

  @Get(':id')
  get(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.calculations.get(userId, id);
  }

  @Post(':id/recalculate')
  recalculate(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.calculations.recalculate(userId, id);
  }

  @Post(':id/archive')
  archive(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.calculations.archive(userId, id);
  }

  @Post(':id/share')
  share(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareDto) {
    return this.calculations.share(userId, id, dto.expiresDays);
  }

  @Idempotent()
  @Post(':id/report')
  report(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportDto) {
    return this.reports.create(userId, id, dto.lang ?? 'uz', dto.qrMode ?? 'NONE');
  }

  @Delete(':id/share')
  revoke(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.calculations.revokeShares(userId, id);
  }
}

/** Ulashilgan hisob — ochiq, rate limit. */
@Public()
@Controller('shared')
export class SharedCalculationController {
  constructor(private readonly calculations: CalculationsService) {}

  @RateLimit({ scope: 'ip', limit: 60, windowSeconds: 60 })
  @Get(':token')
  shared(@Param('token') token: string) {
    return this.calculations.shared(token);
  }
}

/** PDF hisobot holati va yuklab olish (egasi; imzolangan havola 10 daqiqa). */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportService) {}

  @Get(':jobId')
  status(@CurrentUser('sub') userId: string, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.reports.status(userId, jobId);
  }

  @Get(':jobId/download')
  download(@CurrentUser('sub') userId: string, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.reports.download(userId, jobId);
  }
}
