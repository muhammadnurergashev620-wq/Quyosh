import { Injectable, Logger } from '@nestjs/common';
import { gunzipSync, gzipSync } from 'node:zlib';
import { SolarDataset, SolarProvider } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { ProviderStatsService } from '../ops/provider-stats.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { regionOf } from '../../common/constants/regions';
import { HOURS, pvSeriesFromIrradiance, seriesFromMonthlyYield, sumByMonth, total, utcToLocal, type IrradianceHour, type ProductionMethod } from '../calc-engine';

/** TZ 11.6: kesh 180 kun; STALE ishlatiladi va fon jobi yangilaydi. */
const CACHE_DAYS = 180;
const PVGIS_URL = () => (process.env.PVGIS_BASE_URL || 'https://re.jrc.ec.europa.eu/api/v5_3').replace(/\/$/, '');
const NASA_URL = () => (process.env.NASA_POWER_BASE_URL || 'https://power.larc.nasa.gov/api/temporal/hourly/point').replace(/\/$/, '');
/** Kabisa bo‘lmagan to‘liq yil (PVGIS-SARAH3 va NASA POWER ikkalasida bor). */
const REFERENCE_YEAR = 2019;

export interface SolarYield {
  series: Float64Array;
  method: ProductionMethod;
  provider: SolarProvider;
  datasetId: string | null;
  annualKwhPerKwp: number;
  monthlyKwhPerKwp: number[];
  stale: boolean;
}

export const cellKeyOf = (lat: number, lon: number) => `${(Math.round(lat / 0.05) * 0.05).toFixed(2)}_${(Math.round(lon / 0.05) * 0.05).toFixed(2)}`;
export const bucket5 = (value: number) => (Math.round(value / 5) * 5) % 360;

const encode = (series: Float64Array) => gzipSync(Buffer.from(new Float32Array(series).buffer));
const decode = (buffer: Buffer) => {
  const raw = gunzipSync(buffer);
  return Float64Array.from(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4));
};

/**
 * Solar adapter (TZ 11.6): A — PVGIS seriescalc (1 kWp, loss=0); B — NASA POWER irradiance + TS PV modeli; DEFAULT — viloyat o‘rtachasi.
 * Yo‘qotishlar bu yerda QO‘LLANMAYDI (faqat calc-engine’da, bir marta).
 */
@Injectable()
export class SolarService {
  private readonly logger = new Logger(SolarService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly stats: ProviderStatsService,
  ) {}

  async yieldFor(lat: number, lon: number, tiltDeg: number, azimuthDeg: number, options: { allowFetch?: boolean } = {}): Promise<SolarYield> {
    const cellKey = cellKeyOf(lat, lon);
    const tilt = Math.min(90, Math.max(0, Math.round(tiltDeg / 5) * 5));
    const azimuth = bucket5(azimuthDeg);
    for (const provider of ['PVGIS', 'NASA_POWER'] as const) {
      const cached = await this.cached(provider, cellKey, tilt, azimuth);
      if (cached && cached.status !== 'FAILED' && cached.objectKey) {
        try {
          const series = decode(await this.storage.getObject(cached.objectKey));
          const stale = cached.expiresAt < new Date();
          return { series, method: provider === 'PVGIS' ? 'A_PV_YIELD' : 'B_IRRADIANCE', provider, datasetId: cached.id, annualKwhPerKwp: Number(cached.annualYieldKwhPerKwp), monthlyKwhPerKwp: cached.monthlyYieldJson as number[], stale };
        } catch (error) {
          this.logger.warn(`Solar kesh o‘qilmadi (${cached.id}): ${(error as Error).message}`);
        }
      }
    }
    if (options.allowFetch !== false && process.env.SOLAR_FETCH !== 'false') {
      const fetched = await this.fetchWithLock(lat, lon, cellKey, tilt, azimuth);
      if (fetched) return fetched;
    }
    return this.regionalDefault(lat, lon);
  }

  private cached(provider: SolarProvider, cellKey: string, tilt: number, azimuth: number) {
    return this.db.solarDataset.findUnique({ where: { provider_cellKey_tiltBucket_azimuthBucket_database: { provider, cellKey, tiltBucket: tilt, azimuthBucket: azimuth, database: '' } } });
  }

