/**
 * 8760 soatlik vaqt o‘qi (TZ 11.6): tipik meteorologik yil, kabisa emas, Asia/Tashkent (UTC+5, yozgi vaqt yo‘q).
 * Indeks t = 0 — 1-yanvar 00:00 mahalliy vaqt.
 */
export const HOURS = 8760;
export const TASHKENT_UTC_OFFSET = 5;
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const monthOf = new Uint8Array(HOURS);
const hourOf = new Uint8Array(HOURS);
const dayOf = new Uint16Array(HOURS);
(() => {
  let t = 0;
  let day = 0;
  for (let m = 0; m < 12; m += 1) {
    for (let d = 0; d < DAYS_IN_MONTH[m]!; d += 1) {
      for (let h = 0; h < 24; h += 1) {
        monthOf[t] = m;
        hourOf[t] = h;
        dayOf[t] = day;
        t += 1;
      }
      day += 1;
    }
  }
})();

/** Soat indeksining oyi (0..11), soati (0..23), yil kuni (0..364) — mahalliy vaqt. */
export const MONTH_OF_HOUR: Readonly<Uint8Array> = monthOf;
export const HOUR_OF_DAY: Readonly<Uint8Array> = hourOf;
export const DAY_OF_YEAR: Readonly<Uint16Array> = dayOf;

/** UTC qator (t=0 — 1-yanvar 00:00 UTC) → mahalliy qator: mahalliy t soat = UTC (t − 5) soat (aylana siljish). */
export function utcToLocal(series: ArrayLike<number>): Float64Array {
  if (series.length !== HOURS) throw new Error(`Soatlik qator ${HOURS} ta bo‘lishi kerak (${series.length})`);
  const out = new Float64Array(HOURS);
  for (let t = 0; t < HOURS; t += 1) out[t] = series[(t - TASHKENT_UTC_OFFSET + HOURS) % HOURS]!;
  return out;
}

export function sumByMonth(series: ArrayLike<number>): number[] {
  const out = new Array<number>(12).fill(0);
  for (let t = 0; t < HOURS; t += 1) out[MONTH_OF_HOUR[t]!] += series[t]!;
  return out;
}

export function sumByDay(series: ArrayLike<number>): number[] {
  const out = new Array<number>(365).fill(0);
  for (let t = 0; t < HOURS; t += 1) out[DAY_OF_YEAR[t]!] += series[t]!;
  return out;
}

/** Haftalar: 1-yanvardan 7 kunlik bo‘laklar (oxirgisi 1 kun). */
export function sumByWeek(series: ArrayLike<number>): number[] {
  const days = sumByDay(series);
  const out: number[] = [];
  for (let d = 0; d < days.length; d += 7) out.push(days.slice(d, d + 7).reduce((a, b) => a + b, 0));
  return out;
}

export const total = (series: ArrayLike<number>) => {
  let s = 0;
  for (let t = 0; t < series.length; t += 1) s += series[t]!;
  return s;
};

export const round = (value: number, digits = 2) => {
  const k = 10 ** digits;
  return Math.round((value + Number.EPSILON) * k) / k;
};
