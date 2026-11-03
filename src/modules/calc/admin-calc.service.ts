import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PublishStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DomainException } from '../../common/exceptions/business.exception';
import { DEFAULT_SETTINGS } from '../calc-engine';
import { SolarService } from './solar.service';
import { CalcAdminQueryDto, ExportRuleDto, FinancingProductDto, GridLimitDto, RegionalYieldDto, SettingsVersionDto, TariffDto } from './dto/admin-calc.dto';

const conflict = (code: string, message: string) => new DomainException(HttpStatus.CONFLICT, code, message);
const invalid = (message: string) => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', message);
const date = (value: string | null | undefined) => (value ? new Date(value.slice(0, 10)) : null);

/** Exclusion constraint buzilishi (kesishuvchi PUBLISHED davrlar) → 409. */
function isOverlap(error: unknown) {
  const text = String((error as { message?: string })?.message ?? '');
  return text.includes('no_overlap') || text.includes('23P01') || text.includes('exclusion');
}

/**
 * Admin: tarif va hisob ma’lumotlari (TZ 9.9, U12). Qoida: PUBLISHED yozuv o‘zgartirilmaydi (tarixiy hisoblar snapshot bilan),
 * o‘zgarish uchun nusxa (yangi versiya) olinadi; tasdiqlash uchun manba (sourceUrl) majburiy.
 */
@Injectable()
export class AdminCalcService {
  constructor(
    private readonly db: PrismaService,
    private readonly solar: SolarService,
  ) {}

  private audit(actorId: string, action: string, targetType: string, targetId: string, after?: Prisma.InputJsonValue, before?: Prisma.InputJsonValue) {
    return this.db.auditLog.create({ data: { actorId, action, targetType, targetId, after, before } });
  }

  private assertDates(from: string, until?: string | null) {
    if (until && until.slice(0, 10) < from.slice(0, 10)) throw invalid('Tugash sanasi boshlanishidan oldin bo‘lishi mumkin emas');
  }

