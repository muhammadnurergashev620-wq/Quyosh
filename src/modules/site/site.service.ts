import { HttpStatus, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma, type SiteBlock } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import { PublicService } from '../public/public.service';
import { BLOCK_TYPES, FIXED_BLOCKS, sanitizeBlock, type BlockType } from './block-schema';
import { HOME_DEFAULTS } from './home-defaults';

const PAGE = 'HOME';
const TESTIMONIALS = 6;
const CACHE_MS = 60_000;

type HomeView = Awaited<ReturnType<SiteService['buildHome']>>;

/**
 * Bosh sahifa CMS (TZ 5.6, U7.1): bloklar 3 tilda, qoralama → nashr, versiyalar audit jurnalida.
 * Ishonch raqamlari faqat bazadan; sharhlar faqat PUBLISHED (moderatsiyadan o‘tgan) sharhlardan.
 */
@Injectable()
export class SiteService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SiteService.name);
  private cache: { at: number; value: HomeView } | null = null;

  constructor(private readonly db: PrismaService, private readonly publicStats: PublicService) {}

  async onApplicationBootstrap() {
    try {
      await this.ensureDefaults();
    } catch (error) {
      this.logger.warn(`Bosh sahifa bloklarini yaratib bo‘lmadi: ${(error as Error).message}`);
    }
  }

  /** Yetishmayotgan bloklarni standart matn bilan (PUBLISHED v1) yaratadi; mavjudlariga tegmaydi. */
  async ensureDefaults() {
    const existing = new Set((await this.db.siteBlock.findMany({ where: { page: PAGE }, select: { blockType: true } })).map((b) => b.blockType));
    const missing = BLOCK_TYPES.filter((type) => !existing.has(type));
    if (!missing.length) return 0;
    await this.db.siteBlock.createMany({
      data: missing.map((type) => ({
        page: PAGE, blockType: type, sortOrder: BLOCK_TYPES.indexOf(type) * 10, status: 'PUBLISHED' as const,
        contentI18n: HOME_DEFAULTS[type] as unknown as Prisma.InputJsonValue, version: 1, publishedAt: new Date(),
      })),
      skipDuplicates: true,
    });
    this.cache = null;
    return missing.length;
  }

  /** Ommaviy bosh sahifa: faqat nashr qilingan bloklar + jonli raqamlar + sharhlar (60 s kesh). */
  async home() {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const value = await this.buildHome(false);
    this.cache = { at: Date.now(), value };
    return value;
  }

  /** Admin ko‘rinishi: qoralamalar nashr qilingandek, yashirilgan bloklar ham ko‘rsatilmaydi. */
  preview() {
    return this.buildHome(true);
  }

  private async buildHome(preview: boolean) {
    const blocks = await this.db.siteBlock.findMany({ where: { page: PAGE, status: 'PUBLISHED' }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    const [stats, testimonials] = await Promise.all([this.publicStats.stats(), this.testimonials()]);
    return {
      blocks: blocks.map((b) => ({ type: b.blockType, version: b.version, content: preview && b.draftI18n ? b.draftI18n : b.contentI18n })),
      stats,
      testimonials,
      preview,
    };
  }

  private async testimonials() {
    const rows = await this.db.review.findMany({
      where: { moderationStatus: 'PUBLISHED', rating: { gte: 4 }, comment: { not: null }, shop: { status: 'ACTIVE', archivedAt: null } },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
      take: TESTIMONIALS * 3,
      select: {
        id: true, rating: true, comment: true, createdAt: true,
        user: { select: { firstName: true, lastName: true } },
        shop: { select: { name: true, slug: true } },
        installation: { select: { quote: { select: { systemPowerKw: true } } } },
      },
    });
    // Bitta do‘kondan ko‘pi bilan 2 ta sharh — bosh sahifa bir do‘kon reklamasiga aylanmasin.
    const perShop = new Map<string, number>();
    return rows
      .filter((r) => (r.comment ?? '').trim().length >= 20)
      .filter((r) => { const n = perShop.get(r.shop.slug) ?? 0; perShop.set(r.shop.slug, n + 1); return n < 2; })
      .slice(0, TESTIMONIALS)
      .map((r) => ({
        id: r.id, rating: r.rating, comment: r.comment!.trim(), createdAt: r.createdAt,
        author: r.user.firstName ? `${r.user.firstName}${r.user.lastName ? ` ${r.user.lastName.slice(0, 1)}.` : ''}` : null,
        shop: r.shop, systemPowerKw: r.installation.quote.systemPowerKw,
      }));
  }

  async adminList() {
    const rows = await this.db.siteBlock.findMany({ where: { page: PAGE }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    const editors = await this.editors(rows.map((r) => r.updatedById));
    return rows.map((r) => this.view(r, editors));
  }

  async saveDraft(id: string, input: unknown, actorId: string) {
    const block = await this.get(id);
    const { content, errors } = sanitizeBlock(block.blockType as BlockType, input);
    if (errors.length) throw new DomainException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', `Maydonlarni tekshiring: ${errors.join(', ')}`);
    const row = await this.db.siteBlock.update({ where: { id }, data: { draftI18n: content as Prisma.InputJsonValue, updatedById: actorId } });
    return this.view(row, await this.editors([row.updatedById]));
  }

  async discardDraft(id: string, actorId: string) {
    await this.get(id);
    const row = await this.db.siteBlock.update({ where: { id }, data: { draftI18n: Prisma.DbNull, updatedById: actorId } });
    return this.view(row, await this.editors([row.updatedById]));
  }

  /** Qoralamani nashr qiladi: versiya +1, eski va yangi matn audit jurnaliga (versiyalar tarixi). */
  async publish(id: string, actorId: string) {
    const block = await this.get(id);
    if (!block.draftI18n) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'SITE_BLOCK_NO_DRAFT', ERRORS.SITE_BLOCK_NO_DRAFT);
    const row = await this.db.$transaction(async (tx) => {
      const updated = await tx.siteBlock.update({
        where: { id },
        data: { contentI18n: block.draftI18n as Prisma.InputJsonValue, draftI18n: Prisma.DbNull, version: { increment: 1 }, publishedAt: new Date(), updatedById: actorId },
      });
      await tx.auditLog.create({
        data: {
          actorId, action: 'SITE_BLOCK_PUBLISHED', targetType: 'SiteBlock', targetId: id,
          before: { version: block.version, content: block.contentI18n } as Prisma.InputJsonValue,
          after: { version: updated.version, blockType: block.blockType, content: updated.contentI18n } as Prisma.InputJsonValue,
        },
      });
      return updated;
    });
    this.cache = null;
    return this.view(row, await this.editors([row.updatedById]));
  }

  /** Ko‘rinish (PUBLISHED / ARCHIVED = yashirin) va tartib. HERO va FINALE yashirilmaydi va joyi o‘zgarmaydi. */
  async update(id: string, dto: { hidden?: boolean; sortOrder?: number }, actorId: string) {
    const block = await this.get(id);
    const fixed = FIXED_BLOCKS.includes(block.blockType as BlockType);
    if (fixed && (dto.hidden !== undefined || dto.sortOrder !== undefined)) {
      throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', 'Bu blok joyi va ko‘rinishi o‘zgarmaydi');
    }
    const status = dto.hidden === undefined ? undefined : dto.hidden ? ('ARCHIVED' as const) : ('PUBLISHED' as const);
    const row = await this.db.$transaction(async (tx) => {
      const updated = await tx.siteBlock.update({ where: { id }, data: { status, sortOrder: dto.sortOrder, updatedById: actorId } });
      if (status && status !== block.status) {
        await tx.auditLog.create({ data: { actorId, action: status === 'ARCHIVED' ? 'SITE_BLOCK_HIDDEN' : 'SITE_BLOCK_SHOWN', targetType: 'SiteBlock', targetId: id, before: { status: block.status }, after: { status, blockType: block.blockType } } });
      }
      return updated;
    });
    this.cache = null;
    return this.view(row, await this.editors([row.updatedById]));
  }

  /** Tartiblanadigan bloklarni berilgan tartibda joylashtiradi (HERO boshida, FINALE oxirida qoladi). */
  async reorder(ids: string[], actorId: string) {
    const rows = await this.db.siteBlock.findMany({ where: { page: PAGE }, select: { id: true, blockType: true, sortOrder: true } });
    const movable = rows.filter((r) => !FIXED_BLOCKS.includes(r.blockType as BlockType));
    const known = new Set(movable.map((r) => r.id));
    if (ids.length !== movable.length || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Tartiblanadigan barcha bloklarni bir martadan yuboring');
    }
    await this.db.$transaction([
      ...rows.filter((r) => r.blockType === 'HERO').map((r) => this.db.siteBlock.update({ where: { id: r.id }, data: { sortOrder: 0 } })),
      ...ids.map((id, i) => this.db.siteBlock.update({ where: { id }, data: { sortOrder: (i + 1) * 10, updatedById: actorId } })),
      ...rows.filter((r) => r.blockType === 'FINALE').map((r) => this.db.siteBlock.update({ where: { id: r.id }, data: { sortOrder: 10_000 } })),
      this.db.auditLog.create({ data: { actorId, action: 'SITE_BLOCKS_REORDERED', targetType: 'SiteBlock', after: { order: ids } } }),
    ]);
    this.cache = null;
    return this.adminList();
  }

  /** Nashr qilingan versiyalar (audit jurnalidan), eng yangisi birinchi. */
  async versions(id: string) {
    await this.get(id);
    const logs = await this.db.auditLog.findMany({
      where: { targetType: 'SiteBlock', targetId: id, action: 'SITE_BLOCK_PUBLISHED' },
      orderBy: { createdAt: 'desc' }, take: 30,
      select: { id: true, createdAt: true, after: true, actor: { select: { firstName: true, lastName: true } } },
    });
    return logs.map((l) => {
      const after = (l.after ?? {}) as { version?: number; content?: unknown };
      return { id: l.id, version: after.version ?? null, content: after.content ?? null, publishedAt: l.createdAt, by: l.actor ? [l.actor.firstName, l.actor.lastName].filter(Boolean).join(' ') : null };
    });
  }

  /** Eski versiyani qoralamaga qaytaradi (nashr — alohida, ko‘rib chiqilgandan keyin). */
  async restore(id: string, versionId: string, actorId: string) {
    const block = await this.get(id);
    const log = await this.db.auditLog.findFirst({ where: { id: versionId, targetType: 'SiteBlock', targetId: id, action: 'SITE_BLOCK_PUBLISHED' }, select: { after: true } });
    const content = (log?.after as { content?: unknown } | null)?.content;
    if (!content) throw new NotFoundException(ERRORS.SITE_BLOCK_NOT_FOUND);
    return this.saveDraft(block.id, content, actorId);
  }

  private async get(id: string) {
    const block = await this.db.siteBlock.findFirst({ where: { id, page: PAGE } });
    if (!block) throw new NotFoundException(ERRORS.SITE_BLOCK_NOT_FOUND);
    return block;
  }

  private async editors(ids: Array<string | null>) {
    const list = [...new Set(ids.filter((x): x is string => !!x))];
    if (!list.length) return new Map<string, string>();
    const users = await this.db.user.findMany({ where: { id: { in: list } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ')]));
  }

  private view(row: SiteBlock, editors: Map<string, string>) {
    return {
      id: row.id, type: row.blockType, sortOrder: row.sortOrder, hidden: row.status !== 'PUBLISHED', fixed: FIXED_BLOCKS.includes(row.blockType as BlockType),
      content: row.contentI18n, draft: row.draftI18n, version: row.version, publishedAt: row.publishedAt, updatedAt: row.updatedAt,
      updatedBy: row.updatedById ? editors.get(row.updatedById) ?? null : null,
    };
  }
}
