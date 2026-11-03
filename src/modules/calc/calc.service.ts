import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { regionOf } from '../../common/constants/regions';
import { DomainException } from '../../common/exceptions/business.exception';
import { GeoRepository } from '../geo/geo.repository';
import { areaFigures, defaultUsableFactor, normalizePolygon } from '../geo/geojson';
import { checkCompatibility, DEFAULT_PANEL, estimate, loanSchedule, outage, recommendBatteryKwh, type ApplianceItem, type ConsumptionInput, type EngineInput, type PanelSpec } from '../calc-engine';
import { CalcDataService } from './calc-data.service';
import { SolarService } from './solar.service';
import { CompatibilityDto, ConsumptionDto, EstimateDto, FinancingEstimateDto, OutageEstimateDto } from './dto/calc.dto';

const invalid = (message: string) => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', message);
type SiteAreaRow = Awaited<ReturnType<PrismaService['siteArea']['findMany']>>[number];
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/** Hisob orkestratori (TZ 9.9, 11): kiruvchi ma’lumotni yig‘adi, versiyalangan manbalarni tanlaydi va calc-engine’ni chaqiradi. */
@Injectable()
export class CalcService {
  constructor(
    private readonly db: PrismaService,
    private readonly data: CalcDataService,
    private readonly solar: SolarService,
    private readonly geo: GeoRepository,
  ) {}

  private async expandAppliances(dto: ConsumptionDto): Promise<ApplianceItem[]> {
    let items = (dto.appliances ?? []).map((item) => ({ code: item.code, powerW: item.powerW, count: item.count, hoursPerDay: item.hoursPerDay, months: item.months ?? [], isCritical: item.isCritical ?? false }));
    if (!items.length && dto.templateCode) {
      const template = await this.db.applianceTemplate.findFirst({ where: { code: dto.templateCode, active: true } });
      if (!template) throw invalid('Shablon topilmadi');
      const types = await this.data.appliances((template.itemsJson as Array<{ applianceTypeCode: string }>).map((item) => item.applianceTypeCode));
      items = (template.itemsJson as Array<{ applianceTypeCode: string; count: number; hoursPerDay: number; isCritical?: boolean }>).flatMap((item) => {
        const type = types.get(item.applianceTypeCode);
        return type ? [{ code: type.code, powerW: type.defaultPowerW, count: item.count, hoursPerDay: item.hoursPerDay, months: type.defaultMonths, isCritical: !!item.isCritical }] : [];
      });
    }
    const types = await this.data.appliances(items.map((item) => item.code).filter((code): code is string => !!code));
    return items.map((item) => {
      const type = item.code ? types.get(item.code) : undefined;
      return {
        ...item,
        hourlyUsage: type?.hourlyUsageTemplate.map(Number),
        isMotorLoad: type?.isMotorLoad ?? false,
        surgeFactor: type ? Number(type.surgeFactor) : undefined,
      };
    });
  }

  private async consumption(dto: ConsumptionDto): Promise<{ input: ConsumptionInput; appliances: ApplianceItem[] }> {
    const appliances = dto.appliances?.length || dto.templateCode ? await this.expandAppliances(dto) : [];
    if (appliances.length) return { input: { kind: 'APPLIANCES', items: appliances, templateCode: dto.templateCode }, appliances };
    if (dto.months?.length === 12) return { input: { kind: 'TWELVE_MONTHS', months: dto.months }, appliances };
    if (dto.monthlyKwh !== undefined) {
      if (dto.monthlyKwh === 0 && !dto.noConsumptionYet) throw invalid('Oylik iste’mol 1 dan 100 000 kWh gacha bo‘lishi kerak (yangi qurilish bo‘lsa «Hozircha iste’mol yo‘q» ni belgilang)');
      return { input: { kind: 'MONTHLY_AVG', kwh: dto.monthlyKwh }, appliances };
    }
    if (dto.billAmount) return { input: { kind: 'BILL', amount: dto.billAmount }, appliances };
    if (dto.noConsumptionYet) return { input: { kind: 'MONTHLY_AVG', kwh: 0 }, appliances };
    throw invalid('Iste’molni kiriting: oylik kWh, 12 oy, summa yoki maishiy texnika');
  }

