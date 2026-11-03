import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Quote, type QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import { formatSum, tashkentDate, tashkentDateTime } from '../../common/utils/tashkent-date';
import type { ShopPermission } from '../../common/constants/shop-permissions';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import type { Panel } from '../../common/utils/panel';
import { loanSchedule } from '../calc-engine';
import { M6Notifier } from '../quote-request/m6-notifier.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { QuoteRequestService } from '../quote-request/quote-request.service';
import { assertRequestShopTransition, assertRequestTransition } from '../quote-request/quote-request-state-machine';
import { assertQuoteTransition, CUSTOMER_VISIBLE_QUOTE } from './quote-state-machine';
import { computeQuoteTotals } from './quote-totals';
import type { BuilderCatalogQueryDto, CreateQuoteDto, QuoteFieldsDto, RejectQuoteDto, UpdateQuoteDto } from './dto/quote.dto';
import { numAt } from '../../common/utils/json-path';

type Tx = Prisma.TransactionClient;
type Side = 'CUSTOMER' | 'SHOP';

const QUOTE_INCLUDE = {
  items: { orderBy: { sortOrder: 'asc' } },
  financingOptions: true,
  revisions: { orderBy: { revision: 'desc' }, select: { revision: true, createdAt: true } },
  shop: { select: { id: true, slug: true, name: true, logoAssetId: true, ratingAvg: true, ratingCount: true, verificationStatus: true, avgResponseMinutes: true } },
  request: { select: { id: true, number: true, title: true, userId: true, status: true, calculationId: true, systemType: true, requiredCapacityKw: true } },
  installation: { select: { id: true, status: true } },
} satisfies Prisma.QuoteInclude;

type QuoteFull = Prisma.QuoteGetPayload<{ include: typeof QUOTE_INCLUDE }>;

const unprocessable = (code: keyof typeof ERRORS) => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, code, ERRORS[code] as string);
const conflict = (code: keyof typeof ERRORS) => new DomainException(HttpStatus.CONFLICT, code, ERRORS[code] as string);

/** Revision snapshoti: mijoz tarixda ko‘radigan barcha maydonlar va qatorlar (13.3). */
function snapshotOf(quote: QuoteFull) {
  return {
    total: quote.total.toString(), equipmentSubtotal: quote.equipmentSubtotal.toString(), installationSubtotal: quote.installationSubtotal.toString(),
    deliveryCost: quote.deliveryCost.toString(), otherCosts: quote.otherCosts.toString(), discountAmount: quote.discountAmount.toString(),
    vatIncluded: quote.vatIncluded, vatRate: quote.vatRate.toString(), vatAmount: quote.vatAmount.toString(), currency: quote.currency,
    exchangeRateUsd: quote.exchangeRateUsd?.toString() ?? null, exchangeRateDate: quote.exchangeRateDate?.toISOString().slice(0, 10) ?? null,
    systemPowerKw: quote.systemPowerKw?.toString() ?? null, systemType: quote.systemType,
    warrantyEquipmentMonths: quote.warrantyEquipmentMonths, warrantyInstallationMonths: quote.warrantyInstallationMonths, warrantyText: quote.warrantyText,
    durationDays: quote.durationDays, includedScope: quote.includedScope, excludedScope: quote.excludedScope, validUntil: quote.validUntil?.toISOString().slice(0, 10) ?? null,
    items: quote.items.map((item) => ({ itemType: item.itemType, title: item.titleSnapshot, specs: item.specsSnapshotJson, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), lineTotal: item.lineTotal.toString(), productModelId: item.productModelId, serviceId: item.serviceId })),
    financingOptions: quote.financingOptions.map((f) => ({ financingType: f.financingType, providerName: f.providerName, annualRate: f.annualRate.toString(), termMonths: f.termMonths, downPaymentPct: f.downPaymentPct.toString(), paymentType: f.paymentType, notes: f.notes })),
  };
}

/** Taklif qoidalari (TZ 9.10, 13.1, 13.3). Summalar faqat serverda; har yuborish/yangilash — yangi revision. */
@Injectable()
export class QuoteService {
  constructor(
    private readonly db: PrismaService,
    private readonly requests: QuoteRequestService,
    private readonly notify: M6Notifier,
    private readonly analytics: AnalyticsService,
  ) {}

  // ───────────── Kirish ─────────────

  private async member(userId: string, shopId: string, permission: ShopPermission, write = true) {
    const member = await this.db.shopMember.findUnique({ where: { shopId_userId: { shopId, userId } }, select: { id: true, memberRole: true, permissions: true, shop: { select: { status: true, archivedAt: true } } } });
    if (!member || member.shop.archivedAt) throw new NotFoundException(ERRORS.QUOTE_NOT_FOUND);
    if (member.memberRole !== 'OWNER' && !member.permissions.includes(permission)) throw new ForbiddenException(ERRORS.SHOP_PERMISSION_REQUIRED);
    if (write && member.shop.status === 'SUSPENDED') throw new DomainException(HttpStatus.LOCKED, 'SHOP_SUSPENDED', ERRORS.SHOP_SUSPENDED);
    return member;
  }

