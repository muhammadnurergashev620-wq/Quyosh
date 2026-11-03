import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { join } from 'node:path';
import { toUzbekCyrillic } from '../../../common/utils/translit';
import type { EngineResult } from '../../calc-engine';

/** PDF matnlari (TZ 4.18, U8.14). oz — o‘zbek lotinidan kirillga transliteratsiya. */
const UZ = {
  title: 'Quyosh tizimi hisobi',
  generated: 'Tayyorlangan',
  region: 'Hudud',
  system: 'Tizim',
  systemTypes: { ON_GRID: 'Tarmoqqa ulangan', HYBRID: 'Gibrid', OFF_GRID: 'Avtonom' },
  power: 'Quvvat',
  panels: 'Panellar soni',
  inverter: 'Invertor',
  battery: 'Akkumulyator',
  generation: 'Yillik ishlab chiqarish',
  monthlySaving: 'Oylik tejash',
  cost: 'Taxminiy narx',
  payback: 'O‘zini oqlash',
  years: 'yil',
  notCalculated: 'Hisoblanmadi',
  noTariff: 'Bu hudud uchun tarif ma’lumoti yo‘q — moliyaviy natijalar hisoblanmadi.',
  monthlyTitle: 'Oylik energiya va to‘lovlar',
  month: 'Oy',
  gen: 'Ishlab chiq., kWh',
  load: 'Iste’mol, kWh',
  imp: 'Tarmoqdan, kWh',
  exp: 'Tarmoqqa, kWh',
  billWithout: 'To‘lov quyoshsiz',
  billWith: 'Quyosh bilan',
  lifetimeTitle: '25 yillik pul oqimi',
  year: 'Yil',
  saving: 'Tejash',
  cashflow: 'Oqim',
  cumulative: 'Jamg‘arilgan',
  co2: 'CO₂ tejalishi',
  financingTitle: 'Kredit',
  payment: 'Oylik to‘lov',
  overpayment: 'Ortiqcha to‘lov',
  outageTitle: 'Elektr o‘chganda',
  noBackup: 'Tarmoqqa ulangan tizim elektr o‘chganda xavfsizlik uchun o‘chadi.',
  backupNight: 'Tunda zaxira',
  hours: 'soat',
  howTitle: 'Qanday hisoblandi',
  source: 'Quyosh ma’lumoti',
  tariff: 'Tarif',
  model: 'Model versiyasi',
  rate: 'Valyuta kursi',
  disclaimer: 'Natijalar prognoz. Haqiqiy ishlab chiqarish ob-havo, soya, uskuna va montaj sifatiga bog‘liq. Kredit hisobi taxminiy: yakuniy shartlarni bank yoki sotuvchi belgilaydi.',
  qrShare: 'Hisobni telefonda ochish',
  qrCabinet: 'Kabinetda ochish',
  methods: { A_PV_YIELD: 'PVGIS (JRC)', B_IRRADIANCE: 'NASA POWER + quyosh modeli', DEFAULT: 'Viloyat o‘rtachasi' },
  sum: 'so‘m',
  months: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
};

type Texts = typeof UZ;