  private async location(dto: EstimateDto, userId: string | null): Promise<{ lat: number; lon: number; regionCode: string | null; siteId: string | null; areas: SiteAreaRow[] }> {
    if (dto.siteId) {
      if (!userId) throw new NotFoundException(ERRORS.SITE_NOT_FOUND);
      const site = await this.db.customerSite.findFirst({ where: { id: dto.siteId, userId, archivedAt: null }, include: { areas: true } });
      if (!site) throw new NotFoundException(ERRORS.SITE_NOT_FOUND);
      const point = (await this.geo.sitePoints([site.id])).get(site.id)!;
      const areas = dto.areaIds?.length ? site.areas.filter((area) => dto.areaIds!.includes(area.id)) : site.areas;
      return { lat: point.lat, lon: point.lon, regionCode: site.regionCode, siteId: site.id, areas };
    }
    if (dto.lat === undefined || dto.lon === undefined) throw invalid('Manzil kerak: xaritada nuqta yoki obyekt tanlang');
    return { lat: dto.lat, lon: dto.lon, regionCode: regionOf(dto.lat, dto.lon), siteId: null, areas: [] };
  }

  private async panelSpec(modelId?: string): Promise<{ spec: PanelSpec | undefined; model: { id: string; brand: string; model: string } | null }> {
    if (!modelId) return { spec: undefined, model: null };
    const model = await this.db.productModel.findFirst({ where: { id: modelId, status: 'APPROVED' } });
    if (!model?.nominalPowerW) throw invalid('Panel modeli topilmadi yoki quvvati ko‘rsatilmagan');
    return {
      spec: {
        powerW: model.nominalPowerW,
        widthMm: model.widthMm ?? DEFAULT_PANEL.widthMm,
        heightMm: model.heightMm ?? DEFAULT_PANEL.heightMm,
        degradationPctPerYear: num(model.degradationPctPerYear) ?? DEFAULT_PANEL.degradationPctPerYear,
        tempCoeffPmaxPctPerC: num(model.tempCoeffPmaxPctPerC) ?? DEFAULT_PANEL.tempCoeffPmaxPctPerC,
      },
      model: { id: model.id, brand: model.brand, model: model.model },
    };
  }

