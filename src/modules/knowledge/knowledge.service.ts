import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { toUzbekCyrillic } from '../../common/utils/translit';
import type { ArticleDto, ArticlesQueryDto, CategoryDto } from './dto/knowledge.dto';

type I18n = Record<string, string>;

/** oz bo‘lmasa — uz dan transliteratsiya (TZ: 3 til). */
export function withOz(v: I18n | null | undefined): I18n {
  const x = { ...(v ?? {}) };
  if (!x.oz && x.uz) x.oz = toUzbekCyrillic(x.uz);
  return x;
}

const words = (text: string) => text.replace(/[#*_>`\-|[\]()]/g, ' ').split(/\s+/).filter(Boolean).length;

const LIST_SELECT = {
  id: true, slug: true, articleType: true, titleI18n: true, summaryI18n: true, coverFileId: true, tags: true, ctaType: true, readingMinutes: true,
  videoUrl: true, beginnerOrder: true, publishedAt: true, verifiedAt: true, category: { select: { id: true, slug: true, nameI18n: true, icon: true } },
} satisfies Prisma.GuideArticleSelect;

/** Bilimlar markazi (TZ 4.19, 7.7, U7.6, U12.8). */
@Injectable()
export class KnowledgeService {
  constructor(private readonly db: PrismaService) {}

  private norm<T extends { titleI18n: unknown; summaryI18n: unknown; category: { nameI18n: unknown } }>(a: T) {
    return { ...a, titleI18n: withOz(a.titleI18n as I18n), summaryI18n: withOz(a.summaryI18n as I18n), category: { ...a.category, nameI18n: withOz(a.category.nameI18n as I18n) } };
  }

  async categories() {
    const rows = await this.db.knowledgeCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { articles: { where: { status: 'PUBLISHED' } } } } } });
    return rows.map((c) => ({ id: c.id, slug: c.slug, icon: c.icon, nameI18n: withOz(c.nameI18n as I18n), count: c._count.articles }));
  }

  /** Ro‘yxat/qidiruv: q bo‘lsa — trigram o‘xshashlik + ILIKE (barcha tillar). */
  async list(query: ArticlesQueryDto) {
    const limit = query.limit ?? 18;
    const offset = query.offset ?? 0;
    const q = query.q?.trim();
    let ids: string[] | null = null;
    if (q) {
      const rows = await this.db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM guide_articles WHERE status = 'PUBLISHED' AND (search_text ILIKE ${'%' + q + '%'} OR similarity(search_text, ${q}) > 0.08)
        ORDER BY (search_text ILIKE ${'%' + q + '%'}) DESC, similarity(search_text, ${q}) DESC LIMIT 200`;
      ids = rows.map((r) => r.id);
    }
    const where: Prisma.GuideArticleWhereInput = {
      status: 'PUBLISHED',
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.type ? { articleType: query.type } : {}),
      ...(ids ? { id: { in: ids } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.guideArticle.findMany({ where, select: LIST_SELECT, orderBy: [{ publishedAt: 'desc' }], skip: ids ? 0 : offset, take: ids ? 200 : limit }),
      this.db.guideArticle.count({ where }),
    ]);
    const ordered = ids ? ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is (typeof rows)[number] => !!r).slice(offset, offset + limit) : rows;
    return { items: ordered.map((r) => this.norm(r)), total, nextOffset: offset + limit < total ? offset + limit : null };
  }

  async beginner() {
    const rows = await this.db.guideArticle.findMany({ where: { status: 'PUBLISHED', beginnerOrder: { not: null } }, orderBy: { beginnerOrder: 'asc' }, select: LIST_SELECT, take: 5 });
    return rows.map((r) => this.norm(r));
  }

  async glossary() {
    const rows = await this.db.guideArticle.findMany({ where: { status: 'PUBLISHED', articleType: 'GLOSSARY' }, select: { ...LIST_SELECT, bodyI18n: true } });
    return rows.map((r) => ({ ...this.norm(r), bodyI18n: withOz(r.bodyI18n as I18n) }));
  }

  async get(slug: string, preview = false) {
    const a = await this.db.guideArticle.findFirst({ where: { slug, ...(preview ? {} : { status: 'PUBLISHED' }) }, include: { category: { select: { id: true, slug: true, nameI18n: true, icon: true } } } });
    if (!a) throw new NotFoundException(ERRORS.ARTICLE_NOT_FOUND);
    const related = await this.db.guideArticle.findMany({ where: { status: 'PUBLISHED', categoryId: a.categoryId, id: { not: a.id } }, select: LIST_SELECT, orderBy: { publishedAt: 'desc' }, take: 3 });
    return {
      ...a,
      titleI18n: withOz(a.titleI18n as I18n), summaryI18n: withOz(a.summaryI18n as I18n), bodyI18n: withOz(a.bodyI18n as I18n),
      seoTitleI18n: a.seoTitleI18n ? withOz(a.seoTitleI18n as I18n) : null, seoDescriptionI18n: a.seoDescriptionI18n ? withOz(a.seoDescriptionI18n as I18n) : null,
      category: { ...a.category, nameI18n: withOz(a.category.nameI18n as I18n) },
      searchText: undefined,
      related: related.map((r) => this.norm(r)),
    };
  }

  async helpful(slug: string, helpful: boolean) {
    const res = await this.db.guideArticle.updateMany({ where: { slug, status: 'PUBLISHED' }, data: helpful ? { helpfulYes: { increment: 1 } } : { helpfulNo: { increment: 1 } } });
    if (!res.count) throw new NotFoundException(ERRORS.ARTICLE_NOT_FOUND);
    return { ok: true };
  }

  /** Yordam markazi: murojaatdan oldin FAQ tavsiyalari (GET /support/suggestions). */
  async suggestions(q: string) {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM guide_articles WHERE status = 'PUBLISHED' AND article_type IN ('FAQ', 'GUIDE', 'ARTICLE')
        AND (search_text ILIKE ${'%' + q + '%'} OR word_similarity(${q}, search_text) > 0.3)
      ORDER BY (article_type = 'FAQ') DESC, word_similarity(${q}, search_text) DESC LIMIT 5`;
    if (!rows.length) return [];
    const arts = await this.db.guideArticle.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: LIST_SELECT });
    return rows.map((r) => arts.find((a) => a.id === r.id)).filter((a): a is (typeof arts)[number] => !!a).map((a) => this.norm(a));
  }

  /** sitemap.xml (TZ 5.5): har maqola 3 tilda, hreflang alternate. */
  async sitemap(base: string) {
    const rows = await this.db.guideArticle.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true, category: { select: { slug: true } } } });
    const shops = await this.db.shop.findMany({ where: { status: 'ACTIVE', verificationStatus: 'VERIFIED', archivedAt: null }, select: { slug: true, updatedAt: true } });
    const langs: Array<[string, string]> = [['uz', 'uz'], ['uz-Cyrl', 'uz-Cyrl'], ['ru', 'ru']];
    const b = base.replace(/\/$/, '');
    const entry = (path: string, updated: Date) => {
      const alts = langs.map(([hl, q]) => `<xhtml:link rel="alternate" hreflang="${hl}" href="${b}${path}?lang=${q}"/>`).join('');
      return langs.map(([, q]) => `<url><loc>${b}${path}?lang=${q}</loc><lastmod>${updated.toISOString().slice(0, 10)}</lastmod>${alts}</url>`).join('');
    };
    const urls = [
      entry('/mijoz/kalkulyator', new Date()),
      entry('/mijoz/bilim', new Date()),
      ...rows.map((r) => entry(`/mijoz/bilim/${r.category.slug}/${r.slug}`, r.updatedAt)),
      ...shops.map((s) => entry(`/mijoz/dokonlar/${s.slug}`, s.updatedAt)),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>\n`;
  }

  // ───────────── Admin (U12.8) ─────────────

  adminList() {
    return this.db.guideArticle.findMany({ orderBy: { updatedAt: 'desc' }, select: { ...LIST_SELECT, status: true, updatedAt: true, helpfulYes: true, helpfulNo: true, bodyI18n: true } });
  }

  async adminGet(id: string) {
    const a = await this.db.guideArticle.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(ERRORS.ARTICLE_NOT_FOUND);
    return a;
  }

  private data(dto: ArticleDto, authorId: string, current?: { status: string; publishedAt: Date | null }) {
    const body = dto.bodyI18n;
    const searchText = [...Object.values(dto.titleI18n), ...Object.values(dto.summaryI18n), ...Object.values(body), ...(dto.tags ?? [])].join(' \n ').slice(0, 200_000);
    const status = dto.status ?? 'DRAFT';
    return {
      slug: dto.slug, articleType: dto.articleType, categoryId: dto.categoryId, titleI18n: dto.titleI18n, summaryI18n: dto.summaryI18n, bodyI18n: body, searchText,
      videoUrl: dto.videoUrl ?? null, coverFileId: dto.coverFileId ?? null, tags: dto.tags ?? [],
      seoTitleI18n: dto.seoTitleI18n ?? Prisma.JsonNull, seoDescriptionI18n: dto.seoDescriptionI18n ?? Prisma.JsonNull,
      ctaType: dto.ctaType ?? 'NONE', sourceUrls: dto.sourceUrls ?? [], beginnerOrder: dto.beginnerOrder ?? null,
      verifiedAt: dto.verifiedAt ? new Date(dto.verifiedAt) : null,
      readingMinutes: Math.max(1, Math.round(words(body.uz ?? body.ru ?? '') / 180)),
      status, authorId,
      publishedAt: status === 'PUBLISHED' ? (current?.publishedAt ?? new Date()) : current?.publishedAt ?? null,
    } satisfies Prisma.GuideArticleUncheckedCreateInput;
  }

  async create(dto: ArticleDto, authorId: string) {
    try {
      const a = await this.db.guideArticle.create({ data: this.data(dto, authorId) });
      await this.db.auditLog.create({ data: { actorId: authorId, action: 'ARTICLE_CREATED', targetType: 'GuideArticle', targetId: a.id, after: { slug: a.slug, status: a.status } } });
      return a;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(ERRORS.ARTICLE_SLUG_TAKEN);
      throw e;
    }
  }

  async update(id: string, dto: ArticleDto, authorId: string) {
    const cur = await this.adminGet(id);
    try {
      const a = await this.db.guideArticle.update({ where: { id }, data: this.data(dto, authorId, cur) });
      await this.db.auditLog.create({ data: { actorId: authorId, action: 'ARTICLE_UPDATED', targetType: 'GuideArticle', targetId: id, before: { status: cur.status }, after: { slug: a.slug, status: a.status } } });
      return a;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(ERRORS.ARTICLE_SLUG_TAKEN);
      throw e;
    }
  }

  async createCategory(dto: CategoryDto) {
    return this.db.knowledgeCategory.create({ data: { slug: dto.slug, nameI18n: dto.nameI18n, icon: dto.icon ?? null, sortOrder: dto.sortOrder ?? 0 } });
  }

  async updateCategory(id: string, dto: CategoryDto) {
    const r = await this.db.knowledgeCategory.updateMany({ where: { id }, data: { slug: dto.slug, nameI18n: dto.nameI18n, icon: dto.icon ?? null, sortOrder: dto.sortOrder ?? 0 } });
    if (!r.count) throw new NotFoundException(ERRORS.KNOWLEDGE_CATEGORY_NOT_FOUND);
    return this.db.knowledgeCategory.findUniqueOrThrow({ where: { id } });
  }
}
