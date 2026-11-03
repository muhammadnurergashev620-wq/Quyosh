import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DomainException } from '../../common/exceptions/business.exception';
import { CalcService } from './calc.service';
import { CalcDataService } from './calc-data.service';
import type { EstimateDto } from './dto/calc.dto';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const DRAFT_DAYS = 7;
const notFound = () => new NotFoundException('Hisob topilmadi');

type EstimateResult = Awaited<ReturnType<CalcService['estimate']>>;

/** Ro‘yxat va solishtirish uchun ixcham ko‘rsatkichlar (snapshotdan). */
function summary(result: EstimateResult) {
  return {
    status: result.status,
    systemType: result.systemType,
    systemPowerKw: result.systemPowerKw,
    panelCount: result.panelCountEstimate,
    inverterKw: result.inverterKw,
    batteryKwh: result.batteryKwh,
    annualGenerationKwh: result.generation.annual,
    annualLoadKwh: result.load.annual,
    selfSufficiency: result.energy.selfSufficiency,
    monthlySaving: result.money.savings === null ? null : Math.round(result.money.savings / 12),
    initialCost: result.money.initialCost,
    simplePaybackYears: result.money.simplePaybackYears,
    npv: result.lifetime?.npv ?? null,
    irr: result.lifetime?.irr ?? null,
    limitingFactor: result.limitingFactor,
    productionMethod: result.productionMethod,
  };
}

/**
 * Saqlangan hisoblar (TZ 9.9, U8.14, U10.3): natija har doim serverda qayta hisoblanadi (klient qiymatiga ishonilmaydi),
 * snapshot qayta yozilmaydi; «qayta hisoblash» yangi yozuv yaratadi.
 */