  async estimate(dto: EstimateDto, userId: string | null) {
    const warnings: string[] = [];
    const where = await this.location(dto, userId);
    if (!where.regionCode) warnings.push('OUTSIDE_UZBEKISTAN');
    const regionCode = where.regionCode ?? 'toshkent-shahri';
    const customerType: CustomerType = dto.customerType ?? 'HOUSEHOLD';
    const systemType = dto.systemType ?? 'ON_GRID';

    // Maydon: obyekt maydonlari yig‘indisi, yoki raqam / Tez hisob preseti.
    const [settings, tariff, rule, gridMaxKw, priceBook] = await Promise.all([this.data.settings(), this.data.tariff(regionCode, customerType), this.data.exportRule(regionCode, customerType), this.data.gridLimit(regionCode, customerType), this.data.priceBook()]);
    let area: EngineInput['area'] = null;
    let tilt = dto.tiltDeg;
    let azimuth = dto.azimuthDeg;
    let shading = dto.shadingLevel ?? 'NONE';
    if (where.areas.length) {
      const pitched = where.areas.filter((a) => a.roofShape === 'PITCHED');
      area = {
        roofShape: pitched.length * 2 >= where.areas.length && pitched.length ? 'PITCHED' : 'FLAT',
        usableAreaM2: where.areas.reduce((sum, a) => sum + Number(a.usableAreaM2), 0),
        projectedAreaM2: where.areas.reduce((sum, a) => sum + Number(a.projectedAreaM2), 0),
        surfaceAreaM2: where.areas.reduce((sum, a) => sum + Number(a.surfaceAreaM2), 0),
      };
      const main = where.areas.reduce((best, a) => (Number(a.usableAreaM2) > Number(best.usableAreaM2) ? a : best));
      tilt ??= main.roofShape === 'PITCHED' ? num(main.tiltDeg) ?? 30 : settings.params.flatTiltDeg;
      azimuth ??= main.azimuthDeg ?? 180;
      if (!dto.shadingLevel) shading = where.areas.some((a) => a.shadingLevel === 'HEAVY') ? 'HEAVY' : where.areas.some((a) => a.shadingLevel === 'LIGHT') ? 'LIGHT' : 'NONE';
    } else if (dto.areas?.length) {
      // Saqlanmagan poligonlar: serverda tekshirish va geodezik maydon (TZ 12: klient qiymati faqat preview).
      const measured = await Promise.all(dto.areas.map(async (draft) => {
        const roofShape = draft.roofShape ?? 'FLAT';
        const projected = await this.geo.measurePolygon(normalizePolygon(draft.polygon));
        return { draft, roofShape, ...areaFigures(projected, roofShape, draft.tiltDeg, defaultUsableFactor(roofShape)) };
      }));
      const pitched = measured.filter((m) => m.roofShape === 'PITCHED');
      area = {
        roofShape: pitched.length * 2 >= measured.length && pitched.length ? 'PITCHED' : 'FLAT',
        usableAreaM2: measured.reduce((sum, m) => sum + m.usableAreaM2, 0),
        projectedAreaM2: measured.reduce((sum, m) => sum + m.projectedAreaM2, 0),
        surfaceAreaM2: measured.reduce((sum, m) => sum + m.surfaceAreaM2, 0),
      };
      const main = measured.reduce((best, m) => (m.usableAreaM2 > best.usableAreaM2 ? m : best));
      tilt ??= main.roofShape === 'PITCHED' ? main.draft.tiltDeg ?? 30 : settings.params.flatTiltDeg;
      azimuth ??= main.draft.azimuthDeg ?? 180;
      if (!dto.shadingLevel) shading = measured.some((m) => m.draft.shadingLevel === 'HEAVY') ? 'HEAVY' : measured.some((m) => m.draft.shadingLevel === 'LIGHT') ? 'LIGHT' : 'NONE';
    } else if (dto.areaM2 || dto.areaPreset) {
      const raw = dto.areaM2 ?? settings.params.quickAreaPresets[dto.areaPreset!];
      const roofShape = dto.roofShape ?? 'FLAT';
      const factor = roofShape === 'PITCHED' ? 0.7 : 0.8;
      area = { roofShape, usableAreaM2: raw * factor, projectedAreaM2: raw, surfaceAreaM2: raw };
      if (dto.areaPreset) warnings.push('AREA_ESTIMATED_PRESET');
    }
    tilt ??= dto.roofShape === 'PITCHED' ? 30 : settings.params.flatTiltDeg;
    azimuth ??= 180;

    const [{ input: consumption, appliances }, panel, profile, solar] = await Promise.all([
      this.consumption(dto.consumption),
      this.panelSpec(dto.panelModelId),
      this.data.loadProfile(dto.loadProfileCode ?? (customerType === 'LEGAL' ? 'BUSINESS_DAY' : 'HOUSEHOLD_STD')),
      this.solar.yieldFor(where.lat, where.lon, tilt, azimuth),
    ]);
    if (solar.stale) warnings.push('SOLAR_DATA_STALE');

    let inverterKw: number | null = null;
    if (dto.inverterModelId) {
      const inverter = await this.db.productModel.findFirst({ where: { id: dto.inverterModelId, status: 'APPROVED' } });
      inverterKw = num(inverter?.inverterAcKw);
    }
    let batteryKwh = dto.batteryKwh ?? null;
    if (dto.batteryModelId && batteryKwh === null) {
      const battery = await this.db.productModel.findFirst({ where: { id: dto.batteryModelId, status: 'APPROVED' } });
      const unit = num(battery?.batteryCapacityKwh);
      if (unit) {
        const needed = recommendBatteryKwh({ systemType, usableDod: settings.params.batterySocMax - settings.params.batterySocMin, efficiency: settings.params.batteryRoundTrip, nightLoadKwhPerDay: 5 });
        batteryKwh = Math.max(1, Math.ceil(needed / unit)) * unit;
      }
    }

    let financing: EngineInput['financing'] = null;
    let financingMeta: { id: string; providerName: string; sourceUrl: string | null } | null = null;
    if (dto.financing) {
      if (dto.financing.productId) {
        const product = await this.db.financingProduct.findFirst({ where: { id: dto.financing.productId, status: 'PUBLISHED' } });
        if (!product) throw invalid('Moliyalashtirish mahsuloti topilmadi');
        if (product.allowedTerms.length && !product.allowedTerms.includes(dto.financing.termMonths)) throw invalid('Bu muddat mahsulot shartlarida yo‘q');
        financing = { annualRate: Number(product.annualRate), termMonths: dto.financing.termMonths, paymentType: product.paymentType, downPayment: dto.financing.downPayment ?? 0, oneTimeFeePct: Number(product.oneTimeFeePct), monthlyFee: Number(product.monthlyFee), allowedTerms: product.allowedTerms };
        financingMeta = { id: product.id, providerName: product.providerName, sourceUrl: product.sourceUrl };
      } else {
        financing = { annualRate: dto.financing.annualRate ?? 0, termMonths: dto.financing.termMonths, paymentType: dto.financing.paymentType ?? 'ANNUITY', downPayment: dto.financing.downPayment ?? 0 };
      }
    }

    const result = estimate(
      {
        systemType,
        latitude: where.lat,
        consumption,
        area,
        shadingLevel: shading,
        panel: panel.spec,
        kwp: dto.kwp ?? null,
        inverterKw,
        batteryKwh,
        budget: dto.budget ?? null,
        criticalItems: appliances.filter((item) => item.isCritical),
        backupHours: dto.backupHours ?? null,
        tariffGrowth: dto.tariffGrowth ?? null,
        financing,
        costs: dto.costs ?? null,
      },
      {
        settings: settings.params,
        yield1kWp: solar.series,
        productionMethod: solar.method,
        loadProfile: profile,
        tariff: tariff?.tariff ?? null,
        exportRule: rule?.rule ?? null,
        gridMaxKw,
        priceBook: { panelPerKwp: priceBook.panelPerKwp, installationPerKwp: priceBook.installationPerKwp, inverterPerKw: priceBook.inverterPerKw, batteryPerKwh: priceBook.batteryPerKwh, source: priceBook.source },
      },
    );

    const rate = await this.db.exchangeRate.findFirst({ where: { currency: 'USD' }, orderBy: { rateDate: 'desc' } });
    return {
      ...result,
      warnings: [...new Set([...warnings, ...result.warnings])],
      meta: {
        mode: dto.mode,
        customerType,
        regionCode,
        location: { lat: Math.round(where.lat * 1000) / 1000, lon: Math.round(where.lon * 1000) / 1000 },
        tiltDeg: tilt,
        azimuthDeg: azimuth,
        shadingLevel: shading,
        siteId: where.siteId,
        calculationSettings: { id: settings.id, modelVersion: settings.modelVersion },
        tariff: tariff?.meta ?? null,
        exportRule: rule?.meta ?? null,
        gridMaxKw,
        solar: { provider: solar.provider, method: solar.method, datasetId: solar.datasetId, annualKwhPerKwp: solar.annualKwhPerKwp, stale: solar.stale },
        priceBook,
        panelModel: panel.model,
        financingProduct: financingMeta,
        exchangeRate: rate ? { id: rate.id, rateToUzs: rate.rateToUzs.toString(), rateDate: rate.rateDate } : null,
        calculatedAt: new Date().toISOString(),
      },
    };
  }

