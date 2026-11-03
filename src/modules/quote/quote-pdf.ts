import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import { toUzbekCyrillic } from '../../common/utils/translit';

/** Tijoriy taklif PDF matnlari (TZ 9.10 GET /quotes/:id/pdf). oz — lotindan kirillga. */
const UZ = {
  title: 'Tijoriy taklif',
  request: 'So‘rov',
  revision: 'Tahrir',
  date: 'Sana',
  validUntil: 'Amal qiladi',
  shop: 'Do‘kon',
  phone: 'Telefon',
  stir: 'STIR',
  system: 'Tizim',
  power: 'Quvvat',
  items: 'Taklif tarkibi',
  item: 'Nomi',
  qty: 'Miqdor',
  price: 'Narx',
  sum: 'Jami',
  equipment: 'Uskuna',
  installation: 'Montaj',
  delivery: 'Yetkazish',
  other: 'Qo‘shimcha',
  discount: 'Chegirma',
  vatIncl: 'shu jumladan QQS',
  vatAdd: 'QQS',
  total: 'Jami summa',
  perKw: '1 kVt narxi',
  warranty: 'Kafolat',
  warrantyEq: 'Uskuna',
  warrantyInst: 'Montaj',
  months: 'oy',
  duration: 'Montaj muddati',
  days: 'kun',
  included: 'Narxga kiradi',
  excluded: 'Narxga kirmaydi',
  financing: 'Moliyalashtirish',
  rate: 'Yillik stavka',
  term: 'Muddat',
  monthly: 'Oylik to‘lov',
  fx: 'Valyuta kursi (MB)',
  currency: 'so‘m',
  disclaimer: 'Taklifni tanlash platforma ichidagi shartnoma yoki to‘lov emas: keyingi qadamlar (shartnoma, to‘lov) do‘kon bilan kelishiladi. Narxlar va shartlar do‘kon tomonidan berilgan.',
  types: { ON_GRID: 'Tarmoqqa ulangan', HYBRID: 'Gibrid', OFF_GRID: 'Avtonom' } as Record<string, string>,
};
type Texts = typeof UZ;
const RU: Texts = {
  ...UZ,
  title: 'Коммерческое предложение', request: 'Заявка', revision: 'Редакция', date: 'Дата', validUntil: 'Действует до', shop: 'Магазин', phone: 'Телефон', stir: 'ИНН',
  system: 'Система', power: 'Мощность', items: 'Состав предложения', item: 'Наименование', qty: 'Кол-во', price: 'Цена', sum: 'Сумма', equipment: 'Оборудование',
  installation: 'Монтаж', delivery: 'Доставка', other: 'Прочее', discount: 'Скидка', vatIncl: 'в т.ч. НДС', vatAdd: 'НДС', total: 'Итого', perKw: 'Цена за 1 кВт',
  warranty: 'Гарантия', warrantyEq: 'Оборудование', warrantyInst: 'Монтаж', months: 'мес.', duration: 'Срок монтажа', days: 'дн.', included: 'Входит в цену',
  excluded: 'Не входит в цену', financing: 'Финансирование', rate: 'Годовая ставка', term: 'Срок', monthly: 'Ежемесячный платёж', fx: 'Курс валюты (ЦБ)', currency: 'сум',
  disclaimer: 'Выбор предложения не является договором или оплатой на платформе: дальнейшие шаги (договор, оплата) согласуются с магазином. Цены и условия предоставлены магазином.',
  types: { ON_GRID: 'Сетевая', HYBRID: 'Гибридная', OFF_GRID: 'Автономная' },
};

function textsFor(lang: string): Texts {
  if (lang === 'ru') return RU;
  if (lang !== 'oz') return UZ;
  const convert = (value: unknown): unknown => (typeof value === 'string' ? toUzbekCyrillic(value) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v)])) : value);
  return convert(UZ) as Texts;
}

const n0 = (v: unknown) => Math.round(Number(v ?? 0)).toLocaleString('ru-RU').replace(/ /g, ' ');
const nq = (v: unknown) => Number(v ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 3 }).replace(/ /g, ' ');
const d10 = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : '—');
const INK = '#07111d';
const MUTED = '#5b6678';
const LINE = '#d8dee8';

export interface QuotePdfInput {
  lang: string;
  view: {
    request: { number: number; title: string };
    currentRevision: number;
    sentAt: Date | null;
    validUntil: Date | null;
    systemType: string | null;
    systemPowerKw: unknown;
    items: Array<{ titleSnapshot: string; quantity: unknown; unitPrice: unknown; lineTotal: unknown; itemType: string }>;
    equipmentSubtotal: unknown; installationSubtotal: unknown; deliveryCost: unknown; otherCosts: unknown; discountAmount: unknown;
    vatIncluded: boolean; vatRate: unknown; vatAmount: unknown; total: unknown; pricePerKw: number | null;
    warrantyEquipmentMonths: number | null; warrantyInstallationMonths: number | null; warrantyText: string | null;
    durationDays: number | null; includedScope: string | null; excludedScope: string | null;
    exchangeRateUsd: unknown; exchangeRateDate: Date | null;
    financingOptions: Array<{ providerName: string; annualRate: unknown; termMonths: number; monthlyPayment: number | null }>;
  };
  shop: { name: string; phone: string | null; email: string | null; stir: string | null };
}

