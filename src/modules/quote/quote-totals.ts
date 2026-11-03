import { Prisma, type QuoteItemType } from '@prisma/client';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

export interface TotalsItemInput {
  itemType: QuoteItemType;
  quantity: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
}

export interface TotalsInput {
  items: TotalsItemInput[];
  deliveryCost?: Prisma.Decimal.Value;
  otherCosts?: Prisma.Decimal.Value;
  discountAmount?: Prisma.Decimal.Value;
  vatIncluded: boolean;
  vatRate: Prisma.Decimal.Value;
}

export interface QuoteTotals {
  lineTotals: Dec[];
  equipmentSubtotal: Dec;
  installationSubtotal: Dec;
  deliveryCost: Dec;
  otherCosts: Dec;
  discountAmount: Dec;
  vatAmount: Dec;
  total: Dec;
}

const money = (value: Dec) => value.toDecimalPlaces(2, D.ROUND_HALF_UP);

/**
 * TZ 13.3: qator jami = quantity × unitPrice; subtotal va total faqat serverda.
 * total = equipment + installation + delivery + other − discount (+ QQS, agar narxlar QQSsiz bo‘lsa).
 * QQS narx ichida bo‘lsa vatAmount ma’lumot uchun ajratib ko‘rsatiladi (base × r / (100 + r)). Manfiy total — xato.
 */
export function computeQuoteTotals(input: TotalsInput): QuoteTotals {
  const sums: Record<QuoteItemType, Dec> = { EQUIPMENT: new D(0), INSTALLATION: new D(0), DELIVERY: new D(0), OTHER: new D(0) };
  const lineTotals = input.items.map((item) => {
    const line = money(new D(item.quantity).mul(item.unitPrice));
    sums[item.itemType] = sums[item.itemType].add(line);
    return line;
  });
  const deliveryCost = money(sums.DELIVERY.add(input.deliveryCost ?? 0));
  const otherCosts = money(sums.OTHER.add(input.otherCosts ?? 0));
  const discountAmount = money(new D(input.discountAmount ?? 0));
  const equipmentSubtotal = money(sums.EQUIPMENT);
  const installationSubtotal = money(sums.INSTALLATION);
  const base = equipmentSubtotal.add(installationSubtotal).add(deliveryCost).add(otherCosts).sub(discountAmount);
  const rate = new D(input.vatRate);
  const vatAmount = base.lte(0) || rate.lte(0) ? new D(0) : money(input.vatIncluded ? base.mul(rate).div(rate.add(100)) : base.mul(rate).div(100));
  const total = money(input.vatIncluded ? base : base.add(vatAmount));
  return { lineTotals, equipmentSubtotal, installationSubtotal, deliveryCost, otherCosts, discountAmount, vatAmount, total };
}