  async financingEstimate(dto: FinancingEstimateDto) {
    let params = { annualRate: dto.annualRate ?? 0, paymentType: dto.paymentType ?? 'ANNUITY', oneTimeFeePct: 0, monthlyFee: 0, allowedTerms: [] as number[] };
    let product: { id: string; providerName: string; sourceUrl: string | null; verifiedAt: Date | null; minDownPaymentPct: number } | null = null;
    if (dto.productId) {
      const row = await this.db.financingProduct.findFirst({ where: { id: dto.productId, status: 'PUBLISHED' } });
      if (!row) throw invalid('Moliyalashtirish mahsuloti topilmadi');
      if (row.maxAmount !== null && dto.initialCost - (dto.downPayment ?? 0) > Number(row.maxAmount)) throw invalid('Summa mahsulot limitidan katta');
      params = { annualRate: Number(row.annualRate), paymentType: row.paymentType, oneTimeFeePct: Number(row.oneTimeFeePct), monthlyFee: Number(row.monthlyFee), allowedTerms: row.allowedTerms };
      product = { id: row.id, providerName: row.providerName, sourceUrl: row.sourceUrl, verifiedAt: row.verifiedAt, minDownPaymentPct: Number(row.minDownPaymentPct) };
      if ((dto.downPayment ?? 0) < dto.initialCost * product.minDownPaymentPct) throw invalid(`Boshlang‘ich to‘lov kamida ${Math.round(product.minDownPaymentPct * 100)} %`);
    }
    const result = loanSchedule({ initialCost: dto.initialCost, downPayment: dto.downPayment ?? 0, termMonths: dto.termMonths, monthlySaving: dto.monthlySaving, ...params });
    return { ...result, product, estimated: true };
  }

