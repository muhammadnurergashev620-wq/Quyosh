import { Injectable } from '@nestjs/common';
import { CustomerType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { tashkentDate } from '../../common/utils/tashkent-date';
import { DEFAULT_SETTINGS, type CalcSettings, type ExportRule, type LoadProfile, type Tariff } from '../calc-engine';

const today = () => new Date(tashkentDate());

/** Hisob sanasida amaldagi PUBLISHED yozuv (TZ 11.1: versioned ID). */
const effectiveNow = (): { status: 'PUBLISHED'; effectiveFrom: { lte: Date }; OR: Prisma.TariffScheduleWhereInput[] } => ({
  status: 'PUBLISHED',
  effectiveFrom: { lte: today() },
  OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: today() } }],
});

export interface PriceBook {
  panelPerKwp?: number;
  installationPerKwp?: number;
  inverterPerKw?: number;
  batteryPerKwh?: number;
  source: 'CATALOG_MEDIAN' | 'SETTINGS_DEFAULT';
  sampleSizes: Record<string, number>;
}

@Injectable()
export class CalcDataService {
  constructor(private readonly db: PrismaService) {}

  async settings(): Promise<{ id: string | null; modelVersion: string; params: CalcSettings }> {
    const row = await this.db.calculationSettings.findFirst({ where: effectiveNow() as Prisma.CalculationSettingsWhereInput, orderBy: { effectiveFrom: 'desc' } });
    if (!row) return { id: null, modelVersion: 'default', params: DEFAULT_SETTINGS };
    // Yangi parametrlar qo‘shilganda eski versiyada bo‘lmasa — standart qiymat (chuqur birlashtirish birinchi daraja).
    const stored = row.parametersJson as Partial<CalcSettings>;
    return { id: row.id, modelVersion: row.modelVersion, params: { ...DEFAULT_SETTINGS, ...stored, shading: { ...DEFAULT_SETTINGS.shading, ...stored.shading }, defaultCosts: { ...DEFAULT_SETTINGS.defaultCosts, ...stored.defaultCosts }, scenarios: { ...DEFAULT_SETTINGS.scenarios, ...stored.scenarios }, quickAreaPresets: { ...DEFAULT_SETTINGS.quickAreaPresets, ...stored.quickAreaPresets } } };
  }

  async tariff(regionCode: string, customerType: CustomerType) {
    const row = await this.db.tariffSchedule.findFirst({ where: { regionCode, customerType, ...effectiveNow() }, orderBy: { effectiveFrom: 'desc' }, include: { tiers: true, touPeriods: true } });
    if (!row) return null;
    const tariff: Tariff = {
      id: row.id,
      version: row.version,
      fixedChargeMonthly: Number(row.fixedChargeMonthly ?? 0),
      touEnabled: row.touEnabled,
      tiers: row.tiers.map((tier) => ({ seasonMonths: tier.seasonMonths, touPeriod: tier.touPeriod, minKwh: Number(tier.minKwh), maxKwh: tier.maxKwh === null ? null : Number(tier.maxKwh), ratePerKwh: Number(tier.ratePerKwh) })),
      touPeriods: row.touPeriods.filter((p) => p.touPeriod !== 'ALL').map((p) => ({ touPeriod: p.touPeriod as 'DAY' | 'NIGHT', startHour: p.startHour, endHour: p.endHour })),
    };
    return { tariff, meta: { id: row.id, version: row.version, title: row.title, sourceUrl: row.sourceUrl, verifiedAt: row.verifiedAt, effectiveFrom: row.effectiveFrom } };
  }

  async exportRule(regionCode: string, customerType: CustomerType) {
    const row = await this.db.exportRule.findFirst({ where: { regionCode, customerType, ...(effectiveNow() as Prisma.ExportRuleWhereInput) }, orderBy: { effectiveFrom: 'desc' } });
    if (!row) return null;
    const rule: ExportRule = { id: row.id, version: row.version, compensationType: row.compensationType, ratePerKwh: row.ratePerKwh === null ? null : Number(row.ratePerKwh), settlementPeriod: row.settlementPeriod, maxSystemKw: row.maxSystemKw === null ? null : Number(row.maxSystemKw), verified: !!row.verifiedAt };
    return { rule, meta: { id: row.id, version: row.version, sourceUrl: row.sourceUrl } };
  }

  async gridLimit(regionCode: string, customerType: CustomerType) {
    const row = await this.db.gridConnectionLimit.findFirst({ where: { regionCode, customerType, status: 'PUBLISHED', effectiveFrom: { lte: today() } }, orderBy: { effectiveFrom: 'desc' } });
    return row ? Number(row.maxKw) : null;
  }