  /** Bir xil cellKey uchun parallel so‘rovlar birlashtiriladi (Redis lock) — provider’ga bitta so‘rov (TZ 11.15). */
  private async fetchWithLock(lat: number, lon: number, cellKey: string, tilt: number, azimuth: number): Promise<SolarYield | null> {
    const lockKey = `solar:lock:${cellKey}:${tilt}:${azimuth}`;
    const owner = await this.redis.setIfAbsent(lockKey, '1', 30).catch(() => true);
    if (!owner) {
      for (let i = 0; i < 40; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const done = (await this.cached('PVGIS', cellKey, tilt, azimuth)) ?? (await this.cached('NASA_POWER', cellKey, tilt, azimuth));
        if (done?.objectKey) return this.yieldFor(lat, lon, tilt, azimuth, { allowFetch: false });
      }
      return null;
    }
    try {
      const centerLat = Number(cellKey.split('_')[0]);
      const centerLon = Number(cellKey.split('_')[1]);
      // TZ 11.15: yangi yuklash bilan ≤ 8 s. Ikkala provayder parallel; PVGIS (A) ustun, NASA (B) — zaxira.
      const pvgis = this.fetchPvgis(centerLat, centerLon, tilt, azimuth);
      const nasa = this.fetchNasa(centerLat, centerLon, tilt, azimuth);
      const [a, b] = await Promise.allSettled([pvgis, nasa]);
      if (a.status === 'fulfilled') {
        if (b.status === 'fulfilled') void this.store('NASA_POWER', cellKey, tilt, azimuth, b.value).catch(() => undefined);
        return await this.store('PVGIS', cellKey, tilt, azimuth, a.value);
      }
      this.logger.warn(`PVGIS mavjud emas: ${(a.reason as Error).message}`);
      if (b.status === 'fulfilled') {
        // PVGIS keyinroq (fonda, uzunroq kutish bilan) keshga yoziladi — keyingi hisoblar A usulida bo‘ladi.
        void this.fetchPvgis(centerLat, centerLon, tilt, azimuth, 30_000).then((series) => this.store('PVGIS', cellKey, tilt, azimuth, series)).catch(() => undefined);
        return await this.store('NASA_POWER', cellKey, tilt, azimuth, b.value);
      }
      this.logger.warn(`NASA POWER mavjud emas: ${(b.reason as Error).message}`);
      return null;
    } finally {
      await this.redis.del(lockKey).catch(() => undefined);
    }
  }

  private async store(provider: 'PVGIS' | 'NASA_POWER', cellKey: string, tilt: number, azimuth: number, series: Float64Array): Promise<SolarYield> {
    const objectKey = `solar/${provider.toLowerCase()}/${cellKey}/${tilt}-${azimuth}.f32.gz`;
    await this.storage.putObject(objectKey, encode(series), 'application/gzip');
    const monthly = sumByMonth(series).map((v) => Math.round(v * 100) / 100);
    const annual = Math.round(total(series) * 100) / 100;
    const expiresAt = new Date(Date.now() + CACHE_DAYS * 86_400_000);
    const dataset = await this.db.solarDataset.upsert({
      where: { provider_cellKey_tiltBucket_azimuthBucket_database: { provider, cellKey, tiltBucket: tilt, azimuthBucket: azimuth, database: '' } },
      update: { objectKey, annualYieldKwhPerKwp: annual, monthlyYieldJson: monthly, fetchedAt: new Date(), expiresAt, status: 'FRESH', datasetVersion: String(REFERENCE_YEAR) },
      create: { provider, cellKey, tiltBucket: tilt, azimuthBucket: azimuth, objectKey, annualYieldKwhPerKwp: annual, monthlyYieldJson: monthly, expiresAt, status: 'FRESH', datasetVersion: String(REFERENCE_YEAR) },
    });
    return { series, method: provider === 'PVGIS' ? 'A_PV_YIELD' : 'B_IRRADIANCE', provider, datasetId: dataset.id, annualKwhPerKwp: annual, monthlyKwhPerKwp: monthly, stale: false };
  }

