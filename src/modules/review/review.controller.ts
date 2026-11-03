import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentShop, RequireShopPermission, type ShopContext } from '../../common/decorators/shop-permission.decorator';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { clientIpOf } from '../../common/utils/client-ip';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { ReviewService } from './review.service';
import {
  AdminReviewsQueryDto, ComplaintsQueryDto, CreateComplaintDto, CreateReviewDto, FavoriteDto, ModerateReviewDto, ModerationSettingsDto, PublicReviewsQueryDto, ResolveComplaintDto, ReviewReplyDto,
} from './dto/review.dto';

@Controller()
export class ReviewsController {
  constructor(private readonly service: ReviewService) {}

  @RateLimit({ scope: 'user', limit: 10, windowSeconds: 3600 })
  @Post('reviews')
  create(@CurrentUser('sub') userId: string, @CurrentUser('deviceId') deviceId: string | undefined, @Body() dto: CreateReviewDto, @Req() req: Request) {
    return this.service.create(userId, dto, { ip: clientIpOf(req) ?? null, deviceId: deviceId ?? null });
  }

  @Public()
  @Get('shops/:slug/reviews')
  publicReviews(@Param('slug') slug: string, @Query() query: PublicReviewsQueryDto) {
    return this.service.publicForShop(slug, query);
  }

  @RateLimit({ scope: 'user', limit: 20, windowSeconds: 3600 })
  @Post('complaints')
  complain(@CurrentUser('sub') userId: string, @Body() dto: CreateComplaintDto) {
    return this.service.complain(userId, dto);
  }

  @Get('favorites')
  favorites(@CurrentUser('sub') userId: string) {
    return this.service.favorites(userId);
  }

  @Post('favorites')
  addFavorite(@CurrentUser('sub') userId: string, @Body() dto: FavoriteDto) {
    return this.service.addFavorite(userId, dto);
  }

  @Delete('favorites')
  removeFavorite(@CurrentUser('sub') userId: string, @Query() dto: FavoriteDto) {
    return this.service.removeFavorite(userId, dto);
  }
}

@Controller('manage/shops/:shopId/reviews')
@UseGuards(ShopAccessGuard)
export class ShopReviewsController {
  constructor(private readonly service: ReviewService) {}

  @Get()
  list(@CurrentShop() ctx: ShopContext) {
    return this.service.forShop(ctx);
  }

  @RequireShopPermission('reviews.reply')
  @Post(':reviewId/reply')
  reply(@CurrentShop() ctx: ShopContext, @CurrentUser('sub') userId: string, @Param('reviewId', ParseUUIDPipe) reviewId: string, @Body() dto: ReviewReplyDto) {
    return this.service.reply(ctx, reviewId, userId, dto);
  }
}

/** Admin: sharh moderatsiyasi, shikoyatlar, ModerationSettings (13.4). */
@Controller('admin')
@Roles(Role.ADMIN)
@RequiresPermission('REVIEWS')
export class AdminReviewsController {
  constructor(private readonly service: ReviewService) {}

  @Get('reviews')
  list(@Query() query: AdminReviewsQueryDto) {
    return this.service.adminList(query);
  }

  @Post('reviews/:id/moderate')
  moderate(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateReviewDto) {
    return this.service.moderate(adminId, id, dto);
  }

  @Get('complaints')
  complaints(@Query() query: ComplaintsQueryDto) {
    return this.service.adminComplaints(query);
  }

  @Post('complaints/:id/resolve')
  resolve(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveComplaintDto) {
    return this.service.resolveComplaint(adminId, id, dto.status);
  }

  @Get('moderation-settings')
  settings() {
    return this.service.getModerationSettings();
  }

  @Put('moderation-settings')
  saveSettings(@CurrentUser('sub') adminId: string, @Body() dto: ModerationSettingsDto) {
    return this.service.saveModerationSettings(adminId, dto.rules);
  }
}