  private async load(quoteId: string, db: Tx | PrismaService = this.db): Promise<QuoteFull> {
    const quote = await db.quote.findUnique({ where: { id: quoteId }, include: QUOTE_INCLUDE });
    if (!quote) throw new NotFoundException(ERRORS.QUOTE_NOT_FOUND);
    return quote;
  }

  /** Do‘kon amali uchun: a’zolik + ruxsat. */
  private async forShop(userId: string, quoteId: string, permission: ShopPermission) {
    const quote = await this.load(quoteId);
    await this.member(userId, quote.shopId, permission);
    return quote;
  }

  /** Mijoz amali uchun: so‘rov egasi va taklif yuborilgan bo‘lishi kerak (qoralama mijozga mavjud emas). */
  private async forCustomer(userId: string, quoteId: string) {
    const quote = await this.load(quoteId);
    if (quote.request.userId !== userId || !CUSTOMER_VISIBLE_QUOTE.includes(quote.status)) throw new NotFoundException(ERRORS.QUOTE_NOT_FOUND);
    return quote;
  }

  // ───────────── Qatorlar va summalar ─────────────

  /** Qatorlarni tekshirish va snapshot (mahsulot nomi/xususiyatlari) bilan tayyorlash. */
  private async prepareItems(shopId: string, items: NonNullable<QuoteFieldsDto['items']>) {
    const modelIds = [...new Set(items.map((i) => i.productModelId).filter((v): v is string => !!v))];
    const serviceIds = [...new Set(items.map((i) => i.serviceId).filter((v): v is string => !!v))];
    const [models, services] = await Promise.all([
      this.db.productModel.findMany({ where: { id: { in: modelIds } }, select: { id: true, brand: true, model: true, nominalPowerW: true, inverterAcKw: true, batteryCapacityKwh: true, warrantyMonths: true, category: { select: { slug: true } } } }),
      this.db.service.findMany({ where: { id: { in: serviceIds }, shopId }, select: { id: true, serviceType: true, warrantyMonths: true } }),
    ]);
    return items.map((item, index) => {
      const model = item.productModelId ? models.find((m) => m.id === item.productModelId) : null;
      const service = item.serviceId ? services.find((s) => s.id === item.serviceId) : null;
      if ((item.productModelId && !model) || (item.serviceId && !service)) throw unprocessable('QUOTE_ITEM_SOURCE_INVALID');
      const title = item.title?.trim() || (model ? `${model.brand} ${model.model}` : service ? service.serviceType : '');
      if (!title) throw unprocessable('QUOTE_ITEM_SOURCE_INVALID');
      const specs = model
        ? { category: model.category.slug, nominalPowerW: model.nominalPowerW, inverterAcKw: model.inverterAcKw?.toString() ?? null, batteryCapacityKwh: model.batteryCapacityKwh?.toString() ?? null, warrantyMonths: model.warrantyMonths }
        : service
          ? { serviceType: service.serviceType, warrantyMonths: service.warrantyMonths }
          : null;
      return { ...item, title, specs, sortOrder: index };
    });
  }

