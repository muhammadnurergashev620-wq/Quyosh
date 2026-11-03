/** Backend `calc-engine` natijasi (TZ 11.14) va hisob kirishi (EstimateDto) — klient ko‘rinishi. */
export type SystemType = 'ON_GRID' | 'HYBRID' | 'OFF_GRID';
export type LimitingFactor = 'CONSUMPTION' | 'AREA' | 'GRID_LIMIT' | 'BUDGET' | 'MIN_ONE_PANEL';
export type AreaPreset = 'SMALL' | 'MEDIUM' | 'LARGE';
export type Shading = 'NONE' | 'LIGHT' | 'HEAVY';

export interface ApplianceRow { code?: string; powerW: number; count: number; hoursPerDay: number; months?: number[]; isCritical?: boolean }

export interface EstimateInput {
  mode: 'QUICK' | 'DETAILED';
  systemType?: SystemType;
  customerType?: 'HOUSEHOLD' | 'LEGAL';
  siteId?: string;
  areaIds?: string[];
  areas?: Array<{ polygon: { type: 'Polygon'; coordinates: number[][][] }; roofShape?: 'FLAT' | 'PITCHED'; tiltDeg?: number; azimuthDeg?: number; shadingLevel?: Shading }>;
  costs?: { equipmentCost?: number; installationCost?: number; deliveryCost?: number; otherCost?: number };
  lat?: number;
  lon?: number;
  areaPreset?: AreaPreset;
  areaM2?: number;
  roofShape?: 'FLAT' | 'PITCHED';
  tiltDeg?: number;
  azimuthDeg?: number;
  shadingLevel?: Shading;
  consumption: { monthlyKwh?: number; months?: number[]; billAmount?: number; appliances?: ApplianceRow[]; templateCode?: string; noConsumptionYet?: boolean };
  loadProfileCode?: string;
  panelModelId?: string;
  inverterModelId?: string;
  batteryModelId?: string;
  kwp?: number;
  batteryKwh?: number;
  budget?: number;
  backupHours?: number;
  tariffGrowth?: number;
  financing?: { productId?: string; annualRate?: number; termMonths: number; paymentType?: 'ANNUITY' | 'DIFFERENTIATED'; downPayment?: number };
}

export interface LoanRow { month: number; payment: number; principal: number; interest: number; balance: number; fee: number; saving: number; net: number }
export interface LoanResult { financedAmount: number; firstPayment: number; lastPayment: number; totalInterest: number; totalFees: number; totalPaid: number; overpayment: number; breakEvenMonth: number | null; shortestSelfFundingTerm: number | null; schedule: LoanRow[] }
export interface OutageResult { applicable: boolean; criticalLoadKw: number; peakStartKw: number; usableBatteryKwh: number; backupHoursNight: number | null; backupHoursDay: number | null; dayUnlimited: boolean; inverterOk: boolean; inverterSurgeKw: number; months: Array<{ month: number; backupHoursNight: number | null; dayUnlimited: boolean; backupHoursDay: number | null }>; warnings: string[]; batteryKwh?: number; inverterKw?: number }
export interface Insight { type: 'BEST_SAVING_MONTH' | 'LOWEST_GENERATION_MONTH' | 'PEAK_IMPORT_MONTH' | 'BATTERY_CRITICAL_MONTH' | 'SUMMER_SURPLUS'; month: number | null; value: number }
export interface ScenarioSummary { annualGenerationKwh: number; saving: number | null; exportIncome: number | null; simplePaybackYears: number | null; npv: number | null; irr: number | null; assumptions: { yieldDelta: number; lossDelta: number; tariffGrowth: number } }
export interface LifetimeYear { year: number; productionKwh: number; saving: number; exportIncome: number; opex: number; replacement: number; cashFlow: number; cumulative: number; discountedCumulative: number }