const RU: Texts = {
  ...UZ,
  title: 'Расчёт солнечной системы',
  generated: 'Сформирован',
  region: 'Регион',
  system: 'Система',
  systemTypes: { ON_GRID: 'Сетевая', HYBRID: 'Гибридная', OFF_GRID: 'Автономная' },
  power: 'Мощность',
  panels: 'Количество панелей',
  inverter: 'Инвертор',
  battery: 'Аккумулятор',
  generation: 'Выработка за год',
  monthlySaving: 'Экономия в месяц',
  cost: 'Ориентировочная цена',
  payback: 'Окупаемость',
  years: 'лет',
  notCalculated: 'Не рассчитано',
  noTariff: 'Для региона нет данных о тарифе — финансовые результаты не рассчитаны.',
  monthlyTitle: 'Энергия и платежи по месяцам',
  month: 'Мес.',
  gen: 'Выработка, кВт·ч',
  load: 'Потребление, кВт·ч',
  imp: 'Из сети, кВт·ч',
  exp: 'В сеть, кВт·ч',
  billWithout: 'Платёж без солнца',
  billWith: 'С солнцем',
  lifetimeTitle: 'Денежный поток за 25 лет',
  year: 'Год',
  saving: 'Экономия',
  cashflow: 'Поток',
  cumulative: 'Накопленный',
  co2: 'Сокращение CO₂',
  financingTitle: 'Кредит',
  payment: 'Ежемесячный платёж',
  overpayment: 'Переплата',
  outageTitle: 'При отключении электричества',
  noBackup: 'Сетевая система при отключении сети выключается из соображений безопасности.',
  backupNight: 'Резерв ночью',
  hours: 'ч',
  howTitle: 'Как рассчитано',
  source: 'Солнечные данные',
  tariff: 'Тариф',
  model: 'Версия модели',
  rate: 'Курс валюты',
  disclaimer: 'Результаты — прогноз. Фактическая выработка зависит от погоды, затенения, оборудования и качества монтажа. Расчёт кредита ориентировочный: окончательные условия определяет банк или продавец.',
  qrShare: 'Открыть расчёт на телефоне',
  qrCabinet: 'Открыть в кабинете',
  methods: { A_PV_YIELD: 'PVGIS (JRC)', B_IRRADIANCE: 'NASA POWER + модель', DEFAULT: 'Среднее по области' },
  sum: 'сум',
  months: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
};

function textsFor(lang: string): Texts {
  if (lang === 'ru') return RU;
  if (lang !== 'oz') return UZ;
  const convert = (value: unknown): unknown => (typeof value === 'string' ? toUzbekCyrillic(value) : Array.isArray(value) ? value.map(convert) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v)])) : value);
  return convert(UZ) as Texts;
}

const n0 = (v: number) => Math.round(v).toLocaleString('ru-RU').replace(/ /g, ' ');
const n1 = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 1 }).replace(/ /g, ' ');

const FONT = join(process.cwd(), 'assets/fonts/DejaVuSans.ttf');
const FONT_BOLD = join(process.cwd(), 'assets/fonts/DejaVuSans-Bold.ttf');
const INK = '#07111d';
const MUTED = '#5b6678';
const GEN = '#d97706';
const LOAD = '#2563eb';

export interface ReportOptions {
  lang: string;
  qrUrl: string | null;
  qrMode: 'SHARE' | 'CABINET' | 'NONE';
  regionName: string;
  title?: string | null;
}

