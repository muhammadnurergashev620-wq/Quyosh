import { Body, Controller, Get, Header, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { OptionalAuth } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentShop, RequireShopPermission, type ShopContext } from '../../common/decorators/shop-permission.decorator';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { AnalyticsService } from './analytics.service';
import { DashboardService } from './dashboard.service';
import { RangeDto, TrackEventsDto } from './dto/analytics.dto';

@Controller()
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly dashboards: DashboardService,
  ) {}

  /** Klient hodisalari (guest ham). PII qabul qilinmaydi. */
  @OptionalAuth()
  @HttpCode(202)
  @RateLimit({ scope: 'ip', limit: 120, windowSeconds: 60 })
  @Post('analytics/events')
  ingest(@Body() dto: TrackEventsDto, @CurrentUser('sub') userId?: string) {
    return this.analytics.ingest(dto, userId ?? null);
  }

  /** U10.1 mijoz bosh paneli. */
  @Get('me/dashboard')
  customer(@CurrentUser('sub') userId: string) {
    return this.dashboards.customer(userId);
  }
}

@Controller('manage/shops/:shopId')
@UseGuards(ShopAccessGuard)
export class ShopAnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly dashboards: DashboardService,
  ) {}

  /** U11.2 do‘kon bosh paneli (KPI + "Bugun javob bering"). */
  @Get('dashboard')
  dashboard(@CurrentShop() ctx: ShopContext) {
    return this.dashboards.shop(ctx);
  }

  @RequireShopPermission('analytics.read')
  @Get('analytics')
  get(@CurrentShop() ctx: ShopContext, @Query() dto: RangeDto) {
    return this.analytics.shop(ctx, dto);
  }

  @RequireShopPermission('analytics.read')
  @RawResponse()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="analitika.csv"')
  @Get('analytics.csv')
  csv(@CurrentShop() ctx: ShopContext, @Query() dto: RangeDto) {
    return this.analytics.shopCsv(ctx, dto);
  }
}

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminAnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly dashboards: DashboardService,
  ) {}

  @RequiresPermission('REPORTS')
  @Get('analytics/funnel')
  funnel(@Query() dto: RangeDto) {
    return this.analytics.funnel(dto);
  }

  /** U12.1: navbatlar soni (har admin o‘z huquqlari bo‘yicha ko‘radi — UI filtrlaydi). */
  @Get('queues')
  queues() {
    return this.dashboards.adminQueues();
  }
}
