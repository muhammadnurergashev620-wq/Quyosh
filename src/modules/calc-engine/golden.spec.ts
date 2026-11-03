import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOURS, pvSeriesFromIrradiance, sumByMonth, total, utcToLocal } from './index';

/**
 * TZ 11.6 / 17.1: B usuli (NASA POWER irradiance + TS PV modeli) PVGIS (A usuli) bilan golden taqqoslash.
 * Fikstura: haqiqiy 2019 yil ma’lumoti, Samarqand (39.65, 66.95), 25° janub, 1 kWp, yo‘qotishlarsiz.
 */
const fixture = JSON.parse(gunzipSync(readFileSync(join(__dirname, '__fixtures__/samarqand-2019.json.gz'))).toString()) as {
  nasa: { ghi: number[]; dni: Array<number | null>; dhi: Array<number | null>; t2m: number[] };
  pvgisKwh: number[];
};

describe('golden: model B vs PVGIS (Samarqand 2019)', () => {
  const pvgis = utcToLocal(fixture.pvgisKwh);
  const utcHours = fixture.nasa.ghi.map((ghi, i) => ({ ghi, dni: fixture.nasa.dni[i], dhi: fixture.nasa.dhi[i], tAir: fixture.nasa.t2m[i]! }));
  const local = Array.from({ length: HOURS }, (_, t) => utcHours[(t - 5 + HOURS) % HOURS]!);
  const modelB = pvSeriesFromIrradiance(local, { lat: 39.65, lon: 66.95, tiltDeg: 25, azimuthDeg: 180 });

  it('annual specific yield within ±6 %', () => {
    const a = total(pvgis);
    const b = total(modelB);
    expect(a).toBeGreaterThan(1500);
    expect(Math.abs(b - a) / a).toBeLessThan(0.06);
  });

  // Qishda farq kattaroq (dekabr ≈ −18 %): asosan irradiance manbasi — PVGIS SARAH (sun’iy yo‘ldosh) vs NASA MERRA-2;
  // yoz oylari ±5 % ichida. Chegara ±20 %; yillik ±6 % (2019: −2,4 %).
  it('every month within ±20 %, summer within ±6 %, and the seasonal shape matches', () => {
    const a = sumByMonth(pvgis);
    const b = sumByMonth(modelB);
    for (let m = 0; m < 12; m += 1) expect(Math.abs(b[m]! - a[m]!) / a[m]!).toBeLessThan(0.2);
    for (const m of [4, 5, 6, 7]) expect(Math.abs(b[m]! - a[m]!) / a[m]!).toBeLessThan(0.06);
    const peak = (values: number[]) => values.indexOf(Math.max(...values));
    expect(Math.abs(peak(a) - peak(b))).toBeLessThanOrEqual(1);
  });

  it('hours line up after the UTC → Asia/Tashkent shift (midday peak, no night output)', () => {
    let noon = 0;
    let night = 0;
    for (let t = 0; t < HOURS; t += 1) {
      const hour = t % 24;
      if (hour >= 11 && hour <= 14) noon += pvgis[t]!;
      if (hour <= 4 || hour >= 21) night += pvgis[t]!;
    }
    expect(night).toBe(0);
    expect(noon / total(pvgis)).toBeGreaterThan(0.4);
  });
});