  /** PVGIS seriescalc: 1 kWp, loss=0, aspect = azimut − 180 (TZ 10.1), UTC soatlar. */
  async fetchPvgis(lat: number, lon: number, tilt: number, azimuth: number, timeoutMs = 7500): Promise<Float64Array> {
    const url = new URL(`${PVGIS_URL()}/seriescalc`);
    const params = { lat: String(lat), lon: String(lon), peakpower: '1', loss: '0', angle: String(tilt), aspect: String(azimuth - 180), pvcalculation: '1', startyear: String(REFERENCE_YEAR), endyear: String(REFERENCE_YEAR), outputformat: 'json' };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) }).catch((e: Error) => { this.stats.record('PVGIS', false); throw e; });
    this.stats.record('PVGIS', response.ok);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { outputs?: { hourly?: Array<{ P: number; time: string }> } };
    const rows = body.outputs?.hourly ?? [];
    const utc = rows.filter((row) => !row.time.startsWith(`${REFERENCE_YEAR}0229`)).map((row) => Math.max(0, row.P) / 1000);
    if (utc.length !== HOURS) throw new Error(`PVGIS ${utc.length} soat qaytardi`);
    return utcToLocal(utc);
  }

  /** NASA POWER soatlik (UTC): GHI, DNI, DHI, T2M → B usuli. */
  async fetchNasa(lat: number, lon: number, tilt: number, azimuth: number): Promise<Float64Array> {
    const url = new URL(NASA_URL());
    const params = { parameters: 'ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,T2M', community: 'RE', latitude: String(lat), longitude: String(lon), start: `${REFERENCE_YEAR}0101`, end: `${REFERENCE_YEAR}1231`, format: 'JSON', 'time-standard': 'UTC' };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url, { signal: AbortSignal.timeout(7500) }).catch((e: Error) => { this.stats.record('NASA_POWER', false); throw e; });
    this.stats.record('NASA_POWER', response.ok);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { properties?: { parameter?: Record<string, Record<string, number>> } };
    const p = body.properties?.parameter;
    if (!p) throw new Error('NASA POWER javobi bo‘sh');
    const keys = Object.keys(p.ALLSKY_SFC_SW_DWN ?? {}).sort();
    const clean = (value: number | undefined) => (value === undefined || value < 0 ? null : value);
    const utcHours: IrradianceHour[] = keys.map((key) => ({ ghi: clean(p.ALLSKY_SFC_SW_DWN?.[key]) ?? 0, dni: clean(p.ALLSKY_SFC_SW_DNI?.[key]), dhi: clean(p.ALLSKY_SFC_SW_DIFF?.[key]), tAir: clean(p.T2M?.[key] === -999 ? undefined : p.T2M?.[key]) ?? 15 }));
    if (utcHours.length !== HOURS) throw new Error(`NASA POWER ${utcHours.length} soat qaytardi`);
    const local = Array.from({ length: HOURS }, (_, t) => utcHours[(t - 5 + HOURS) % HOURS]!);
    return pvSeriesFromIrradiance(local, { lat, lon, tiltDeg: tilt, azimuthDeg: azimuth });
  }

  /** DEFAULT: viloyat oylik jadvali (admin), «Provider ma’lumoti yo‘q, viloyat o‘rtachasi» belgisi bilan. */
  async regionalDefault(lat: number, lon: number): Promise<SolarYield> {
    const region = regionOf(lat, lon) ?? 'toshkent-shahri';
    const row = (await this.db.regionalYield.findUnique({ where: { regionCode: region } })) ?? (await this.db.regionalYield.findFirst({ orderBy: { regionCode: 'asc' } }));
    const monthly = (row?.monthlyYieldJson as number[] | undefined) ?? [70, 85, 118, 143, 173, 192, 200, 190, 158, 125, 82, 62];
    const series = seriesFromMonthlyYield(monthly, lat, lon);
    return { series, method: 'DEFAULT', provider: 'DEFAULT', datasetId: null, annualKwhPerKwp: Math.round(total(series) * 100) / 100, monthlyKwhPerKwp: monthly, stale: false };
  }

  async markStaleExpired(): Promise<number> {
    const result = await this.db.solarDataset.updateMany({ where: { status: 'FRESH', expiresAt: { lt: new Date() } }, data: { status: 'STALE' } });
    return result.count;
  }

  listDatasets(take = 100): Promise<SolarDataset[]> {
    return this.db.solarDataset.findMany({ orderBy: { fetchedAt: 'desc' }, take });
  }
}
