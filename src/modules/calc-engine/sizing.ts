import { DAYS_IN_MONTH } from './hours';

export type SystemType = 'ON_GRID' | 'HYBRID' | 'OFF_GRID';
export type LimitingFactor = 'CONSUMPTION' | 'AREA' | 'GRID_LIMIT' | 'BUDGET' | 'MIN_ONE_PANEL';

export interface PanelSpec {
  powerW: number;
  widthMm: number;
  heightMm: number;
  degradationPctPerYear?: number;
  tempCoeffPmaxPctPerC?: number;
}

/** TZ 11.1 default panel: 550 W, 2278×1134 mm, −0,35 %/°C, degradatsiya 0,5 %/yil. */
export const DEFAULT_PANEL: PanelSpec = { powerW: 550, widthMm: 1134, heightMm: 2278, degradationPctPerYear: 0.5, tempCoeffPmaxPctPerC: -0.35 };

export interface AreaForSizing {
  roofShape: 'FLAT' | 'PITCHED';
  usableAreaM2: number;
  /** Minimal o‘rab turuvchi to‘rtburchak (m) — qatorlar uchun; bo‘lmasa kvadrat deb olinadi. */
  rectWidthM?: number;
  rectLengthM?: number;
}

/** Qishki soyasiz qator qadami (TZ 11.3): αmin = 90° − |lat| − 23,44°. */
export function rowPitchM(panelLengthM: number, tiltDeg: number, latitude: number): number {
  const beta = (tiltDeg * Math.PI) / 180;
  const alphaMin = Math.max(5, 90 - Math.abs(latitude) - 23.44);
  return panelLengthM * (Math.cos(beta) + Math.sin(beta) / Math.tan((alphaMin * Math.PI) / 180));
}

/**
 * Maydon bo‘yicha maksimal panel soni (TZ 11.3). Qiya tom: floor(usable / panelArea × 0,90).
 * Tekis tom/yer: qatorlar (β default 25°) bilan; portret va landshaft — ko‘prog‘i.
 */
export function maxPanelsForArea(area: AreaForSizing, panel: PanelSpec, latitude: number, flatTiltDeg = 25): number {
  const w = panel.widthMm / 1000;
  const h = panel.heightMm / 1000;
  if (area.usableAreaM2 <= 0) return 0;
  if (area.roofShape === 'PITCHED') return Math.floor((area.usableAreaM2 / (w * h)) * 0.9);
  const side = Math.sqrt(area.usableAreaM2);
  const width = area.rectWidthM ?? side;
  const length = area.rectLengthM ?? area.usableAreaM2 / width;
  const layout = (along: number, across: number) => {
    const pitch = rowPitchM(along, flatTiltDeg, latitude);
    const rows = Math.max(0, Math.floor((length - along * Math.cos((flatTiltDeg * Math.PI) / 180)) / pitch) + 1);
    return rows * Math.floor(width / across);
  };
  const portrait = layout(h, w);
  const landscape = layout(w, h);
  // To‘rtburchak yaqinlashuvi foydali maydon chegarasidan oshmasin.
  return Math.min(Math.max(portrait, landscape), Math.floor((area.usableAreaM2 / (w * h)) * 0.9));
}

export interface SizingInput {
  systemType: SystemType;
  annualLoadKwh: number;
  monthlyLoadKwh: number[];
  /** 1 kWp yillik va oylik ishlab chiqarish (yo‘qotishlar bilan). */
  specificYieldKwhPerKwp: number;
  monthlySpecificYield: number[];
  exportCompensated: boolean;
  maxPanelsByArea: number | null;
  gridMaxKw: number | null;
  dcAcRatio: number;
  budget: number | null;
  pricePerKwp: number | null;
  panel: PanelSpec;
}

export interface SizingOption {
  key: 'ECONOMY' | 'BALANCED' | 'MAXIMUM';
  kwp: number;
  panelCount: number;
}

export interface SizingResult {
  recommendedKwp: number;
  panelCount: number;
  limitingFactor: LimitingFactor;
  limits: { needed: number; area: number | null; grid: number | null; budget: number | null };
  options: SizingOption[];
}

const panelsFor = (kwp: number, panelW: number) => Math.max(1, Math.floor((kwp * 1000) / panelW + 1e-9));