@Injectable()
export class CalculationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly calc: CalcService,
    private readonly data: CalcDataService,
  ) {}

  private async persist(userId: string, input: EstimateDto, result: EstimateResult, title?: string | null) {
    const meta = result.meta;
    const row = await this.db.calculation.create({
      data: {
        userId,
        siteId: meta.siteId,
        title: title?.trim() || null,
        mode: input.mode,
        systemType: result.systemType,
        inputSnapshotJson: input as unknown as Prisma.InputJsonValue,
        outputSummaryJson: result as unknown as Prisma.InputJsonValue,
        modelVersion: result.modelVersion,
        calculationSettingsId: meta.calculationSettings.id,
        tariffScheduleId: meta.tariff?.id ?? null,
        exportRuleId: meta.exportRule?.id ?? null,
        financingProductId: meta.financingProduct?.id ?? null,
        solarDatasetId: meta.solar.datasetId,
        exchangeRateId: meta.exchangeRate?.id ?? null,
        productionMethod: result.productionMethod,
      },
    });
    await this.db.auditLog.create({ data: { actorId: userId, action: 'CALCULATION_SAVED', targetType: 'Calculation', targetId: row.id, after: { mode: input.mode, systemPowerKw: result.systemPowerKw } } });
    return row;
  }

  async save(userId: string, input: EstimateDto, title?: string) {
    const result = await this.calc.estimate(input, userId);
    const row = await this.persist(userId, input, result, title);
    return { id: row.id, createdAt: row.createdAt, result };
  }

  private async own(userId: string, id: string) {
    const row = await this.db.calculation.findFirst({ where: { id, userId, archivedAt: null } });
    if (!row) throw notFound();
    return row;
  }

  async list(userId: string) {
    const rows = await this.db.calculation.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 });
    const siteIds = [...new Set(rows.map((row) => row.siteId).filter((id): id is string => !!id))];
    const sites = siteIds.length ? await this.db.customerSite.findMany({ where: { id: { in: siteIds } }, select: { id: true, title: true } }) : [];
    const current = await this.data.settings();
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      mode: row.mode,
      createdAt: row.createdAt,
      modelVersion: row.modelVersion,
      outdated: !!current.id && !!row.calculationSettingsId && current.id !== row.calculationSettingsId,
      site: sites.find((site) => site.id === row.siteId) ?? null,
      ...summary(row.outputSummaryJson as unknown as EstimateResult),
    }));
  }

  /** Eskirganmi: hisob sozlamalari yoki tarif versiyasi o‘zgargan (U10.3 badge). */
  private async outdated(row: { calculationSettingsId: string | null; tariffScheduleId: string | null; outputSummaryJson: Prisma.JsonValue }) {
    const result = row.outputSummaryJson as unknown as EstimateResult;
    const settings = await this.data.settings();
    if (settings.id && row.calculationSettingsId && settings.id !== row.calculationSettingsId) return true;
    if (!row.tariffScheduleId) return false;
    const tariff = await this.data.tariff(result.meta.regionCode, result.meta.customerType);
    return !!tariff && tariff.meta.id !== row.tariffScheduleId;
  }

  async get(userId: string, id: string) {
    const row = await this.own(userId, id);
    const shares = await this.db.calculationShare.findMany({ where: { calculationId: id, revokedAt: null }, select: { id: true, expiresAt: true, viewCount: true, createdAt: true } });
    return { id: row.id, title: row.title, mode: row.mode, createdAt: row.createdAt, siteId: row.siteId, input: row.inputSnapshotJson, result: row.outputSummaryJson, outdated: await this.outdated(row), shares };
  }

  async recalculate(userId: string, id: string) {
    const row = await this.own(userId, id);
    const input = row.inputSnapshotJson as unknown as EstimateDto;
    const result = await this.calc.estimate(input, userId);
    const created = await this.persist(userId, input, result, row.title);
    return { id: created.id, previousId: id, result };
  }

  async archive(userId: string, id: string) {
    await this.own(userId, id);
    await this.db.calculation.update({ where: { id }, data: { archivedAt: new Date() } });
    return { id, archived: true };
  }

  async compare(userId: string, ids: string[]) {
    const rows = await this.db.calculation.findMany({ where: { id: { in: ids }, userId, archivedAt: null } });
    if (rows.length !== new Set(ids).size) throw notFound();
    return ids.map((id) => {
      const row = rows.find((item) => item.id === id)!;
      return { id, title: row.title, mode: row.mode, createdAt: row.createdAt, ...summary(row.outputSummaryJson as unknown as EstimateResult) };
    });
  }

  // ───────────── Ulashish (TZ 9.9) ─────────────

  async share(userId: string, id: string, expiresDays: 7 | 30 | null | undefined) {
    await this.own(userId, id);
    const token = randomBytes(24).toString('base64url');
    const share = await this.db.calculationShare.create({ data: { calculationId: id, tokenHash: hash(token), expiresAt: expiresDays ? new Date(Date.now() + expiresDays * 86_400_000) : null } });
    await this.db.auditLog.create({ data: { actorId: userId, action: 'CALCULATION_SHARED', targetType: 'Calculation', targetId: id, after: { shareId: share.id, expiresDays: expiresDays ?? null } } });
    return { id: share.id, token, expiresAt: share.expiresAt };
  }

  async revokeShares(userId: string, id: string) {
    await this.own(userId, id);
    const result = await this.db.calculationShare.updateMany({ where: { calculationId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { revoked: result.count };
  }

  /** Ulashilgan ko‘rinish: aniq manzil, koordinata, obyekt va poligon yo‘q — faqat hudud va maydon raqamlari. */
  async shared(token: string) {
    const share = await this.db.calculationShare.findUnique({ where: { tokenHash: hash(token) } });
    if (!share || share.revokedAt || (share.expiresAt && share.expiresAt < new Date())) throw new DomainException(HttpStatus.NOT_FOUND, 'SHARE_NOT_FOUND', 'Havola topilmadi yoki muddati tugagan');
    const row = await this.db.calculation.findFirst({ where: { id: share.calculationId, archivedAt: null } });
    if (!row) throw new DomainException(HttpStatus.NOT_FOUND, 'SHARE_NOT_FOUND', 'Havola topilmadi yoki muddati tugagan');
    await this.db.calculationShare.update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } });
    const result = row.outputSummaryJson as unknown as EstimateResult;
    const { location: _location, siteId: _siteId, ...meta } = result.meta;
    const { financing: _financing, ...rest } = result;
    return { mode: row.mode, createdAt: row.createdAt, result: { ...rest, financing: null, meta: { ...meta, location: null, siteId: null } } };
  }

  // ───────────── Draft (U8.15) ─────────────

  async saveDraft(cookieToken: string | null, userId: string | null, input: Record<string, unknown>) {
    const token = cookieToken ?? randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + DRAFT_DAYS * 86_400_000);
    await this.db.calculationDraft.upsert({
      where: { cookieTokenHash: hash(token) },
      update: { inputJson: input as Prisma.InputJsonValue, expiresAt, ...(userId ? { userId } : {}) },
      create: { cookieTokenHash: hash(token), inputJson: input as Prisma.InputJsonValue, expiresAt, userId },
    });
    return { token, expiresAt };
  }

  async getDraft(cookieToken: string | null, userId: string | null) {
    const byCookie = cookieToken ? await this.db.calculationDraft.findUnique({ where: { cookieTokenHash: hash(cookieToken) } }) : null;
    const draft = byCookie && byCookie.expiresAt > new Date() ? byCookie : userId ? await this.db.calculationDraft.findFirst({ where: { userId, expiresAt: { gt: new Date() } }, orderBy: { updatedAt: 'desc' } }) : null;
    if (!draft) return null;
    // Login’dan keyin draft hisobga biriktiriladi.
    if (userId && !draft.userId) await this.db.calculationDraft.update({ where: { id: draft.id }, data: { userId } });
    return { input: draft.inputJson, updatedAt: draft.updatedAt, expiresAt: draft.expiresAt };
  }

  async deleteDraft(cookieToken: string | null, userId: string | null) {
    if (cookieToken) await this.db.calculationDraft.deleteMany({ where: { cookieTokenHash: hash(cookieToken) } });
    if (userId) await this.db.calculationDraft.deleteMany({ where: { userId } });
    return { deleted: true };
  }

  purgeExpiredDrafts() {
    return this.db.calculationDraft.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}