export async function buildQuotePdf({ lang, view, shop }: QuotePdfInput): Promise<Buffer> {
  const T = textsFor(lang);
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${T.title} №${view.request.number}`, Author: shop.name } });
  doc.registerFont('r', join(process.cwd(), 'assets/fonts/DejaVuSans.ttf'));
  doc.registerFont('b', join(process.cwd(), 'assets/fonts/DejaVuSans-Bold.ttf'));
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const W = doc.page.width - 96;
  const money = (v: unknown) => `${n0(v)} ${T.currency}`;

  doc.font('b').fontSize(20).fillColor(INK).text(`${T.title} — ${shop.name}`);
  doc.moveDown(0.2).font('r').fontSize(9.5).fillColor(MUTED)
    .text(`${T.request} №${view.request.number} · ${T.revision} ${view.currentRevision} · ${T.date}: ${d10(view.sentAt ?? new Date())} · ${T.validUntil}: ${d10(view.validUntil)}`);
  doc.text([shop.phone ? `${T.phone}: ${shop.phone}` : null, shop.email, shop.stir ? `${T.stir}: ${shop.stir}` : null].filter(Boolean).join(' · '));
  doc.moveDown(0.6);
  doc.font('r').fontSize(10.5).fillColor(INK).text(`${T.system}: ${view.systemType ? T.types[view.systemType] ?? view.systemType : '—'} · ${T.power}: ${view.systemPowerKw ? `${nq(view.systemPowerKw)} kW` : '—'}`);
  doc.moveDown(0.8);

  // Jadval
  doc.font('b').fontSize(13).text(T.items).moveDown(0.3);
  const cols = [W * 0.5, W * 0.12, W * 0.19, W * 0.19];
  const row = (cells: string[], bold = false) => {
    const y = doc.y;
    if (y > doc.page.height - 120) doc.addPage();
    const top = doc.y;
    let x = 48;
    let h = 0;
    cells.forEach((cell, i) => {
      doc.font(bold ? 'b' : 'r').fontSize(9.5).fillColor(INK);
      const opts = { width: cols[i] - 8, align: i === 0 ? 'left' : 'right' } as const;
      h = Math.max(h, doc.heightOfString(cell, opts));
      doc.text(cell, x + 4, top + 4, opts);
      x += cols[i];
    });
    doc.moveTo(48, top + h + 8).lineTo(48 + W, top + h + 8).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.y = top + h + 10;
    doc.x = 48;
  };
  row([T.item, T.qty, T.price, T.sum], true);
  view.items.forEach((item) => row([item.titleSnapshot, nq(item.quantity), n0(item.unitPrice), n0(item.lineTotal)]));
  doc.moveDown(0.6);

  const sums: Array<[string, string, boolean?]> = [
    [T.equipment, money(view.equipmentSubtotal)],
    [T.installation, money(view.installationSubtotal)],
    ...(Number(view.deliveryCost) ? [[T.delivery, money(view.deliveryCost)] as [string, string]] : []),
    ...(Number(view.otherCosts) ? [[T.other, money(view.otherCosts)] as [string, string]] : []),
    ...(Number(view.discountAmount) ? [[T.discount, `− ${money(view.discountAmount)}`] as [string, string]] : []),
    [view.vatIncluded ? `${T.vatIncl} (${nq(view.vatRate)}%)` : `${T.vatAdd} (${nq(view.vatRate)}%)`, money(view.vatAmount)],
    [T.total, money(view.total), true],
    ...(view.pricePerKw ? [[T.perKw, money(view.pricePerKw)] as [string, string]] : []),
  ];
  sums.forEach(([k, v, bold]) => {
    const y = doc.y;
    doc.font(bold ? 'b' : 'r').fontSize(bold ? 12 : 10).fillColor(bold ? INK : MUTED).text(k, 48 + W * 0.45, y, { width: W * 0.3 });
    doc.fillColor(INK).text(v, 48 + W * 0.75, y, { width: W * 0.25, align: 'right' });
    doc.moveDown(0.25);
  });
  doc.x = 48;
  doc.moveDown(0.8);

  const block = (title: string, body: string | null | undefined) => {
    if (!body) return;
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.font('b').fontSize(11.5).fillColor(INK).text(title, 48, doc.y, { width: W });
    doc.font('r').fontSize(10).fillColor(INK).text(body, { width: W }).moveDown(0.6);
  };
  block(T.warranty, [`${T.warrantyEq}: ${view.warrantyEquipmentMonths ?? '—'} ${T.months}`, `${T.warrantyInst}: ${view.warrantyInstallationMonths ?? '—'} ${T.months}`, view.warrantyText].filter(Boolean).join('\n'));
  block(T.duration, view.durationDays ? `${view.durationDays} ${T.days}` : null);
  block(T.included, view.includedScope);
  block(T.excluded, view.excludedScope);
  if (view.financingOptions.length) {
    block(T.financing, view.financingOptions.map((f) => `${f.providerName}: ${T.rate} ${nq(Number(f.annualRate) * 100)}%, ${T.term} ${f.termMonths} ${T.months}${f.monthlyPayment ? `, ${T.monthly} ≈ ${money(f.monthlyPayment)}` : ''}`).join('\n'));
  }
  if (view.exchangeRateUsd) block(T.fx, `1 USD = ${nq(view.exchangeRateUsd)} ${T.currency} (${d10(view.exchangeRateDate)})`);

  doc.moveDown(0.4).font('r').fontSize(8.5).fillColor(MUTED).text(T.disclaimer, 48, doc.y, { width: W });
  doc.end();
  return done;
}