  async outageEstimate(dto: OutageEstimateDto) {
    const settings = (await this.data.settings()).params;
    const items = await this.expandAppliances({ appliances: dto.criticalItems });
    const criticalKw = items.reduce((sum, item) => sum + item.powerW * item.count, 0) / 1000;
    const peak = items.reduce((sum, item) => sum + item.powerW * item.count * (item.isMotorLoad ? (item.surgeFactor ?? settings.surgeFactor) : 1), 0) / 1000;
    const batteryKwh = dto.batteryKwh ?? recommendBatteryKwh({ systemType: dto.systemType, usableDod: settings.batterySocMax - settings.batterySocMin, efficiency: settings.batteryRoundTrip, criticalLoadKw: criticalKw, backupHours: dto.backupHours ?? settings.backupHoursDefault });
    const inverterKw = dto.inverterKw ?? [3, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50].find((size) => size >= criticalKw && size * 2 >= peak) ?? Math.ceil(Math.max(criticalKw, peak / 2));
    return { ...outage({ systemType: dto.systemType, criticalItems: items, batteryKwh, socMin: settings.batterySocMin, socMax: settings.batterySocMax, roundTripEfficiency: settings.batteryRoundTrip, inverterKw, defaultSurgeFactor: settings.surgeFactor }), batteryKwh, inverterKw };
  }

  async compatibility(dto: CompatibilityDto) {
    const ids = [dto.panelModelId, dto.inverterModelId, dto.batteryModelId].filter((id): id is string => !!id);
    const models = await this.db.productModel.findMany({ where: { id: { in: ids }, status: 'APPROVED' } });
    const find = (id?: string) => models.find((model) => model.id === id);
    const panel = find(dto.panelModelId);
    const inverter = find(dto.inverterModelId);
    if (!panel || !inverter) throw new NotFoundException(ERRORS.PRODUCT_MODEL_NOT_FOUND);
    const battery = find(dto.batteryModelId);
    const settings = (await this.data.settings()).params;
    const specs = (inverter.specsJson ?? {}) as { supportedChemistries?: string[]; batteryVoltageV?: number };
    return checkCompatibility({
      panel: { vocV: num(panel.vocV), vmpV: num(panel.vmpV), impA: num(panel.impA), tempCoeffPmaxPctPerC: num(panel.tempCoeffPmaxPctPerC), nominalPowerW: panel.nominalPowerW },
      inverter: { inverterAcKw: num(inverter.inverterAcKw), inverterMaxDcV: num(inverter.inverterMaxDcV), mpptMinV: num(inverter.mpptMinV), mpptMaxV: num(inverter.mpptMaxV), mpptMaxCurrentA: num(inverter.mpptMaxCurrentA), batteryVoltageV: num(inverter.batteryVoltageV) ?? specs.batteryVoltageV ?? null, supportedChemistries: specs.supportedChemistries ?? null },
      battery: battery ? { batteryVoltageV: num(battery.batteryVoltageV), batteryChemistry: battery.batteryChemistry } : null,
      seriesCount: dto.seriesCount,
      parallelStrings: dto.parallelStrings,
      tMin: settings.tMin,
      tMaxCell: settings.tMaxCell,
    });
  }

  /** Kalkulyator formalari uchun ma’lumotnoma: profillar, texnika, shablonlar, moliyalashtirish, presetlar. */
  async reference() {
    const [profiles, appliances, templates, financing, settings] = await Promise.all([
      this.db.loadProfile.findMany({ where: { active: true }, select: { code: true, nameI18n: true } }),
      this.db.applianceType.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { code: true, nameI18n: true, defaultPowerW: true, defaultHoursPerDay: true, defaultMonths: true, isMotorLoad: true } }),
      this.db.applianceTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { code: true, nameI18n: true, itemsJson: true, customerType: true } }),
      this.db.financingProduct.findMany({ where: { status: 'PUBLISHED', effectiveFrom: { lte: new Date() }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: new Date() } }] }, select: { id: true, providerName: true, financingType: true, annualRate: true, minTermMonths: true, maxTermMonths: true, allowedTerms: true, minDownPaymentPct: true, oneTimeFeePct: true, monthlyFee: true, paymentType: true, sourceUrl: true, verifiedAt: true } }),
      this.data.settings(),
    ]);
    return { profiles, appliances, templates, financing, quickAreaPresets: settings.params.quickAreaPresets, defaultTariffGrowth: settings.params.tariffGrowth, modelVersion: settings.modelVersion };
  }
}