  /** Qatorlar va maydonlarni yozib, summalarni qayta hisoblaydi. */
  private async writeFields(tx: Tx, quote: Pick<Quote, 'id' | 'shopId' | 'deliveryCost' | 'otherCosts' | 'discountAmount' | 'vatIncluded' | 'vatRate'>, dto: QuoteFieldsDto) {
    // deliveryCost/otherCosts = qator summalari + qo‘lda kiritilgan qo‘shimcha; qo‘shimchani eski qatorlardan ajratib olamiz.
    const sumOf = (rows: Array<{ itemType: string; lineTotal: Prisma.Decimal }>, type: string) => rows.filter((i) => i.itemType === type).reduce((acc, i) => acc.add(i.lineTotal), new Prisma.Decimal(0));
    const oldItems = await tx.quoteItem.findMany({ where: { quoteId: quote.id }, select: { itemType: true, lineTotal: true } });
    const manualDelivery = quote.deliveryCost.sub(sumOf(oldItems, 'DELIVERY'));
    const manualOther = quote.otherCosts.sub(sumOf(oldItems, 'OTHER'));
    if (dto.items) {
      const prepared = await this.prepareItems(quote.shopId, dto.items);
      await tx.quoteItem.deleteMany({ where: { quoteId: quote.id } });
      if (prepared.length) {
        await tx.quoteItem.createMany({
          data: prepared.map((item) => ({
            quoteId: quote.id, itemType: item.itemType, productModelId: item.productModelId ?? null, serviceId: item.serviceId ?? null, titleSnapshot: item.title,
            specsSnapshotJson: (item.specs ?? Prisma.JsonNull) as Prisma.InputJsonValue, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: 0, sortOrder: item.sortOrder,
          })),
        });
      }
    }
    if (dto.financingOptions) {
      await tx.quoteFinancingOption.deleteMany({ where: { quoteId: quote.id } });
      if (dto.financingOptions.length) {
        await tx.quoteFinancingOption.createMany({
          data: dto.financingOptions.map((f) => ({ quoteId: quote.id, financingType: f.financingType, providerName: f.providerName.trim(), annualRate: f.annualRate, termMonths: f.termMonths, downPaymentPct: f.downPaymentPct ?? 0, paymentType: f.paymentType ?? 'ANNUITY', notes: f.notes?.trim() || null })),
        });
      }
    }
    const items = await tx.quoteItem.findMany({ where: { quoteId: quote.id }, orderBy: { sortOrder: 'asc' } });
    const totals = computeQuoteTotals({
      items: items.map((i) => ({ itemType: i.itemType, quantity: i.quantity, unitPrice: i.unitPrice })),
      deliveryCost: dto.deliveryCost ?? Prisma.Decimal.max(manualDelivery, 0),
      otherCosts: dto.otherCosts ?? Prisma.Decimal.max(manualOther, 0),
      discountAmount: dto.discountAmount ?? quote.discountAmount,
      vatIncluded: dto.vatIncluded ?? quote.vatIncluded,
      vatRate: dto.vatRate ?? quote.vatRate,
    });
    for (const [index, item] of items.entries()) {
      if (!item.lineTotal.eq(totals.lineTotals[index])) await tx.quoteItem.update({ where: { id: item.id }, data: { lineTotal: totals.lineTotals[index] } });
    }
    const usd = await tx.exchangeRate.findFirst({ where: { currency: 'USD' }, orderBy: { rateDate: 'desc' } });
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        equipmentSubtotal: totals.equipmentSubtotal, installationSubtotal: totals.installationSubtotal, deliveryCost: totals.deliveryCost, otherCosts: totals.otherCosts,
        discountAmount: totals.discountAmount, vatAmount: totals.vatAmount, total: totals.total.isNegative() ? 0 : totals.total,
        ...(dto.vatIncluded !== undefined ? { vatIncluded: dto.vatIncluded } : {}),
        ...(dto.vatRate !== undefined ? { vatRate: dto.vatRate } : {}),
        ...(dto.systemPowerKw !== undefined ? { systemPowerKw: dto.systemPowerKw } : {}),
        ...(dto.systemType !== undefined ? { systemType: dto.systemType } : {}),
        ...(dto.warrantyEquipmentMonths !== undefined ? { warrantyEquipmentMonths: dto.warrantyEquipmentMonths } : {}),
        ...(dto.warrantyInstallationMonths !== undefined ? { warrantyInstallationMonths: dto.warrantyInstallationMonths } : {}),
        ...(dto.warrantyText !== undefined ? { warrantyText: dto.warrantyText.trim() || null } : {}),
        ...(dto.durationDays !== undefined ? { durationDays: dto.durationDays } : {}),
        ...(dto.includedScope !== undefined ? { includedScope: dto.includedScope.trim() || null } : {}),
        ...(dto.excludedScope !== undefined ? { excludedScope: dto.excludedScope.trim() || null } : {}),
        ...(dto.validUntil !== undefined ? { validUntil: new Date(`${dto.validUntil.slice(0, 10)}T00:00:00Z`) } : {}),
        ...(usd ? { exchangeRateUsd: usd.rateToUzs, exchangeRateDate: usd.rateDate } : {}),
      },
    });
    // Manfiy total — xato (13.3): saqlashdan oldin tekshiriladi, shuning uchun tranzaksiya bekor bo‘ladi.
    if (totals.total.isNegative()) throw unprocessable('QUOTE_TOTAL_NEGATIVE');
  }

  /** Yuborishdan oldin majburiy maydonlar (13.3). */
  private assertSendable(quote: QuoteFull) {
    if (quote.items.length === 0) throw unprocessable('QUOTE_ITEMS_REQUIRED');
    if (!quote.validUntil || quote.warrantyEquipmentMonths === null || quote.warrantyInstallationMonths === null || !quote.durationDays || !quote.includedScope?.trim() || !quote.excludedScope?.trim()) {
      throw unprocessable('QUOTE_INCOMPLETE');
    }
    if (quote.validUntil.toISOString().slice(0, 10) <= tashkentDate()) throw unprocessable('QUOTE_VALID_UNTIL_PAST');
    if (quote.total.isNegative()) throw unprocessable('QUOTE_TOTAL_NEGATIVE');
  }

  // ───────────── Do‘kon amallari ─────────────

  async createDraft(userId: string, requestId: string, dto: CreateQuoteDto) {
    await this.member(userId, dto.shopId, 'quote.draft');
    const rs = await this.db.quoteRequestShop.findUnique({ where: { requestId_shopId: { requestId, shopId: dto.shopId } }, include: { request: { select: { status: true, systemType: true, requiredCapacityKw: true } } } });
    if (!rs) throw new NotFoundException(ERRORS.QUOTE_REQUEST_NOT_FOUND);
    if (rs.request.status !== 'OPEN') throw conflict('QUOTE_REQUEST_NOT_OPEN');
    if (!['SENT', 'VIEWED', 'CLARIFICATION_REQUESTED', 'QUOTED'].includes(rs.status)) throw new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);
    const id = await this.db.$transaction(async (tx) => {
      let quote: Quote;
      try {
        quote = await tx.quote.create({
          data: { requestId, shopId: dto.shopId, createdById: userId, systemType: dto.systemType ?? rs.request.systemType, systemPowerKw: dto.systemPowerKw ?? rs.request.requiredCapacityKw ?? null },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw conflict('QUOTE_ACTIVE_EXISTS');
        throw error;
      }
      await this.writeFields(tx, quote, dto);
      return quote.id;
    });
    return this.view(await this.load(id), 'SHOP');
  }

  async updateDraft(userId: string, quoteId: string, dto: UpdateQuoteDto) {
    const quote = await this.forShop(userId, quoteId, 'quote.draft');
    if (quote.status !== 'DRAFT') throw conflict('QUOTE_NOT_DRAFT');
    await this.db.$transaction(async (tx) => {
      const bumped = await tx.quote.updateMany({ where: { id: quote.id, version: dto.version, status: 'DRAFT' }, data: { version: { increment: 1 } } });
      if (!bumped.count) throw conflict('VERSION_CONFLICT');
      await this.writeFields(tx, quote, dto);
    });
    return this.view(await this.load(quote.id), 'SHOP');
  }

  /** DRAFT → SENT (revision 1); so‘rov-do‘kon → QUOTED; mijozga QUOTE_RECEIVED. */
  async send(userId: string, quoteId: string) {
    const quote = await this.forShop(userId, quoteId, 'quote.send');
    assertQuoteTransition(quote.status, 'SENT', 'SHOP');
    if (quote.status !== 'DRAFT') throw conflict('QUOTE_NOT_DRAFT');
    if (quote.request.status !== 'OPEN') throw conflict('QUOTE_REQUEST_NOT_OPEN');
    this.assertSendable(quote);
    await this.db.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.quote.updateMany({ where: { id: quote.id, status: 'DRAFT', version: quote.version }, data: { status: 'SENT', sentAt: now, currentRevision: 1, viewedAt: null, version: { increment: 1 } } });
      if (!updated.count) throw conflict('VERSION_CONFLICT');
      const fresh = await this.load(quote.id, tx);
      await tx.quoteRevision.create({ data: { quoteId: quote.id, revision: 1, snapshotJson: snapshotOf(fresh) as Prisma.InputJsonValue, createdBy: userId } });
      const rs = await tx.quoteRequestShop.findUniqueOrThrow({ where: { requestId_shopId: { requestId: quote.requestId, shopId: quote.shopId } } });
      if (rs.status !== 'QUOTED') assertRequestShopTransition(rs.status, 'QUOTED', 'SHOP');
      await tx.quoteRequestShop.update({ where: { id: rs.id }, data: { status: 'QUOTED', pipelineStage: 'PROPOSAL', firstResponseAt: rs.firstResponseAt ?? now, viewedAt: rs.viewedAt ?? now } });
      await tx.quoteRequest.update({ where: { id: quote.requestId }, data: { lastActivityAt: now } });
      await this.requests.systemMessage(tx, rs.id, 'QUOTE', `Do‘kon taklif yubordi: ${formatSum(fresh.total)}`);
      await this.analytics.track({ eventType: 'quote_sent', userId, shopId: quote.shopId, entityId: quote.id }, tx);
      await this.notify.toUser(tx, quote.request.userId, { type: 'QUOTE_RECEIVED', title: 'Yangi taklif keldi', body: `${quote.shop.name}: ${formatSum(fresh.total)}. Batafsil ko‘ring va solishtiring.`, entityType: 'Quote', entityId: quote.id }, userId);
    });
    return this.view(await this.load(quote.id), 'SHOP');
  }

  /** SENT/VIEWED → SENT: yangi revision, mijozga QUOTE_REVISED; VIEWED qayta hisoblanadi. */
  async revise(userId: string, quoteId: string, dto: UpdateQuoteDto) {
    const quote = await this.forShop(userId, quoteId, 'quote.send');
    if (!['SENT', 'VIEWED'].includes(quote.status)) throw new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);
    assertQuoteTransition(quote.status, 'SENT', 'SHOP');
    if (quote.request.status !== 'OPEN') throw conflict('QUOTE_REQUEST_NOT_OPEN');
    await this.db.$transaction(async (tx) => {
      const bumped = await tx.quote.updateMany({ where: { id: quote.id, version: dto.version, status: { in: ['SENT', 'VIEWED'] } }, data: { version: { increment: 1 } } });
      if (!bumped.count) throw conflict('VERSION_CONFLICT');
      await this.writeFields(tx, quote, dto);
      const fresh = await this.load(quote.id, tx);
      this.assertSendable(fresh);
      const revision = fresh.currentRevision + 1;
      await tx.quote.update({ where: { id: quote.id }, data: { status: 'SENT', currentRevision: revision, viewedAt: null, sentAt: new Date(), expiringNotifiedAt: null } });
      await tx.quoteRevision.create({ data: { quoteId: quote.id, revision, snapshotJson: snapshotOf({ ...fresh, currentRevision: revision }) as Prisma.InputJsonValue, createdBy: userId } });
      const rs = await tx.quoteRequestShop.findUniqueOrThrow({ where: { requestId_shopId: { requestId: quote.requestId, shopId: quote.shopId } } });
      await tx.quoteRequest.update({ where: { id: quote.requestId }, data: { lastActivityAt: new Date() } });
      await this.requests.systemMessage(tx, rs.id, 'REVISION', `Taklif yangilandi (tahrir ${revision}): ${formatSum(fresh.total)}`);
      await this.notify.toUser(tx, quote.request.userId, { type: 'QUOTE_REVISED', title: 'Taklif yangilandi', body: `${quote.shop.name}: tahrir ${revision} — ${formatSum(fresh.total)}.`, entityType: 'Quote', entityId: quote.id }, userId);
    });
    return this.view(await this.load(quote.id), 'SHOP');
  }

  async withdraw(userId: string, quoteId: string) {
    const quote = await this.forShop(userId, quoteId, 'quote.withdraw');
    assertQuoteTransition(quote.status, 'WITHDRAWN', 'SHOP');
    await this.db.$transaction(async (tx) => {
      const updated = await tx.quote.updateMany({ where: { id: quote.id, status: quote.status }, data: { status: 'WITHDRAWN', decidedAt: new Date(), version: { increment: 1 } } });
      if (!updated.count) throw new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);
      if (quote.status !== 'DRAFT') {
        const rs = await tx.quoteRequestShop.findUniqueOrThrow({ where: { requestId_shopId: { requestId: quote.requestId, shopId: quote.shopId } } });
        await this.requests.systemMessage(tx, rs.id, 'QUOTE', 'Do‘kon taklifni qaytarib oldi');
        await this.notify.toUser(tx, quote.request.userId, { type: 'QUOTE_REVISED', title: 'Taklif qaytarib olindi', body: `${quote.shop.name} taklifini qaytarib oldi.`, entityType: 'QuoteRequest', entityId: quote.requestId, newStatus: 'WITHDRAWN' }, userId);
      }
    });
    return { status: 'WITHDRAWN' };
  }

  // ───────────── Mijoz amallari ─────────────

  /**
   * Qabul (U9.7): "Siz bu do‘kon bilan ishlashni tanladingiz" — shartnoma yoki to‘lov emas.
   * Quote → ACCEPTED, so‘rov → CLOSED_SELECTED, boshqalar NOT_SELECTED, kontakt ochiladi, Installation AGREED.
   */
  async accept(userId: string, quoteId: string) {
    const quote = await this.forCustomer(userId, quoteId);
    assertQuoteTransition(quote.status, 'ACCEPTED', 'CUSTOMER');
    if (!quote.validUntil || quote.validUntil.toISOString().slice(0, 10) < tashkentDate()) throw conflict('QUOTE_EXPIRED');
    assertRequestTransition(quote.request.status as never, 'CLOSED_SELECTED', 'SYSTEM');
    const installationId = await this.db.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.quote.updateMany({ where: { id: quote.id, status: { in: ['SENT', 'VIEWED'] } }, data: { status: 'ACCEPTED', decidedAt: now, viewedAt: quote.viewedAt ?? now, version: { increment: 1 } } });
      const closed = await tx.quoteRequest.updateMany({ where: { id: quote.requestId, status: 'OPEN' }, data: { status: 'CLOSED_SELECTED', closedAt: now, lastActivityAt: now } });
      if (!updated.count || !closed.count) throw new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);
      const rs = await tx.quoteRequestShop.findUniqueOrThrow({ where: { requestId_shopId: { requestId: quote.requestId, shopId: quote.shopId } } });
      assertRequestShopTransition(rs.status, 'SELECTED', 'CUSTOMER');
      await tx.quoteRequestShop.update({ where: { id: rs.id }, data: { status: 'SELECTED', pipelineStage: 'WON' } });
      await this.requests.revealContactTx(tx, rs.id, userId, 'ACCEPT');
      await this.requests.closeOutShops(tx, quote.requestId, quote.shopId, 'OTHER_SELECTED');
      const systemType = quote.systemType ?? quote.request.systemType;
      const template = await tx.acceptanceChecklistTemplate.findFirst({ where: { systemType, active: true }, orderBy: { version: 'desc' }, select: { id: true } });
      const installation = await tx.installation.create({
        data: {
          quoteId: quote.id, requestId: quote.requestId, userId, shopId: quote.shopId, status: 'AGREED', checklistTemplateId: template?.id ?? null,
          historyJson: [{ status: 'AGREED', at: now.toISOString(), side: 'CUSTOMER' }] as Prisma.InputJsonValue,
        },
      });
      // Tasdiqlangan o‘lchov bo‘lsa — darhol SITE_VISIT_SCHEDULED (13.1).
      const visit = await tx.siteVisit.findFirst({ where: { requestShopId: rs.id, status: 'CONFIRMED' } });
      if (visit) {
        await tx.installation.update({ where: { id: installation.id }, data: { status: 'SITE_VISIT_SCHEDULED', historyJson: [{ status: 'AGREED', at: now.toISOString(), side: 'CUSTOMER' }, { status: 'SITE_VISIT_SCHEDULED', at: now.toISOString(), side: 'SYSTEM', note: visit.confirmedStart ? tashkentDateTime(visit.confirmedStart) : undefined }] as Prisma.InputJsonValue } });
      }
      await this.requests.systemMessage(tx, rs.id, 'STATUS', 'Mijoz shu do‘kon bilan ishlashni tanladi');
      await this.analytics.track({ eventType: 'quote_accepted', userId, shopId: quote.shopId, entityId: quote.id }, tx);
      await this.notify.toShop(tx, quote.shopId, { type: 'QUOTE_ACCEPTED', title: 'Taklifingiz tanlandi', body: `So‘rov №${quote.request.number}: mijoz siz bilan ishlashni tanladi. Kontakt ochildi.`, entityType: 'Installation', entityId: installation.id }, { actorId: userId, assignedMemberId: rs.assignedMemberId });
      return installation.id;
    });
    return { status: 'ACCEPTED', installationId };
  }

  async reject(userId: string, quoteId: string, dto: RejectQuoteDto) {
    const quote = await this.forCustomer(userId, quoteId);
    assertQuoteTransition(quote.status, 'REJECTED', 'CUSTOMER');
    await this.db.$transaction(async (tx) => {
      const updated = await tx.quote.updateMany({ where: { id: quote.id, status: { in: ['SENT', 'VIEWED'] } }, data: { status: 'REJECTED', decidedAt: new Date(), rejectReason: dto.reason?.trim() || null } });
      if (!updated.count) throw new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);
      const rs = await tx.quoteRequestShop.findUniqueOrThrow({ where: { requestId_shopId: { requestId: quote.requestId, shopId: quote.shopId } } });
      await this.requests.systemMessage(tx, rs.id, 'QUOTE', `Mijoz taklifni rad etdi${dto.reason?.trim() ? `: ${dto.reason.trim()}` : ''}`);
      await this.notify.toShop(tx, quote.shopId, { type: 'QUOTE_NOT_SELECTED', title: 'Taklif rad etildi', body: `So‘rov №${quote.request.number}${dto.reason?.trim() ? `: ${dto.reason.trim()}` : ''}`, entityType: 'RequestShop', entityId: rs.id }, { actorId: userId, assignedMemberId: rs.assignedMemberId });
    });
    return { status: 'REJECTED' };
  }

  // ───────────── O‘qish ─────────────

  /** Ikki tomon: mijoz birinchi ochganda SENT → VIEWED. */
  async get(userId: string, quoteId: string, panel: Panel | null) {
    const quote = await this.load(quoteId);
    const isCustomer = quote.request.userId === userId && CUSTOMER_VISIBLE_QUOTE.includes(quote.status);
    const member = await this.db.shopMember.findUnique({ where: { shopId_userId: { shopId: quote.shopId, userId } }, select: { memberRole: true, permissions: true } });
    const asShop = member && (panel === 'SHOP' || !isCustomer) && (member.memberRole === 'OWNER' || member.permissions.includes('requests.read') || member.permissions.includes('quote.draft'));
    if (asShop) return this.view(quote, 'SHOP');
    if (!isCustomer) throw new NotFoundException(ERRORS.QUOTE_NOT_FOUND);
    if (quote.status === 'SENT') {
      await this.db.quote.updateMany({ where: { id: quote.id, status: 'SENT' }, data: { status: 'VIEWED', viewedAt: new Date() } });
      return this.view(await this.load(quote.id), 'CUSTOMER');
    }
    return this.view(quote, 'CUSTOMER');
  }

  async revision(userId: string, quoteId: string, revision: number, panel: Panel | null) {
    await this.get(userId, quoteId, panel);
    const row = await this.db.quoteRevision.findUnique({ where: { quoteId_revision: { quoteId, revision } } });
    if (!row) throw new NotFoundException(ERRORS.QUOTE_NOT_FOUND);
    return row;
  }

  private view(quote: QuoteFull, side: Side) {
    const total = Number(quote.total);
    const power = quote.systemPowerKw ? Number(quote.systemPowerKw) : null;
    const financing = quote.financingOptions.map((f) => {
      const down = total * Number(f.downPaymentPct);
      const loan = total > 0 ? loanSchedule({ initialCost: total, downPayment: down, annualRate: Number(f.annualRate), termMonths: f.termMonths, paymentType: f.paymentType }) : null;
      return { ...f, monthlyPayment: loan ? Math.round(loan.firstPayment) : null, totalInterest: loan ? Math.round(loan.totalInterest) : null };
    });
    return {
      id: quote.id,
      side,
      status: quote.status,
      requestId: quote.requestId,
      request: { id: quote.request.id, number: quote.request.number, title: quote.request.title, status: quote.request.status },
      shop: quote.shop,
      currentRevision: quote.currentRevision,
      revisions: quote.revisions,
      items: quote.items,
      financingOptions: financing,
      equipmentSubtotal: quote.equipmentSubtotal, installationSubtotal: quote.installationSubtotal, deliveryCost: quote.deliveryCost, otherCosts: quote.otherCosts,
      discountAmount: quote.discountAmount, vatIncluded: quote.vatIncluded, vatRate: quote.vatRate, vatAmount: quote.vatAmount, total: quote.total, currency: quote.currency,
      pricePerKw: power ? Math.round(total / power) : null,
      exchangeRateUsd: quote.exchangeRateUsd, exchangeRateDate: quote.exchangeRateDate,
      systemPowerKw: quote.systemPowerKw, systemType: quote.systemType,
      warrantyEquipmentMonths: quote.warrantyEquipmentMonths, warrantyInstallationMonths: quote.warrantyInstallationMonths, warrantyText: quote.warrantyText,
      durationDays: quote.durationDays, includedScope: quote.includedScope, excludedScope: quote.excludedScope, validUntil: quote.validUntil,
      sentAt: quote.sentAt, viewedAt: quote.viewedAt, decidedAt: quote.decidedAt, rejectReason: side === 'SHOP' ? quote.rejectReason : undefined,
      installation: quote.installation,
      version: quote.version,
      updatedAt: quote.updatedAt,
    };
  }

  /** Do‘kon: shu so‘rov bo‘yicha o‘z taklifi (quote builder). */
  async forRequestShop(ctx: ShopContext, requestShopId: string) {
    const rs = await this.db.quoteRequestShop.findFirst({ where: { id: requestShopId, shopId: ctx.shopId }, select: { requestId: true } });
    if (!rs) throw new NotFoundException(ERRORS.REQUEST_SHOP_NOT_FOUND);
    const quote = await this.db.quote.findFirst({ where: { requestId: rs.requestId, shopId: ctx.shopId, status: { not: 'WITHDRAWN' } }, include: QUOTE_INCLUDE });
    return quote ? this.view(quote, 'SHOP') : null;
  }

  /** Quote builder katalogi: do‘kon mahsulotlari, narx so‘mda (USD — MB kursi bilan, 13.3). */
  async builderCatalog(ctx: ShopContext, query: BuilderCatalogQueryDto) {
    const search = query.search?.trim();
    const [products, services, usd] = await Promise.all([
      this.db.shopProduct.findMany({
        where: { shopId: ctx.shopId, status: 'ACTIVE', ...(search ? { productModel: { OR: [{ brand: { contains: search, mode: 'insensitive' } }, { model: { contains: search, mode: 'insensitive' } }] } } : {}) },
        take: query.limit ?? 40,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          productModel: { select: { id: true, brand: true, model: true, nominalPowerW: true, inverterAcKw: true, batteryCapacityKwh: true, warrantyMonths: true, category: { select: { slug: true, nameI18n: true } } } },
          offers: { orderBy: { updatedAt: 'desc' }, take: 1, select: { price: true, currency: true, vatIncluded: true, stockStatus: true } },
        },
      }),
      this.db.service.findMany({ where: { shopId: ctx.shopId, active: true }, select: { id: true, serviceType: true, pricingModel: true, price: true, currency: true, warrantyMonths: true } }),
      this.db.exchangeRate.findFirst({ where: { currency: 'USD' }, orderBy: { rateDate: 'desc' } }),
    ]);
    const rate = usd ? Number(usd.rateToUzs) : null;
    const toUzs = (price: Prisma.Decimal | null, currency: string) => (price === null ? null : currency === 'USD' ? (rate ? Math.round(Number(price) * rate) : null) : Number(price));
    return {
      exchangeRate: usd ? { rateToUzs: usd.rateToUzs, rateDate: usd.rateDate } : null,
      products: products.map((p) => ({ shopProductId: p.id, model: p.productModel, offer: p.offers[0] ?? null, priceUzs: p.offers[0] ? toUzs(p.offers[0].price, p.offers[0].currency) : null })),
      services: services.map((s) => ({ ...s, priceUzs: toUzs(s.price, s.currency) })),
    };
  }

  /**
   * Takliflarni solishtirish (U9.6, TZ 4.12): faqat haqiqiy taqqoslashdan belgilar; har taklif uchun
   * hisob natijasidan o‘zini oqlash oralig‘i (past/yuqori ssenariy, taklif narxi va quvvati bilan).
   */
  async compare(userId: string, requestId: string) {
    const request = await this.db.quoteRequest.findFirst({ where: { id: requestId, userId } });
    if (!request) throw new NotFoundException(ERRORS.QUOTE_REQUEST_NOT_FOUND);
    const quotes = await this.db.quote.findMany({ where: { requestId, status: { in: ['SENT', 'VIEWED', 'ACCEPTED', 'EXPIRED'] } }, include: QUOTE_INCLUDE, orderBy: { total: 'asc' } });
    const calc = request.calculationId ? await this.db.calculation.findUnique({ where: { id: request.calculationId }, select: { outputSummaryJson: true } }) : null;
    const result = calc?.outputSummaryJson;
    const calcPower = numAt(result, 'systemPowerKw') || null;
    const benefit = (scenario: 'low' | 'high') => {
      const saving = numAt(result, `scenarios.${scenario}.saving`);
      return saving === null ? null : saving + (numAt(result, `scenarios.${scenario}.exportIncome`) ?? 0) - (numAt(result, 'money.annualOpex') ?? 0);
    };
    const lowBenefit = benefit('low');
    const highBenefit = benefit('high');

    const rows = quotes.map((quote) => {
      const view = this.view(quote, 'CUSTOMER');
      const power = quote.systemPowerKw ? Number(quote.systemPowerKw) : calcPower;
      const scale = power && calcPower ? power / calcPower : 1;
      const payback = (b: number | null) => (b && b > 0 ? Math.round((Number(quote.total) / (b * scale)) * 10) / 10 : null);
      const p1 = payback(highBenefit);
      const p2 = payback(lowBenefit);
      return { ...view, paybackRange: p1 !== null && p2 !== null ? [Math.min(p1, p2), Math.max(p1, p2)] : null };
    });
    const best = (pick: (r: (typeof rows)[number]) => number | null, dir: 'min' | 'max') => {
      const values = rows.map(pick).filter((v): v is number => v !== null);
      if (rows.length < 2 || values.length === 0) return null;
      return dir === 'min' ? Math.min(...values) : Math.max(...values);
    };
    const cheapest = best((r) => r.pricePerKw, 'min');
    const longest = best((r) => (r.warrantyEquipmentMonths ?? 0) + 0, 'max');
    const fastest = best((r) => r.durationDays, 'min');
    return {
      request: { id: request.id, number: request.number, status: request.status, calculationId: request.calculationId },
      quotes: rows.map((r) => ({
        ...r,
        badges: [
          ...(cheapest !== null && r.pricePerKw === cheapest ? ['CHEAPEST_PER_KW'] : []),
          ...(longest !== null && longest > 0 && r.warrantyEquipmentMonths === longest ? ['LONGEST_WARRANTY'] : []),
          ...(fastest !== null && r.durationDays === fastest ? ['FASTEST_INSTALL'] : []),
        ],
        expiringSoon: !!r.validUntil && ['SENT', 'VIEWED'].includes(r.status) && r.validUntil.getTime() - Date.now() <= 48 * 3_600_000,
      })),
    };
  }

  // ───────────── Joblar (14.1) ─────────────

  /** quote-expiry-check: validUntil o‘tgan SENT/VIEWED → EXPIRED; 48 soat qolganda QUOTE_EXPIRING. */
  async expireAndWarn(now = new Date()) {
    const today = tashkentDate(now);
    const expired = await this.db.quote.findMany({ where: { status: { in: ['SENT', 'VIEWED'] }, validUntil: { lt: new Date(`${today}T00:00:00Z`) } }, select: { id: true, status: true } });
    for (const q of expired) {
      assertQuoteTransition(q.status as QuoteStatus, 'EXPIRED', 'SYSTEM');
      await this.db.quote.updateMany({ where: { id: q.id, status: q.status }, data: { status: 'EXPIRED' } });
    }
    const soon = new Date(now.getTime() + 48 * 3_600_000);
    const expiring = await this.db.quote.findMany({
      where: { status: { in: ['SENT', 'VIEWED'] }, expiringNotifiedAt: null, validUntil: { lte: new Date(`${tashkentDate(soon)}T00:00:00Z`), gte: new Date(`${today}T00:00:00Z`) } },
      select: { id: true, request: { select: { userId: true, number: true } }, shop: { select: { name: true } } },
    });
    for (const q of expiring) {
      await this.db.$transaction(async (tx) => {
        const marked = await tx.quote.updateMany({ where: { id: q.id, expiringNotifiedAt: null }, data: { expiringNotifiedAt: now } });
        if (!marked.count) return;
        await this.notify.toUser(tx, q.request.userId, { type: 'QUOTE_EXPIRING', title: 'Taklif muddati tugayapti', body: `${q.shop.name} taklifining muddati 2 kundan kam qoldi.`, entityType: 'Quote', entityId: q.id });
      });
    }
    return { expired: expired.length, warned: expiring.length };
  }

  /** PDF uchun to‘liq ma’lumot (ikki tomon ham ko‘ra oladi). */
  async forPdf(userId: string, quoteId: string, panel: Panel | null) {
    const view = await this.get(userId, quoteId, panel);
    const shop = await this.db.shop.findUniqueOrThrow({ where: { id: view.shop.id }, select: { name: true, phone: true, email: true, stir: true } });
    return { view, shop };
  }
}