/** A4 PDF: xulosa, oylik jadval va grafik, 25 yil, kredit, zaxira, manbalar va ogohlantirish. */
export async function buildReportPdf(result: EngineResult & { meta?: { tariff?: { title: string; version: number } | null; calculatedAt?: string; exchangeRate?: { rateToUzs: string; rateDate: string } | null } }, options: ReportOptions): Promise<Buffer> {
  const T = textsFor(options.lang);
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: T.title, Author: 'Quyosh.uz' } });
  doc.registerFont('r', FONT);
  doc.registerFont('b', FONT_BOLD);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const width = doc.page.width - 96;
  const sum = (v: number) => `${n0(v)} ${T.sum}`;

  // ── 1-sahifa: xulosa ──
  doc.font('b').fontSize(22).fillColor(INK).text(options.title || T.title);
  doc.moveDown(0.2).font('r').fontSize(10).fillColor(MUTED).text(`${T.generated}: ${new Date(result.meta?.calculatedAt ?? Date.now()).toISOString().slice(0, 10)} · ${T.region}: ${options.regionName} · Quyosh.uz`);
  doc.moveDown(1);
  const kpis: Array<[string, string]> = [
    [T.power, `${n1(result.systemPowerKw)} kW`],
    [T.generation, `${n0(result.generation.annual)} kWh`],
    [T.monthlySaving, result.money.savings === null ? T.notCalculated : sum(result.money.savings / 12)],
    [T.cost, sum(result.money.initialCost)],
    [T.payback, result.money.simplePaybackYears === null ? T.notCalculated : `${n1(result.money.simplePaybackYears)} ${T.years}`],
  ];
  const boxW = (width - 16) / 3;
  const y0 = doc.y;
  kpis.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 48 + col * (boxW + 8);
    const y = y0 + row * 64;
    doc.roundedRect(x, y, boxW, 56, 8).lineWidth(0.8).strokeColor('#d8dee8').stroke();
    doc.font('r').fontSize(9).fillColor(MUTED).text(label, x + 10, y + 9, { width: boxW - 20 });
    doc.font('b').fontSize(14).fillColor(INK).text(value, x + 10, y + 26, { width: boxW - 20 });
  });
  doc.y = y0 + 2 * 64 + 6;
  doc.x = 48;
  if (result.status === 'TARIFF_NOT_FOUND') doc.font('r').fontSize(10).fillColor('#b45309').text(T.noTariff).moveDown(0.5);

  doc.font('b').fontSize(13).fillColor(INK).text(T.system).moveDown(0.3);
  const rows: Array<[string, string]> = [
    [T.system, T.systemTypes[result.systemType]],
    [T.panels, `${result.panelCountEstimate} × ${result.panel.powerW} W`],
    [T.inverter, `${result.inverterKw} kW`],
    [T.battery, result.batteryKwh ? `${result.batteryKwh} kWh` : '—'],
  ];
  rows.forEach(([k, v]) => doc.font('r').fontSize(10).fillColor(MUTED).text(k, { continued: true, width: 200 }).fillColor(INK).text(`   ${v}`));

  if (options.qrUrl && options.qrMode !== 'NONE') {
    const png = await QRCode.toBuffer(options.qrUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
    const qy = Math.max(doc.y + 16, 520);
    doc.image(png, 48, qy, { width: 110 });
    doc.font('b').fontSize(10).fillColor(INK).text(options.qrMode === 'SHARE' ? T.qrShare : T.qrCabinet, 170, qy + 30, { width: width - 130 });
    doc.font('r').fontSize(8).fillColor(MUTED).text(options.qrUrl, 170, qy + 48, { width: width - 130 });
    doc.x = 48;
  }

  // ── 2-sahifa: oylik grafik va jadval ──
  doc.addPage();
  doc.font('b').fontSize(15).fillColor(INK).text(T.monthlyTitle).moveDown(0.6);
  const chartTop = doc.y;
  const chartH = 150;
  const max = Math.max(...result.generation.monthly, ...result.load.monthly, 1);
  const slot = width / 12;
  doc.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(48, chartTop + chartH).lineTo(48 + width, chartTop + chartH).stroke();
  for (let m = 0; m < 12; m += 1) {
    const g = (result.generation.monthly[m]! / max) * chartH;
    const l = (result.load.monthly[m]! / max) * chartH;
    const x = 48 + slot * m + slot * 0.18;
    const bw = slot * 0.3;
    doc.rect(x, chartTop + chartH - g, bw, g).fill(GEN);
    doc.rect(x + bw + 2, chartTop + chartH - l, bw, l).fill(LOAD);
    doc.font('r').fontSize(8).fillColor(MUTED).text(T.months[m]!, 48 + slot * m, chartTop + chartH + 4, { width: slot, align: 'center' });
  }
  doc.rect(48, chartTop + chartH + 20, 8, 8).fill(GEN).font('r').fontSize(8).fillColor(INK).text(T.gen, 60, chartTop + chartH + 19);
  doc.rect(170, chartTop + chartH + 20, 8, 8).fill(LOAD).fillColor(INK).text(T.load, 182, chartTop + chartH + 19);
  doc.y = chartTop + chartH + 44;
  doc.x = 48;

  const cols = [T.month, T.gen, T.load, T.imp, T.exp, T.billWithout, T.billWith];
  const colW = [44, 70, 70, 68, 68, 90, 89];
  const table = (header: string[], widths: number[], body: string[][]) => {
    let y = doc.y;
    const drawRow = (cells: string[], bold: boolean) => {
      let x = 48;
      const rowH = bold ? 26 : 16;
      cells.forEach((cell, i) => {
        doc.font(bold ? 'b' : 'r').fontSize(bold ? 7 : 8).fillColor(bold ? MUTED : INK).text(cell, x + 2, y + 3, { width: widths[i]! - 4, align: i === 0 ? 'left' : 'right' });
        x += widths[i]!;
      });
      y += rowH;
      doc.lineWidth(0.3).strokeColor('#e2e8f0').moveTo(48, y).lineTo(48 + widths.reduce((a, b) => a + b, 0), y).stroke();
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 48;
      }
    };
    drawRow(header, true);
    body.forEach((row) => drawRow(row, false));
    doc.y = y + 8;
    doc.x = 48;
  };
  table(cols, colW, Array.from({ length: 12 }, (_, m) => [
    T.months[m]!, n0(result.generation.monthly[m]!), n0(result.load.monthly[m]!), n0(result.energy.monthlyImport[m]!), n0(result.energy.monthlyExport[m]!),
    result.money.monthlyBillWithout ? n0(result.money.monthlyBillWithout[m]!) : '—', result.money.monthlyBillWith ? n0(result.money.monthlyBillWith[m]!) : '—',
  ]));

  // ── 3-sahifa: 25 yil, kredit, zaxira ──
  if (result.lifetime) {
    doc.addPage();
    doc.font('b').fontSize(15).fillColor(INK).text(T.lifetimeTitle).moveDown(0.5);
    doc.font('r').fontSize(10).fillColor(INK).text(`NPV: ${sum(result.lifetime.npv)} · IRR: ${result.lifetime.irr === null ? '—' : `${n1(result.lifetime.irr * 100)} %`} · LCOE: ${result.lifetime.lcoe === null ? '—' : `${n0(result.lifetime.lcoe)} ${T.sum}/kWh`} · ${T.co2}: ${n1(result.lifetime.co2Kg / 1000)} t`).moveDown(0.6);
    table([T.year, 'kWh', T.saving, T.cashflow, T.cumulative], [40, 90, 120, 120, 129], result.lifetime.years.map((y) => [String(y.year), n0(y.productionKwh), n0(y.saving), n0(y.cashFlow), n0(y.cumulative)]));
  }
  if (result.financing) {
    doc.font('b').fontSize(13).fillColor(INK).text(T.financingTitle).moveDown(0.3);
    doc.font('r').fontSize(10).text(`${T.payment}: ${sum(result.financing.firstPayment)}${result.financing.firstPayment !== result.financing.lastPayment ? ` → ${sum(result.financing.lastPayment)}` : ''} · ${T.overpayment}: ${sum(result.financing.overpayment)}`).moveDown(0.6);
  }
  doc.font('b').fontSize(13).fillColor(INK).text(T.outageTitle).moveDown(0.3);
  doc.font('r').fontSize(10).fillColor(INK).text(!result.outage || !result.outage.applicable ? T.noBackup : `${T.backupNight}: ${result.outage.backupHoursNight === null ? '—' : `${n1(result.outage.backupHoursNight)} ${T.hours}`}`).moveDown(0.8);

  // ── Manbalar va ogohlantirish ──
  doc.font('b').fontSize(13).fillColor(INK).text(T.howTitle).moveDown(0.3);
  doc.font('r').fontSize(9).fillColor(INK)
    .text(`${T.source}: ${T.methods[result.productionMethod]} · ${n0(result.generation.specificYield)} kWh/kW`)
    .text(`${T.tariff}: ${result.meta?.tariff ? `${result.meta.tariff.title} (v${result.meta.tariff.version})` : '—'}`)
    .text(`${T.rate}: ${result.meta?.exchangeRate ? `1 USD = ${n0(Number(result.meta.exchangeRate.rateToUzs))} ${T.sum} (${String(result.meta.exchangeRate.rateDate).slice(0, 10)})` : '—'}`)
    .text(`${T.model}: ${result.modelVersion}`)
    .moveDown(0.8);
  doc.font('r').fontSize(9).fillColor(MUTED).text(T.disclaimer, { width });
  doc.end();
  return done;
}