  /** Pog‘onalar bir mavsum + TOU ichida kesishmaydi va [min, max) ketma-ket (TZ 7.5). */
  private assertTiers(dto: TariffDto) {
    const groups = new Map<string, Array<{ min: number; max: number }>>();
    for (const tier of dto.tiers) {
      if (tier.maxKwh != null && tier.maxKwh <= tier.minKwh) throw invalid('Pog‘ona: max > min bo‘lishi kerak');
      const months = (tier.seasonMonths ?? []).length ? tier.seasonMonths! : [0];
      for (const m of months) {
        const key = `${m}:${tier.touPeriod ?? 'ALL'}`;
        const list = groups.get(key) ?? [];
        list.push({ min: tier.minKwh, max: tier.maxKwh ?? Infinity });
        groups.set(key, list);
      }
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.min - b.min);
      for (let i = 1; i < list.length; i += 1) if (list[i]!.min < list[i - 1]!.max) throw invalid('Pog‘onalar kesishmasligi kerak');
    }
    if (dto.touEnabled && !(dto.touPeriods ?? []).length) throw invalid('Kun/tun tarifida davrlar soatini kiriting');
    if (dto.touEnabled && dto.tiers.some((tier) => (tier.touPeriod ?? 'ALL') === 'ALL')) throw invalid('Kun/tun tarifida pog‘ona davri DAY yoki NIGHT bo‘lishi kerak');
  }

  // ───────────── Tariflar ─────────────

  listTariffs(query: CalcAdminQueryDto) {
    return this.db.tariffSchedule.findMany({
      where: { status: query.status, regionCode: query.regionCode, customerType: query.customerType },
      orderBy: [{ regionCode: 'asc' }, { customerType: 'asc' }, { effectiveFrom: 'desc' }],
      include: { tiers: { orderBy: [{ touPeriod: 'asc' }, { minKwh: 'asc' }] }, touPeriods: true },
    });
  }

  private tariffData(dto: TariffDto) {
    return {
      regionCode: dto.regionCode,
      customerType: dto.customerType,
      title: dto.title.trim(),
      fixedChargeMonthly: dto.fixedChargeMonthly ?? null,
      touEnabled: !!dto.touEnabled,
      sourceUrl: dto.sourceUrl ?? null,
      effectiveFrom: date(dto.effectiveFrom)!,
      effectiveUntil: date(dto.effectiveUntil),
    };
  }

  async createTariff(actorId: string, dto: TariffDto) {
    this.assertDates(dto.effectiveFrom, dto.effectiveUntil);
    this.assertTiers(dto);
    const tariff = await this.db.tariffSchedule.create({
      data: {
        ...this.tariffData(dto),
        tiers: { create: dto.tiers.map((tier) => ({ seasonMonths: tier.seasonMonths ?? [], touPeriod: tier.touPeriod ?? 'ALL', minKwh: tier.minKwh, maxKwh: tier.maxKwh ?? null, ratePerKwh: tier.ratePerKwh, notes: tier.notes })) },
        touPeriods: { create: (dto.touPeriods ?? []).map((period) => ({ touPeriod: period.touPeriod, startHour: period.startHour, endHour: period.endHour })) },
      },
      include: { tiers: true, touPeriods: true },
    });
    await this.audit(actorId, 'TARIFF_CREATED', 'TariffSchedule', tariff.id, { regionCode: tariff.regionCode, title: tariff.title });
    return tariff;
  }

  async updateTariff(actorId: string, id: string, dto: TariffDto) {
    const current = await this.db.tariffSchedule.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Tarif topilmadi');
    if (current.status !== 'DRAFT') throw conflict('TARIFF_NOT_EDITABLE', 'Tasdiqlangan tarif o‘zgartirilmaydi — nusxa oling');
    this.assertDates(dto.effectiveFrom, dto.effectiveUntil);
    this.assertTiers(dto);
    const tariff = await this.db.$transaction(async (tx) => {
      await tx.tariffTier.deleteMany({ where: { scheduleId: id } });
      await tx.tariffTouPeriod.deleteMany({ where: { scheduleId: id } });
      return tx.tariffSchedule.update({
        where: { id },
        data: {
          ...this.tariffData(dto),
          tiers: { create: dto.tiers.map((tier) => ({ seasonMonths: tier.seasonMonths ?? [], touPeriod: tier.touPeriod ?? 'ALL', minKwh: tier.minKwh, maxKwh: tier.maxKwh ?? null, ratePerKwh: tier.ratePerKwh, notes: tier.notes })) },
          touPeriods: { create: (dto.touPeriods ?? []).map((period) => ({ touPeriod: period.touPeriod, startHour: period.startHour, endHour: period.endHour })) },
        },
        include: { tiers: true, touPeriods: true },
      });
    });
    await this.audit(actorId, 'TARIFF_UPDATED', 'TariffSchedule', id);
    return tariff;
  }

  /** Nusxa — yangi versiya (DRAFT), yangi amal sanasi bilan. */
  async copyTariff(actorId: string, id: string) {
    const source = await this.db.tariffSchedule.findUnique({ where: { id }, include: { tiers: true, touPeriods: true } });
    if (!source) throw new NotFoundException('Tarif topilmadi');
    const copy = await this.db.tariffSchedule.create({
      data: {
        regionCode: source.regionCode, customerType: source.customerType, title: source.title, fixedChargeMonthly: source.fixedChargeMonthly, touEnabled: source.touEnabled, sourceUrl: source.sourceUrl,
        effectiveFrom: new Date(), effectiveUntil: null, status: 'DRAFT', version: source.version + 1,
        tiers: { create: source.tiers.map(({ seasonMonths, touPeriod, minKwh, maxKwh, ratePerKwh, notes, currency }) => ({ seasonMonths, touPeriod, minKwh, maxKwh, ratePerKwh, notes, currency })) },
        touPeriods: { create: source.touPeriods.map(({ touPeriod, startHour, endHour }) => ({ touPeriod, startHour, endHour })) },
      },
      include: { tiers: true, touPeriods: true },
    });
    await this.audit(actorId, 'TARIFF_COPIED', 'TariffSchedule', copy.id, { fromId: id });
    return copy;
  }

  async setTariffStatus(actorId: string, id: string, status: PublishStatus) {
    const current = await this.db.tariffSchedule.findUnique({ where: { id }, include: { _count: { select: { tiers: true } } } });
    if (!current) throw new NotFoundException('Tarif topilmadi');
    if (status === 'PUBLISHED') {
      if (current.status !== 'DRAFT') throw conflict('INVALID_STATUS_TRANSITION', 'Faqat qoralamani tasdiqlash mumkin');
      if (!current.sourceUrl) throw invalid('Tasdiqlash uchun rasmiy manba havolasini kiriting');
      if (!current._count.tiers) throw invalid('Kamida bitta pog‘ona kerak');
    }
    try {
      const updated = await this.db.tariffSchedule.update({ where: { id }, data: { status, ...(status === 'PUBLISHED' ? { verifiedAt: new Date(), verifiedById: actorId } : {}) } });
      await this.audit(actorId, `TARIFF_${status}`, 'TariffSchedule', id, { status }, { status: current.status });
      return updated;
    } catch (error) {
      if (isOverlap(error)) throw conflict('TARIFF_PERIOD_OVERLAP', 'Shu hudud va iste’molchi turi uchun amal davri boshqa tasdiqlangan tarif bilan kesishadi — avvalgisiga tugash sanasini qo‘ying');
      throw error;
    }
  }

  async setTariffUntil(actorId: string, id: string, effectiveUntil: string | null) {
    const current = await this.db.tariffSchedule.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Tarif topilmadi');
    if (effectiveUntil) this.assertDates(current.effectiveFrom.toISOString(), effectiveUntil);
    const updated = await this.db.tariffSchedule.update({ where: { id }, data: { effectiveUntil: date(effectiveUntil) } });
    await this.audit(actorId, 'TARIFF_UNTIL_SET', 'TariffSchedule', id, { effectiveUntil });
    return updated;
  }

  // ───────────── Eksport qoidalari va ulanish limitlari ─────────────

  listExportRules(query: CalcAdminQueryDto) {
    return this.db.exportRule.findMany({ where: { status: query.status, regionCode: query.regionCode, customerType: query.customerType }, orderBy: [{ regionCode: 'asc' }, { effectiveFrom: 'desc' }] });
  }

  async saveExportRule(actorId: string, dto: ExportRuleDto, id?: string) {
    this.assertDates(dto.effectiveFrom, dto.effectiveUntil);
    if ((dto.compensationType === 'NET_BILLING' || dto.compensationType === 'FEED_IN') && dto.ratePerKwh == null) throw invalid('Eksport stavkasini kiriting');
    const data = { regionCode: dto.regionCode, customerType: dto.customerType, compensationType: dto.compensationType, ratePerKwh: dto.ratePerKwh ?? null, settlementPeriod: dto.settlementPeriod ?? 'MONTH', maxSystemKw: dto.maxSystemKw ?? null, eligibilityJson: (dto.eligibilityJson ?? undefined) as Prisma.InputJsonValue | undefined, sourceUrl: dto.sourceUrl ?? null, effectiveFrom: date(dto.effectiveFrom)!, effectiveUntil: date(dto.effectiveUntil) };
    if (id) {
      const current = await this.db.exportRule.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Qoida topilmadi');
      if (current.status !== 'DRAFT') throw conflict('EXPORT_RULE_NOT_EDITABLE', 'Tasdiqlangan qoida o‘zgartirilmaydi');
      const rule = await this.db.exportRule.update({ where: { id }, data });
      await this.audit(actorId, 'EXPORT_RULE_UPDATED', 'ExportRule', id);
      return rule;
    }
    const rule = await this.db.exportRule.create({ data });
    await this.audit(actorId, 'EXPORT_RULE_CREATED', 'ExportRule', rule.id);
    return rule;
  }

  async setExportRuleStatus(actorId: string, id: string, status: PublishStatus) {
    const current = await this.db.exportRule.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Qoida topilmadi');
    if (status === 'PUBLISHED' && !current.sourceUrl) throw invalid('Tasdiqlash uchun rasmiy manba havolasini kiriting');
    try {
      const rule = await this.db.exportRule.update({ where: { id }, data: { status, ...(status === 'PUBLISHED' ? { verifiedAt: new Date() } : {}) } });
      await this.audit(actorId, `EXPORT_RULE_${status}`, 'ExportRule', id);
      return rule;
    } catch (error) {
      if (isOverlap(error)) throw conflict('EXPORT_RULE_PERIOD_OVERLAP', 'Amal davri boshqa tasdiqlangan qoida bilan kesishadi');
      throw error;
    }
  }

  listGridLimits() {
    return this.db.gridConnectionLimit.findMany({ orderBy: [{ regionCode: 'asc' }, { effectiveFrom: 'desc' }] });
  }

  async createGridLimit(actorId: string, dto: GridLimitDto) {
    const row = await this.db.gridConnectionLimit.create({ data: { regionCode: dto.regionCode, customerType: dto.customerType, maxKw: dto.maxKw, sourceUrl: dto.sourceUrl ?? null, effectiveFrom: date(dto.effectiveFrom)!, status: dto.sourceUrl ? 'PUBLISHED' : 'DRAFT', verifiedAt: dto.sourceUrl ? new Date() : null } });
    await this.audit(actorId, 'GRID_LIMIT_CREATED', 'GridConnectionLimit', row.id, { maxKw: dto.maxKw });
    return row;
  }

  async setGridLimitStatus(actorId: string, id: string, status: PublishStatus) {
    const row = await this.db.gridConnectionLimit.update({ where: { id }, data: { status } }).catch(() => null);
    if (!row) throw new NotFoundException('Limit topilmadi');
    await this.audit(actorId, `GRID_LIMIT_${status}`, 'GridConnectionLimit', id);
    return row;
  }

  // ───────────── Moliyalashtirish ─────────────

  listFinancing() {
    return this.db.financingProduct.findMany({ orderBy: [{ status: 'asc' }, { providerName: 'asc' }] });
  }

  async saveFinancing(actorId: string, dto: FinancingProductDto, id?: string) {
    this.assertDates(dto.effectiveFrom, dto.effectiveUntil);
    if (dto.maxTermMonths < dto.minTermMonths) throw invalid('Maksimal muddat minimaldan kichik');
    const terms = dto.allowedTerms ?? [];
    if (terms.some((term) => term < dto.minTermMonths || term > dto.maxTermMonths)) throw invalid('Ruxsat etilgan muddatlar min–max oralig‘ida bo‘lishi kerak');
    const data = {
      providerName: dto.providerName.trim(), financingType: dto.financingType, annualRate: dto.annualRate, minTermMonths: dto.minTermMonths, maxTermMonths: dto.maxTermMonths, allowedTerms: terms,
      minDownPaymentPct: dto.minDownPaymentPct ?? 0, maxAmount: dto.maxAmount ?? null, oneTimeFeePct: dto.oneTimeFeePct ?? 0, monthlyFee: dto.monthlyFee ?? 0, paymentType: dto.paymentType ?? 'ANNUITY',
      customerTypes: dto.customerTypes, sourceUrl: dto.sourceUrl ?? null, effectiveFrom: date(dto.effectiveFrom)!, effectiveUntil: date(dto.effectiveUntil),
    };
    if (id) {
      const current = await this.db.financingProduct.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Mahsulot topilmadi');
      const product = await this.db.financingProduct.update({ where: { id }, data: { ...data, version: { increment: 1 }, status: 'DRAFT', verifiedAt: null } });
      await this.audit(actorId, 'FINANCING_UPDATED', 'FinancingProduct', id);
      return product;
    }
    const product = await this.db.financingProduct.create({ data });
    await this.audit(actorId, 'FINANCING_CREATED', 'FinancingProduct', product.id);
    return product;
  }

  async setFinancingStatus(actorId: string, id: string, status: PublishStatus) {
    const current = await this.db.financingProduct.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Mahsulot topilmadi');
    if (status === 'PUBLISHED' && !current.sourceUrl) throw invalid('Tasdiqlash uchun bank/provayder sahifasi havolasini kiriting');
    const product = await this.db.financingProduct.update({ where: { id }, data: { status, ...(status === 'PUBLISHED' ? { verifiedAt: new Date() } : {}) } });
    await this.audit(actorId, `FINANCING_${status}`, 'FinancingProduct', id);
    return product;
  }

  // ───────────── Hisob sozlamalari ─────────────

  listSettings() {
    return this.db.calculationSettings.findMany({ orderBy: { effectiveFrom: 'desc' } });
  }

  defaults() {
    return DEFAULT_SETTINGS;
  }

  async createSettings(actorId: string, dto: SettingsVersionDto) {
    if (await this.db.calculationSettings.findUnique({ where: { modelVersion: dto.modelVersion } })) throw conflict('SETTINGS_VERSION_EXISTS', 'Bu versiya nomi band');
    const unknown = Object.keys(dto.parametersJson).filter((key) => !(key in DEFAULT_SETTINGS));
    if (unknown.length) throw invalid(`Noma’lum parametrlar: ${unknown.join(', ')}`);
    const row = await this.db.calculationSettings.create({ data: { modelVersion: dto.modelVersion, parametersJson: { ...DEFAULT_SETTINGS, ...dto.parametersJson } as Prisma.InputJsonValue, sourceNotes: dto.sourceNotes, effectiveFrom: date(dto.effectiveFrom)!, createdById: actorId } });
    await this.audit(actorId, 'CALC_SETTINGS_CREATED', 'CalculationSettings', row.id, { modelVersion: row.modelVersion });
    return row;
  }

  /** Tasdiqlash: oldingi PUBLISHED versiyaning amal muddati yangi boshlanish sanasidan bir kun oldin tugaydi. */
  async publishSettings(actorId: string, id: string) {
    const row = await this.db.calculationSettings.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Sozlama topilmadi');
    if (row.status !== 'DRAFT') throw conflict('INVALID_STATUS_TRANSITION', 'Faqat qoralamani tasdiqlash mumkin');
    const dayBefore = new Date(row.effectiveFrom.getTime() - 86_400_000);
    const published = await this.db.$transaction(async (tx) => {
      await tx.calculationSettings.updateMany({ where: { status: 'PUBLISHED', effectiveUntil: null, effectiveFrom: { lt: row.effectiveFrom } }, data: { effectiveUntil: dayBefore } });
      return tx.calculationSettings.update({ where: { id }, data: { status: 'PUBLISHED' } });
    });
    await this.audit(actorId, 'CALC_SETTINGS_PUBLISHED', 'CalculationSettings', id, { modelVersion: row.modelVersion });
    return published;
  }

  // ───────────── Viloyat unumdorligi va solar kesh ─────────────

  listRegionalYields() {
    return this.db.regionalYield.findMany({ orderBy: { regionCode: 'asc' } });
  }

  async saveRegionalYield(actorId: string, regionCode: string, dto: RegionalYieldDto) {
    const row = await this.db.regionalYield.upsert({ where: { regionCode }, update: { monthlyYieldJson: dto.monthly, sourceNote: dto.sourceNote }, create: { regionCode, monthlyYieldJson: dto.monthly, sourceNote: dto.sourceNote } });
    await this.audit(actorId, 'REGIONAL_YIELD_UPDATED', 'RegionalYield', row.id, { regionCode, annual: dto.monthly.reduce((a, b) => a + b, 0) });
    return row;
  }

  solarDatasets() {
    return this.solar.listDatasets();
  }
}