  async loadProfile(code: string): Promise<LoadProfile> {
    const row = (await this.db.loadProfile.findFirst({ where: { code, active: true } })) ?? (await this.db.loadProfile.findFirst({ where: { code: 'HOUSEHOLD_STD' } }));
    if (!row) return { code: 'FLAT', monthlyFactors: new Array(12).fill(1), hourlyFactors: Array.from({ length: 12 }, () => new Array(24).fill(1 / 24)) };
    return { code: row.code, monthlyFactors: row.monthlyFactors.map(Number), hourlyFactors: row.hourlyFactorsJson as number[][] };
  }

  async appliances(codes: string[]) {
    if (!codes.length) return new Map<string, Awaited<ReturnType<typeof this.db.applianceType.findMany>>[number]>();
    const rows = await this.db.applianceType.findMany({ where: { code: { in: codes } } });
    return new Map(rows.map((row) => [row.code, row]));
  }

  /**
   * TZ 11.10: quote bo‘lmasa — katalogdagi faol takliflar medianasi (oxirgi 90 kun), montaj — kW uchun mediana; «taxminiy».
   * Kamida 3 ta namuna bo‘lmasa sozlamalardagi standart qiymat.
   */
  async priceBook(): Promise<PriceBook> {
    const rows = await this.db.$queryRaw<Array<{ kind: string; median: number | null; n: bigint }>>`
      WITH rate AS (SELECT rate_to_uzs FROM exchange_rates WHERE currency = 'USD' ORDER BY rate_date DESC LIMIT 1),
      offers AS (
        SELECT c.slug, pm.nominal_power_w, pm.inverter_ac_kw, pm.battery_capacity_kwh,
               CASE WHEN o.currency = 'USD' THEN o.price * (SELECT rate_to_uzs FROM rate) ELSE o.price END AS price_uzs
        FROM product_offers o
        JOIN shop_products sp ON sp.id = o.shop_product_id AND sp.status = 'ACTIVE'
        JOIN shops s ON s.id = sp.shop_id AND s.status = 'ACTIVE' AND s.archived_at IS NULL
        JOIN product_models pm ON pm.id = sp.product_model_id AND pm.status = 'APPROVED'
        JOIN categories c ON c.id = pm.category_id
        WHERE o."updatedAt" >= now() - interval '90 days'
      )
      SELECT 'panel' AS kind, percentile_cont(0.5) WITHIN GROUP (ORDER BY price_uzs * 1000 / nominal_power_w) AS median, COUNT(*) AS n
        FROM offers WHERE slug = 'quyosh-panellari' AND nominal_power_w > 0 AND price_uzs IS NOT NULL
      UNION ALL
      SELECT 'inverter', percentile_cont(0.5) WITHIN GROUP (ORDER BY price_uzs / inverter_ac_kw), COUNT(*)
        FROM offers WHERE slug = 'invertorlar' AND inverter_ac_kw > 0 AND price_uzs IS NOT NULL
      UNION ALL
      SELECT 'battery', percentile_cont(0.5) WITHIN GROUP (ORDER BY price_uzs / battery_capacity_kwh), COUNT(*)
        FROM offers WHERE slug = 'akkumulyatorlar' AND battery_capacity_kwh > 0 AND price_uzs IS NOT NULL
      UNION ALL
      SELECT 'installation', percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN sv.currency = 'USD' THEN sv.price * (SELECT rate_to_uzs FROM rate) ELSE sv.price END), COUNT(*)
        FROM services sv JOIN shops s ON s.id = sv.shop_id AND s.status = 'ACTIVE'
        WHERE sv.active AND sv.service_type = 'INSTALLATION' AND sv.pricing_model = 'PER_KW' AND sv.price IS NOT NULL`;
    const book: PriceBook = { source: 'SETTINGS_DEFAULT', sampleSizes: {} };
    for (const row of rows) {
      const n = Number(row.n);
      book.sampleSizes[row.kind] = n;
      if (n < 3 || row.median === null) continue;
      book.source = 'CATALOG_MEDIAN';
      const value = Math.round(Number(row.median));
      if (row.kind === 'panel') book.panelPerKwp = value;
      if (row.kind === 'inverter') book.inverterPerKw = value;
      if (row.kind === 'battery') book.batteryPerKwh = value;
      if (row.kind === 'installation') book.installationPerKwp = value;
    }
    return book;
  }
}