/** TZ 11.4: tavsiya = min(kerakli, maydon, ulanish limiti, byudjet); uchta variant. */
export function recommendSize(input: SizingInput): SizingResult {
  const p = input.panel.powerW;
  let needed: number;
  if (input.systemType === 'OFF_GRID') {
    // Eng yomon oy (odatda dekabr): kunlik iste’mol × 1,15 / kunlik specific yield
    let worst = 0;
    for (let m = 0; m < 12; m += 1) {
      const dailyLoad = (input.monthlyLoadKwh[m] ?? 0) / DAYS_IN_MONTH[m]!;
      const dailyYield = (input.monthlySpecificYield[m] ?? 0) / DAYS_IN_MONTH[m]!;
      if (dailyYield > 0) worst = Math.max(worst, (dailyLoad * 1.15) / dailyYield);
    }
    needed = worst;
  } else {
    const coverage = input.exportCompensated ? 1 : 0.8;
    needed = input.specificYieldKwhPerKwp > 0 ? (input.annualLoadKwh * coverage) / input.specificYieldKwhPerKwp : 0;
  }
  const area = input.maxPanelsByArea === null ? null : (input.maxPanelsByArea * p) / 1000;
  const grid = input.systemType !== 'OFF_GRID' && input.gridMaxKw !== null ? input.gridMaxKw * input.dcAcRatio : null;
  const budget = input.budget !== null && input.pricePerKwp ? input.budget / input.pricePerKwp : null;

  const candidates: Array<[LimitingFactor, number]> = [['CONSUMPTION', needed]];
  if (area !== null) candidates.push(['AREA', area]);
  if (grid !== null) candidates.push(['GRID_LIMIT', grid]);
  if (budget !== null) candidates.push(['BUDGET', budget]);
  let [limitingFactor, recommended] = candidates.reduce((best, item) => (item[1] < best[1] ? item : best));
  let panelCount = panelsFor(recommended, p);
  if (Math.floor((recommended * 1000) / p + 1e-9) < 1) limitingFactor = 'MIN_ONE_PANEL';
  if (area !== null && input.maxPanelsByArea !== null) panelCount = Math.min(panelCount, Math.max(1, input.maxPanelsByArea));
  recommended = (panelCount * p) / 1000;

  const economyPanels = panelsFor(recommended * 0.6, p);
  const maxCandidates = [area, grid].filter((value): value is number => value !== null);
  const maximumKwp = maxCandidates.length ? Math.min(...maxCandidates) : null;
  const options: SizingOption[] = [
    { key: 'ECONOMY', kwp: (economyPanels * p) / 1000, panelCount: economyPanels },
    { key: 'BALANCED', kwp: recommended, panelCount },
  ];
  if (maximumKwp !== null) {
    const maxPanels = panelsFor(maximumKwp, p);
    // Maksimal Muvozanatlidan ≤ 5 % farq qilsa ko‘rsatilmaydi.
    if (maxPanels > panelCount * 1.05) options.push({ key: 'MAXIMUM', kwp: (maxPanels * p) / 1000, panelCount: maxPanels });
  }
  return { recommendedKwp: recommended, panelCount, limitingFactor, limits: { needed, area, grid, budget }, options };
}

/** TZ 11.5: standart invertor qatori (kW). */
export const INVERTER_SIZES = [3, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50] as const;

export function chooseInverterKw(dcKwp: number, dcAcRatio: number, minKw = 0): number {
  const target = Math.max(dcKwp / dcAcRatio, minKw);
  return INVERTER_SIZES.find((size) => size >= target - 1e-9) ?? Math.ceil(target);
}

/** Akkumulyator tavsiyasi (TZ 11.5), 2,5 kWh qadamga yuqoriga yaxlitlanadi. */
export function recommendBatteryKwh(params: {
  systemType: SystemType;
  usableDod: number;
  efficiency: number;
  criticalLoadKw?: number;
  backupHours?: number;
  nightLoadKwhPerDay?: number;
  dailyLoadKwh?: number;
  autonomyDays?: number;
}): number {
  const step = (kwh: number) => (kwh > 0 ? Math.ceil(kwh / 2.5 - 1e-9) * 2.5 : 0);
  if (params.systemType === 'ON_GRID') return 0;
  if (params.systemType === 'OFF_GRID') return step(((params.dailyLoadKwh ?? 0) * (params.autonomyDays ?? 1.5)) / (params.usableDod * params.efficiency));
  if (params.criticalLoadKw && params.backupHours) return step((params.criticalLoadKw * params.backupHours) / (params.usableDod * params.efficiency));
  return step(params.nightLoadKwhPerDay ?? 0);
}
