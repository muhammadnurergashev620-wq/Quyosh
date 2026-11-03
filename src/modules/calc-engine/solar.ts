import { DAY_OF_YEAR, HOUR_OF_DAY, HOURS, MONTH_OF_HOUR, TASHKENT_UTC_OFFSET } from './hours';

const RAD = Math.PI / 180;

/** Quyosh holati (NOAA soddalashtirilgan): zenit va azimut (0° = shimol, soat strelkasi bo‘yicha), radianda. */
export function solarPosition(lat: number, lon: number, dayOfYear: number, localHourMid: number) {
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear + (localHourMid - 12) / 24);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const timeOffset = eqTime + 4 * lon - 60 * TASHKENT_UTC_OFFSET;
  const trueSolarMinutes = localHourMid * 60 + timeOffset;
  const hourAngle = (trueSolarMinutes / 4 - 180) * RAD;
  const phi = lat * RAD;
  const cosZenith = Math.min(1, Math.max(-1, Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle)));
  const zenith = Math.acos(cosZenith);
  const sinZ = Math.sin(zenith) || 1e-9;
  let azimuth = Math.acos(Math.min(1, Math.max(-1, (Math.sin(decl) - Math.sin(phi) * cosZenith) / (Math.cos(phi) * sinZ))));
  if (hourAngle > 0) azimuth = 2 * Math.PI - azimuth;
  return { zenith, azimuth, declination: decl, extraterrestrial: 1367 * (1.00011 + 0.034221 * Math.cos(gamma) + 0.00128 * Math.sin(gamma) + 0.000719 * Math.cos(2 * gamma) + 0.000077 * Math.sin(2 * gamma)) };
}

/** Erbs dekompozitsiyasi: GHI → diffuz ulush (DNI/DHI bo‘lmasa). */
export function erbs(ghi: number, cosZenith: number, extra: number) {
  if (ghi <= 0 || cosZenith <= 0.01) return { dni: 0, dhi: Math.max(ghi, 0) };
  const kt = Math.min(1, ghi / (extra * cosZenith));
  const fd = kt <= 0.22 ? 1 - 0.09 * kt : kt <= 0.8 ? 0.9511 - 0.1604 * kt + 4.388 * kt ** 2 - 16.638 * kt ** 3 + 12.336 * kt ** 4 : 0.165;
  const dhi = ghi * fd;
  return { dni: Math.max(0, (ghi - dhi) / cosZenith), dhi };
}

export interface IrradianceHour {
  ghi: number;
  dni?: number | null;
  dhi?: number | null;
  /** Havo harorati, °C */
  tAir: number;
}

export interface PvModelOptions {
  lat: number;
  lon: number;
  tiltDeg: number;
  /** 0° = shimol, 180° = janub (TZ 10.1). */
  azimuthDeg: number;
  tempCoeffPmaxPerC?: number;
  noct?: number;
  albedo?: number;
  inverterEfficiency?: number;
}

/**
 * B usuli (TZ 11.6): NASA POWER soatlik irradiance → 1 kWp AC qatori (kWh). Hay–Davies transpozitsiyasi, NOCT harorat modeli,
 * invertor samaradorligi 0,97. Kirish qatori mahalliy vaqtda (utcToLocal dan keyin).
 */
export function pvSeriesFromIrradiance(hours: IrradianceHour[], options: PvModelOptions): Float64Array {
  if (hours.length !== HOURS) throw new Error('Irradiance qatori 8760 soat bo‘lishi kerak');
  const out = new Float64Array(HOURS);
  const beta = options.tiltDeg * RAD;
  const gammaSurface = options.azimuthDeg * RAD;
  const gammaT = options.tempCoeffPmaxPerC ?? -0.0035;
  const noct = options.noct ?? 45;
  const albedo = options.albedo ?? 0.2;
  const etaInv = options.inverterEfficiency ?? 0.97;
  for (let t = 0; t < HOURS; t += 1) {
    const hour = hours[t]!;
    if (hour.ghi <= 0) continue;
    const sun = solarPosition(options.lat, options.lon, DAY_OF_YEAR[t]!, HOUR_OF_DAY[t]! + 0.5);
    const cosZ = Math.cos(sun.zenith);
    if (cosZ <= 0.01) continue;
    const split = hour.dni != null && hour.dhi != null && hour.dni >= 0 && hour.dhi >= 0 ? { dni: hour.dni, dhi: hour.dhi } : erbs(hour.ghi, cosZ, sun.extraterrestrial);
    const cosAoi = Math.cos(sun.zenith) * Math.cos(beta) + Math.sin(sun.zenith) * Math.sin(beta) * Math.cos(sun.azimuth - gammaSurface);
    const rb = Math.max(0, cosAoi) / Math.max(cosZ, 0.087);
    const ai = Math.min(1, split.dni / sun.extraterrestrial);
    const beam = split.dni * Math.max(0, cosAoi);
    const diffuse = split.dhi * (ai * rb + (1 - ai) * ((1 + Math.cos(beta)) / 2));
    const ground = hour.ghi * albedo * ((1 - Math.cos(beta)) / 2);
    const poa = Math.max(0, beam + diffuse + ground);
    const tCell = hour.tAir + ((noct - 20) / 800) * poa;
    out[t] = Math.max(0, (poa / 1000) * (1 + gammaT * (tCell - 25)) * etaInv);
  }
  return out;
}

/** DEFAULT usuli: viloyat oylik specific yield (kWh/kWp/oy) → soatlik qator (oy ichida cos(zenit) ulushi bilan). */
export function seriesFromMonthlyYield(monthlyKwhPerKwp: number[], lat: number, lon: number): Float64Array {
  const weights = new Float64Array(HOURS);
  const monthTotals = new Array<number>(12).fill(0);
  for (let t = 0; t < HOURS; t += 1) {
    const sun = solarPosition(lat, lon, DAY_OF_YEAR[t]!, HOUR_OF_DAY[t]! + 0.5);
    weights[t] = Math.max(0, Math.cos(sun.zenith));
    monthTotals[MONTH_OF_HOUR[t]!] += weights[t]!;
  }
  const out = new Float64Array(HOURS);
  for (let t = 0; t < HOURS; t += 1) {
    const m = MONTH_OF_HOUR[t]!;
    out[t] = monthTotals[m]! > 0 ? (weights[t]! / monthTotals[m]!) * (monthlyKwhPerKwp[m] ?? 0) : 0;
  }
  return out;
}