export interface EstimateResult {
  modelVersion: string;
  status: 'OK' | 'TARIFF_NOT_FOUND';
  systemType: SystemType;
  systemPowerKw: number;
  panelCountEstimate: number;
  panel: { powerW: number; widthMm: number; heightMm: number };
  inverterKw: number;
  batteryKwh: number;
  projectedAreaM2: number | null;
  surfaceAreaM2: number | null;
  usableAreaM2: number | null;
  limitingFactor: LimitingFactor;
  sizingOptions: Array<{ key: 'ECONOMY' | 'BALANCED' | 'MAXIMUM'; kwp: number; panelCount: number }>;
  generation: { daily: number[]; weekly: number[]; monthly: number[]; annual: number; specificYield: number };
  clippingLossKwh: number;
  curtailmentKwh: number;
  load: { monthly: number[]; annual: number; provenance: string };
  energy: { selfConsumedKwh: number; batteryThroughputKwh: number; gridImportKwh: number; gridExportKwh: number; monthlyImport: number[]; monthlyExport: number[]; selfSufficiency: number };
  money: {
    billWithoutSolar: number | null; billWithSolar: number | null; savings: number | null; monthlySavings: number[] | null; monthlyBillWithout: number[] | null; monthlyBillWith: number[] | null;
    exportIncome: { status: 'VERIFIED' | 'UNVERIFIED' | 'NOT_APPLICABLE'; value: number | null; exportKwh: number };
    annualOpex: number; initialCost: number; costBreakdown: { equipment: number; installation: number; delivery: number; other: number }; costProvenance: string;
    simplePaybackYears: number | null; paybackUnavailableReason: 'NON_POSITIVE_BENEFIT' | 'TARIFF_NOT_FOUND' | null;
  };
  lifetime: { years: LifetimeYear[]; npv: number; irr: number | null; lcoe: number | null; discountedPayback: number | null; co2Kg: number } | null;
  financing: LoanResult | null;
  outage: OutageResult | null;
  typicalDays: Array<{ month: number; generation: number[]; load: number[] }>;
  insights: Insight[];
  scenarios: { low: ScenarioSummary; base: ScenarioSummary; high: ScenarioSummary };
  productionMethod: 'A_PV_YIELD' | 'B_IRRADIANCE' | 'DEFAULT';
  assumptions: string[];
  warnings: string[];
  meta: {
    mode: 'QUICK' | 'DETAILED'; customerType: string; regionCode: string; location: { lat: number; lon: number } | null; tiltDeg: number; azimuthDeg: number; shadingLevel: Shading; siteId: string | null;
    calculationSettings: { id: string | null; modelVersion: string };
    tariff: { id: string; version: number; title: string; sourceUrl: string | null; verifiedAt: string | null; effectiveFrom: string } | null;
    exportRule: { id: string; version: number; sourceUrl: string | null } | null;
    gridMaxKw: number | null;
    solar: { provider: string; method: string; datasetId: string | null; annualKwhPerKwp: number; stale: boolean };
    priceBook: { source: string; sampleSizes: Record<string, number> };
    financingProduct: { id: string; providerName: string; sourceUrl: string | null } | null;
    exchangeRate: { id: string; rateToUzs: string; rateDate: string } | null;
    calculatedAt: string;
  };
}

export interface CalcReference {
  profiles: Array<{ code: string; nameI18n: Record<string, string> }>;
  appliances: Array<{ code: string; nameI18n: Record<string, string>; defaultPowerW: number; defaultHoursPerDay: string; defaultMonths: number[]; isMotorLoad: boolean }>;
  templates: Array<{ code: string; nameI18n: Record<string, string>; itemsJson: Array<{ applianceTypeCode: string; count: number; hoursPerDay: number; isCritical?: boolean }>; customerType: string }>;
  financing: Array<{ id: string; providerName: string; financingType: string; annualRate: string; minTermMonths: number; maxTermMonths: number; allowedTerms: number[]; minDownPaymentPct: string; oneTimeFeePct: string; monthlyFee: string; paymentType: 'ANNUITY' | 'DIFFERENTIATED'; sourceUrl: string | null; verifiedAt: string | null }>;
  quickAreaPresets: Record<AreaPreset, number>;
  defaultTariffGrowth: number;
  modelVersion: string;
}

export interface SavedCalculationRow {
  id: string; title: string | null; mode: 'QUICK' | 'DETAILED'; createdAt: string; modelVersion: string; outdated: boolean; site: { id: string; title: string } | null;
  status: string; systemType: SystemType; systemPowerKw: number; panelCount: number; monthlySaving: number | null; initialCost: number; simplePaybackYears: number | null; annualGenerationKwh: number; selfSufficiency: number; batteryKwh: number; npv: number | null; limitingFactor: LimitingFactor;
}
