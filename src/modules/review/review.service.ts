import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import { tashkentDate } from '../../common/utils/tashkent-date';
import { ShopService } from '../shop/shop.service';
import { M6Notifier } from '../quote-request/m6-notifier.service';
import { DEFAULT_MODERATION_RULES, scoreReviewRisk, type ModerationRules } from './review-risk';
import type { AdminReviewsQueryDto, ComplaintsQueryDto, CreateComplaintDto, CreateReviewDto, FavoriteDto, ModerateReviewDto, PublicReviewsQueryDto, ReviewReplyDto } from './dto/review.dto';

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;

export interface ClientFingerprint {
  ip: string | null;
  deviceId: string | null;
}

/** Sharhlar, javoblar, shikoyatlar va sevimlilar (TZ 7.7, 13.4). */
@Injectable()
export class ReviewService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly notify: M6Notifier,
  ) {}

  private hash(value: string | null) {
    if (!value) return null;
    return createHash('sha256').update(`${this.config.get<string>('auth.jwtSecret') ?? ''}:${value}`).digest('hex');
  }

  async rules(): Promise<ModerationRules> {
    const row = await this.db.moderationSettings.findFirst({ where: { active: true }, select: { rulesJson: true } });
    const stored = (row?.rulesJson ?? {}) as Partial<ModerationRules>;
    return { ...DEFAULT_MODERATION_RULES, ...stored, scores: { ...DEFAULT_MODERATION_RULES.scores, ...(stored.scores ?? {}) } };
  }

  // ───────────── Sharh yaratish ─────────────

  async create(userId: string, dto: CreateReviewDto, fp: ClientFingerprint) {
    const inst = await this.db.installation.findUnique({ where: { id: dto.installationId }, select: { id: true, userId: true, shopId: true, status: true, installedAt: true, confirmedAt: true, review: { select: { id: true } } } });
    if (!inst || inst.userId !== userId || inst.status !== 'CONFIRMED') throw new DomainException(HttpStatus.FORBIDDEN, 'REVIEW_NOT_ALLOWED', ERRORS.REVIEW_NOT_ALLOWED);
    if (inst.review) throw new DomainException(HttpStatus.CONFLICT, 'REVIEW_EXISTS', ERRORS.REVIEW_EXISTS);

    const rules = await this.rules();
    const now = Date.now();
    const comment = dto.comment?.trim() || null;
    const ipHash = this.hash(fp.ip);
    const deviceHash = this.hash(fp.deviceId);
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });

    const [member, memberIds, recentShopReviews, otherCalcs, otherRequests] = await Promise.all([
      this.db.shopMember.findUnique({ where: { shopId_userId: { shopId: inst.shopId, userId } }, select: { id: true } }),
      this.db.shopMember.findMany({ where: { shopId: inst.shopId }, select: { userId: true } }),
      this.db.review.count({ where: { shopId: inst.shopId, createdAt: { gte: new Date(now - rules.burstWindowHours * 3_600_000) } } }),
      this.db.calculation.count({ where: { userId } }),
      this.db.quoteRequest.count({ where: { userId } }),
    ]);
    // Oxirgi 90 kunda a’zolikdan chiqarilganlar ham (audit jurnali: SHOP_MEMBER_REMOVED.before.userId).
    const formerMember = member
      ? true
      : (await this.db.auditLog.count({
          where: { targetType: 'Shop', targetId: inst.shopId, action: 'SHOP_MEMBER_REMOVED', before: { path: ['userId'], equals: userId }, createdAt: { gte: new Date(now - rules.selfReviewLookbackDays * DAY) } },
        })) > 0;

    const memberUserIds = memberIds.map((m) => m.userId).filter((id) => id !== userId);
    let sharedDevice = false;
    if (memberUserIds.length && (fp.deviceId || fp.ip)) {
      sharedDevice =
        (await this.db.deviceSession.count({
          where: {
            userId: { in: memberUserIds },
            lastSeenAt: { gte: new Date(now - rules.sharedDeviceLookbackDays * DAY) },
            OR: [...(fp.deviceId ? [{ deviceId: fp.deviceId }] : []), ...(fp.ip ? [{ ipAddress: fp.ip }] : [])],
          },
        })) > 0;
    }

    let maxSimilarity = 0;
    if (comment && comment.length >= 10) {
      const rows = await this.db.$queryRaw<Array<{ s: number }>>`
        SELECT COALESCE(MAX(similarity(comment, ${comment})), 0)::float AS s FROM reviews WHERE shop_id = ${inst.shopId}::uuid AND comment IS NOT NULL`;
      maxSimilarity = Number(rows[0]?.s ?? 0);
    }

    let ipDistinctAccounts = 1;
    if (ipHash) {
      const rows = await this.db.review.findMany({ where: { ipHash, createdAt: { gte: new Date(now - rules.ipClusterLookbackDays * DAY) }, userId: { not: userId } }, distinct: ['userId'], select: { userId: true } });
      ipDistinctAccounts = rows.length + 1;
    }

    const risk = scoreReviewRisk(
      {
        selfReview: formerMember,
        sharedDeviceWithShop: sharedDevice,
        accountAgeDays: (now - user.createdAt.getTime()) / DAY,
        hasOtherActivity: otherCalcs > 0 || otherRequests > 1,
        confirmDelayHours: inst.installedAt && inst.confirmedAt ? (inst.confirmedAt.getTime() - inst.installedAt.getTime()) / 3_600_000 : null,
        recentShopReviews,
        maxSimilarity,
        ipDistinctAccounts,
        comment,
      },
      rules,
    );

    const review = await this.db.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          userId, shopId: inst.shopId, installationId: inst.id, rating: dto.rating, comment,
          moderationStatus: risk.blocked ? 'HIDDEN' : risk.status, moderatedAt: risk.blocked ? new Date() : null,
          riskFlags: risk.flags, riskScore: risk.score, ipHash, deviceHash,
        },
      });
      if (created.moderationStatus === 'PUBLISHED') await this.afterPublished(tx, created.id);
      if (risk.blocked || risk.flags.includes('SHARED_DEVICE_WITH_SHOP')) await this.maybeAutoComplaint(tx, inst.shopId, rules);
      return created;
    });
    if (risk.blocked) throw new DomainException(HttpStatus.FORBIDDEN, 'REVIEW_SELF_BLOCKED', ERRORS.REVIEW_SELF_BLOCKED);
    // Sabablar foydalanuvchiga ko‘rsatilmaydi — faqat holat (13.4).
    return { id: review.id, moderationStatus: review.moderationStatus };
  }

  /** E’lon qilingandan keyin: reyting qayta hisoblanadi, do‘konga REVIEW_PUBLISHED. */
  private async afterPublished(tx: Tx, reviewId: string) {
    const review = await tx.review.findUniqueOrThrow({ where: { id: reviewId }, select: { shopId: true, rating: true } });
    await this.recomputeRating(tx, review.shopId);
    await this.notify.toShop(tx, review.shopId, { type: 'REVIEW_PUBLISHED', title: 'Yangi sharh', body: `Mijoz ${review.rating}★ baho qoldirdi.`, entityType: 'Review', entityId: reviewId }, { permission: 'reviews.reply' });
  }

  private async recomputeRating(tx: Tx, shopId: string) {
    const agg = await tx.review.aggregate({ where: { shopId, moderationStatus: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } });
    await tx.shop.update({ where: { id: shopId }, data: { ratingAvg: new Prisma.Decimal(agg._avg.rating ?? 0).toDecimalPlaces(2), ratingCount: agg._count._all } });
  }

  /** 13.4: 30 kunda ≥ 3 ta SELF_REVIEW/SHARED_DEVICE sababli rad etilgan sharh → avtomatik shikoyat (ochiq bo‘lmasa). */
  private async maybeAutoComplaint(tx: Tx, shopId: string, rules: ModerationRules) {
    const count = await tx.review.count({
      where: { shopId, moderationStatus: 'HIDDEN', riskFlags: { hasSome: ['SELF_REVIEW', 'SHARED_DEVICE_WITH_SHOP'] }, createdAt: { gte: new Date(Date.now() - rules.autoComplaintWindowDays * DAY) } },
    });
    if (count < rules.autoComplaintBlockedCount) return;
    const open = await tx.complaint.count({ where: { targetType: 'SHOP', targetId: shopId, reporterId: null, reason: 'FAKE', status: 'OPEN' } });
    if (open) return;
    await tx.complaint.create({ data: { reporterId: null, targetType: 'SHOP', targetId: shopId, reason: 'FAKE', details: `AUTO: 30 kunda ${count} ta sharh SELF_REVIEW/SHARED_DEVICE sababli rad etildi` } });
  }

  // ───────────── Ommaviy va do‘kon ko‘rinishi ─────────────

  async publicForShop(slug: string, query: PublicReviewsQueryDto) {
    const shop = await this.db.shop.findFirst({ where: { slug, ...ShopService.publicWhere() }, select: { id: true, ratingAvg: true, ratingCount: true } });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;
    const [rows, dist] = await Promise.all([
      this.db.review.findMany({
        where: { shopId: shop.id, moderationStatus: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit + 1,
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          user: { select: { firstName: true } },
          installation: { select: { quote: { select: { systemPowerKw: true, systemType: true } } } },
          reply: { where: { moderationStatus: 'PUBLISHED' }, select: { body: true, createdAt: true } },
        },
      }),
      this.db.review.groupBy({ by: ['rating'], where: { shopId: shop.id, moderationStatus: 'PUBLISHED' }, _count: { _all: true } }),
    ]);
    return {
      ratingAvg: shop.ratingAvg,
      ratingCount: shop.ratingCount,
      distribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: dist.find((d) => d.rating === r)?._count._all ?? 0 })),
      items: rows.slice(0, limit).map((r) => ({
        id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, author: r.user.firstName ?? null,
        systemPowerKw: r.installation.quote.systemPowerKw, systemType: r.installation.quote.systemType, reply: r.reply,
      })),
      nextOffset: rows.length > limit ? offset + limit : null,
    };
  }

  /** Do‘kon: e’lon qilingan sharhlar (moderatsiyadagi va sabablar ko‘rinmaydi). */
  forShop(ctx: ShopContext) {
    return this.db.review.findMany({
      where: { shopId: ctx.shopId, moderationStatus: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { firstName: true } }, installationId: true, reply: { select: { id: true, body: true, createdAt: true, moderationStatus: true } } },
    });
  }

  async reply(ctx: ShopContext, reviewId: string, authorId: string, dto: ReviewReplyDto) {
    const review = await this.db.review.findFirst({ where: { id: reviewId, shopId: ctx.shopId, moderationStatus: 'PUBLISHED' }, select: { id: true, userId: true, reply: { select: { id: true } } } });
    if (!review) throw new NotFoundException(ERRORS.REVIEW_NOT_FOUND);
    if (review.reply) throw new DomainException(HttpStatus.CONFLICT, 'REVIEW_REPLY_EXISTS', ERRORS.REVIEW_REPLY_EXISTS);
    return this.db.$transaction(async (tx) => {
      const reply = await tx.reviewReply.create({ data: { reviewId: review.id, shopId: ctx.shopId, authorId, body: dto.body.trim() } });
      await this.notify.toUser(tx, review.userId, { type: 'REVIEW_REPLY', title: 'Do‘kon sharhingizga javob berdi', body: dto.body.trim().slice(0, 140), entityType: 'Review', entityId: review.id }, authorId);
      return reply;
    });
  }

  // ───────────── Admin moderatsiyasi ─────────────

  adminList(query: AdminReviewsQueryDto) {
    return this.db.review.findMany({
      where: { moderationStatus: query.status ?? 'PENDING' },
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'asc' }],
      take: query.limit ?? 100,
      select: {
        id: true, rating: true, comment: true, moderationStatus: true, riskFlags: true, riskScore: true, createdAt: true, moderatedAt: true,
        user: { select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true } },
        shop: { select: { id: true, name: true, slug: true } },
        installation: { select: { id: true, installedAt: true, confirmedAt: true } },
      },
    });
  }

  async moderate(adminId: string, reviewId: string, dto: ModerateReviewDto) {
    const review = await this.db.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException(ERRORS.REVIEW_NOT_FOUND);
    // SELF_REVIEW bloklangan sharhni e’lon qilib bo‘lmaydi.
    if (dto.decision === 'PUBLISHED' && review.riskFlags.includes('SELF_REVIEW')) throw new DomainException(HttpStatus.CONFLICT, 'REVIEW_SELF_BLOCKED', ERRORS.REVIEW_SELF_BLOCKED);
    const rules = await this.rules();
    await this.db.$transaction(async (tx) => {
      await tx.review.update({ where: { id: reviewId }, data: { moderationStatus: dto.decision, moderatedAt: new Date(), moderatedById: adminId } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'REVIEW_MODERATED', targetType: 'Review', targetId: reviewId, before: { moderationStatus: review.moderationStatus }, after: { moderationStatus: dto.decision, note: dto.note ?? null } } });
      if (dto.decision === 'PUBLISHED' && review.moderationStatus !== 'PUBLISHED') await this.afterPublished(tx, reviewId);
      else await this.recomputeRating(tx, review.shopId);
      if (dto.decision === 'HIDDEN' && review.riskFlags.some((f) => f === 'SHARED_DEVICE_WITH_SHOP')) await this.maybeAutoComplaint(tx, review.shopId, rules);
    });
    return { id: reviewId, moderationStatus: dto.decision };
  }

  async getModerationSettings() {
    const row = await this.db.moderationSettings.findFirst({ where: { active: true }, select: { version: true, createdAt: true } });
    return { version: row?.version ?? 0, rules: await this.rules(), updatedAt: row?.createdAt ?? null };
  }

  /** Yangi versiya (audit bilan); oldingisi faolsizlanadi. */
  async saveModerationSettings(adminId: string, rules: Record<string, unknown>) {
    const merged = { ...DEFAULT_MODERATION_RULES, ...(rules as Partial<ModerationRules>), scores: { ...DEFAULT_MODERATION_RULES.scores, ...((rules.scores as ModerationRules['scores']) ?? {}) } };
    const numbers = [merged.pendingThreshold, merged.burstCount, merged.duplicateSimilarity, ...Object.values(merged.scores)];
    if (numbers.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0) || merged.duplicateSimilarity > 1) {
      throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', 'Moderatsiya chegaralari noto‘g‘ri');
    }
    await this.db.$transaction(async (tx) => {
      const last = await tx.moderationSettings.findFirst({ orderBy: { version: 'desc' }, select: { version: true, rulesJson: true } });
      await tx.moderationSettings.updateMany({ where: { active: true }, data: { active: false } });
      await tx.moderationSettings.create({ data: { version: (last?.version ?? 0) + 1, rulesJson: merged as unknown as Prisma.InputJsonValue, active: true, createdById: adminId } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'MODERATION_SETTINGS_UPDATED', targetType: 'ModerationSettings', targetId: null, before: (last?.rulesJson ?? Prisma.JsonNull) as Prisma.InputJsonValue, after: merged as unknown as Prisma.InputJsonValue } });
    });
    return this.getModerationSettings();
  }

  // ───────────── Shikoyatlar ─────────────

  async complain(userId: string, dto: CreateComplaintDto) {
    const today = await this.db.complaint.count({ where: { reporterId: userId, createdAt: { gte: new Date(`${tashkentDate()}T00:00:00+05:00`) } } });
    if (today >= 10) throw new DomainException(HttpStatus.TOO_MANY_REQUESTS, 'COMPLAINT_DAILY_LIMIT', ERRORS.COMPLAINT_DAILY_LIMIT);
    const exists = await this.targetExists(dto.targetType, dto.targetId);
    if (!exists) throw new NotFoundException(ERRORS.PRISMA_NOT_FOUND);
    const row = await this.db.complaint.create({ data: { reporterId: userId, targetType: dto.targetType, targetId: dto.targetId, reason: dto.reason, details: dto.details?.trim() || null } });
    return { id: row.id, status: row.status };
  }

  private async targetExists(type: CreateComplaintDto['targetType'], id: string) {
    switch (type) {
      case 'REVIEW': return !!(await this.db.review.findFirst({ where: { id, moderationStatus: 'PUBLISHED' }, select: { id: true } }));
      case 'SHOP': return !!(await this.db.shop.findUnique({ where: { id }, select: { id: true } }));
      case 'PRODUCT_MODEL': return !!(await this.db.productModel.findUnique({ where: { id }, select: { id: true } }));
      case 'MESSAGE': return !!(await this.db.conversationMessage.findUnique({ where: { id }, select: { id: true } }));
      case 'USER': return !!(await this.db.user.findUnique({ where: { id }, select: { id: true } }));
    }
  }

  adminComplaints(query: ComplaintsQueryDto) {
    return this.db.complaint.findMany({ where: { status: query.status ?? 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 200 });
  }

  async resolveComplaint(adminId: string, id: string, status: 'RESOLVED' | 'REJECTED') {
    const row = await this.db.complaint.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(ERRORS.COMPLAINT_NOT_FOUND);
    await this.db.$transaction([
      this.db.complaint.update({ where: { id }, data: { status, resolvedBy: adminId, resolvedAt: new Date() } }),
      this.db.auditLog.create({ data: { actorId: adminId, action: 'COMPLAINT_RESOLVED', targetType: 'Complaint', targetId: id, before: { status: row.status }, after: { status } } }),
    ]);
    return { id, status };
  }

  // ───────────── Sevimlilar ─────────────

  async favorites(userId: string) {
    const rows = await this.db.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, createdAt: true,
        shop: { select: { id: true, slug: true, name: true, logoAssetId: true, ratingAvg: true, ratingCount: true } },
        productModel: { select: { id: true, slug: true, brand: true, model: true, nominalPowerW: true, category: { select: { slug: true, nameI18n: true } } } },
      },
    });
    return rows;
  }

  private assertOne(dto: FavoriteDto) {
    if (!!dto.shopId === !!dto.productModelId) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'FAVORITE_TARGET_INVALID', ERRORS.FAVORITE_TARGET_INVALID);
  }

  async addFavorite(userId: string, dto: FavoriteDto) {
    this.assertOne(dto);
    if (dto.shopId && !(await this.db.shop.findFirst({ where: { id: dto.shopId, ...ShopService.publicWhere() }, select: { id: true } }))) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    if (dto.productModelId && !(await this.db.productModel.findFirst({ where: { id: dto.productModelId, status: 'APPROVED' }, select: { id: true } }))) throw new NotFoundException(ERRORS.PRODUCT_MODEL_NOT_FOUND);
    const existing = await this.db.favorite.findFirst({ where: { userId, shopId: dto.shopId ?? null, productModelId: dto.productModelId ?? null } });
    if (existing) return existing;
    try {
      return await this.db.favorite.create({ data: { userId, shopId: dto.shopId ?? null, productModelId: dto.productModelId ?? null } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return this.db.favorite.findFirstOrThrow({ where: { userId, shopId: dto.shopId ?? null, productModelId: dto.productModelId ?? null } });
      throw error;
    }
  }

  async removeFavorite(userId: string, dto: FavoriteDto) {
    this.assertOne(dto);
    const result = await this.db.favorite.deleteMany({ where: { userId, shopId: dto.shopId ?? null, productModelId: dto.productModelId ?? null } });
    return { removed: result.count };
  }
}
