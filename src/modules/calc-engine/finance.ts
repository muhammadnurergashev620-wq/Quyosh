/** TZ 11.10–11.11. Pul — so‘m; natijalar 2 xonaga yaxlitlanadi (orkestratorda). */

export interface LifetimeYear {
  year: number;
  productionKwh: number;
  saving: number;
  exportIncome: number;
  opex: number;
  replacement: number;
  cashFlow: number;
  cumulative: number;
  discountedCumulative: number;
}

export interface LifetimeInput {
  years: number;
  initialCost: number;
  /** Har yil uchun (degradatsiya va tarif o‘sishi bilan) — orkestrator soatlik balansdan hisoblaydi. */
  perYear: Array<{ productionKwh: number; saving: number; exportIncome: number }>;
  opex1: number;
  opexGrowth: number;
  discountRate: number;
  replacements: Array<{ year: number; cost: number }>;
  co2KgPerKwh: number;
}

export interface LifetimeResult {
  years: LifetimeYear[];
  npv: number;
  irr: number | null;
  lcoe: number | null;
  discountedPayback: number | null;
  co2Kg: number;
}

export function npv(rate: number, cashFlows: number[]): number {
  return cashFlows.reduce((sum, cf, y) => sum + cf / (1 + rate) ** y, 0);
}

/** IRR: Newton–Raphson, bo‘lmasa bisection (−0,99..10); topilmasa null («hisoblanmadi»). */
export function irr(cashFlows: number[]): number | null {
  if (!cashFlows.some((cf) => cf > 0) || !cashFlows.some((cf) => cf < 0)) return null;
  const f = (r: number) => npv(r, cashFlows);
  const df = (r: number) => cashFlows.reduce((sum, cf, y) => sum - (y * cf) / (1 + r) ** (y + 1), 0);
  let r = 0.1;
  for (let i = 0; i < 50; i += 1) {
    const value = f(r);
    const slope = df(r);
    if (!Number.isFinite(value) || !Number.isFinite(slope) || Math.abs(slope) < 1e-12) break;
    const next = r - value / slope;
    if (next <= -0.99 || !Number.isFinite(next)) break;
    if (Math.abs(next - r) < 1e-9) return next;
    r = next;
  }
  let lo = -0.99;
  let hi = 10;
  let flo = f(lo);
  const fhi = f(hi);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 300; i += 1) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-6 || hi - lo < 1e-10) return mid;
    if (flo * fm < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

export function lifetime(input: LifetimeInput): LifetimeResult {
  const years: LifetimeYear[] = [];
  const flows = [-input.initialCost];
  let cumulative = -input.initialCost;
  let discounted = -input.initialCost;
  let discountedPayback: number | null = null;
  let costPv = input.initialCost;
  let energyPv = 0;
  let co2 = 0;
  for (let y = 1; y <= input.years; y += 1) {
    const data = input.perYear[y - 1] ?? { productionKwh: 0, saving: 0, exportIncome: 0 };
    const opex = input.opex1 * (1 + input.opexGrowth) ** (y - 1);
    const replacement = input.replacements.filter((item) => item.year === y).reduce((sum, item) => sum + item.cost, 0);
    const cashFlow = data.saving + data.exportIncome - opex - replacement;
    const factor = (1 + input.discountRate) ** y;
    cumulative += cashFlow;
    discounted += cashFlow / factor;
    if (discountedPayback === null && discounted >= 0) discountedPayback = y;
    costPv += (opex + replacement) / factor;
    energyPv += data.productionKwh / factor;
    co2 += data.productionKwh * input.co2KgPerKwh;
    flows.push(cashFlow);
    years.push({ year: y, productionKwh: data.productionKwh, saving: data.saving, exportIncome: data.exportIncome, opex, replacement, cashFlow, cumulative, discountedCumulative: discounted });
  }
  return { years, npv: npv(input.discountRate, flows), irr: irr(flows), lcoe: energyPv > 0 ? costPv / energyPv : null, discountedPayback, co2Kg: co2 };
}

/** TZ 11.10: oddiy qoplanish — faqat yillik sof foyda musbat bo‘lsa. */
export function simplePayback(initialCost: number, annualNetBenefit: number): { years: number | null; unavailableReason: 'NON_POSITIVE_BENEFIT' | null } {
  if (annualNetBenefit <= 0) return { years: null, unavailableReason: 'NON_POSITIVE_BENEFIT' };
  return { years: initialCost / annualNetBenefit, unavailableReason: null };
}

// ───────────── Kredit / bo‘lib to‘lash (TZ 11.11) ─────────────

export type PaymentType = 'ANNUITY' | 'DIFFERENTIATED';

export interface LoanInput {
  initialCost: number;
  downPayment: number;
  annualRate: number;
  termMonths: number;
  paymentType: PaymentType;
  oneTimeFeePct?: number;
  monthlyFee?: number;
  /** 12 oylik tejash (1-yil) — oylik «cho‘ntakdan» va break-even uchun; keyingi yillarga takrorlanadi. */
  monthlySaving?: number[];
  allowedTerms?: number[];
}

export interface LoanRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  fee: number;
  saving: number;
  net: number;
}

export interface LoanResult {
  financedAmount: number;
  firstPayment: number;
  lastPayment: number;
  totalInterest: number;
  totalFees: number;
  totalPaid: number;
  overpayment: number;
  breakEvenMonth: number | null;
  shortestSelfFundingTerm: number | null;
  schedule: LoanRow[];
}

export function loanSchedule(input: LoanInput): LoanResult {
  const n = Math.max(1, Math.round(input.termMonths));
  const financed = Math.max(0, input.initialCost - input.downPayment);
  const r = input.annualRate / 12;
  const monthlyFee = input.monthlyFee ?? 0;
  const totalFees = financed * (input.oneTimeFeePct ?? 0) + monthlyFee * n;
  const schedule: LoanRow[] = [];
  let balance = financed;
  const annuity = r === 0 ? financed / n : (financed * r) / (1 - (1 + r) ** -n);
  const principalPart = financed / n;
  let totalInterest = 0;
  for (let k = 1; k <= n; k += 1) {
    const interest = balance * r;
    let payment: number;
    let principal: number;
    if (input.paymentType === 'ANNUITY') {
      payment = k === n ? balance + interest : annuity;
      principal = payment - interest;
    } else {
      principal = k === n ? balance : principalPart;
      payment = principal + interest;
    }
    balance = Math.max(0, balance - principal);
    totalInterest += interest;
    const saving = input.monthlySaving?.length ? input.monthlySaving[(k - 1) % 12]! : 0;
    schedule.push({ month: k, payment, principal, interest, balance, fee: monthlyFee, saving, net: payment + monthlyFee - saving });
  }
  const totalPaid = schedule.reduce((sum, row) => sum + row.payment, 0) + totalFees + input.downPayment;

  // Break-even: jamg‘arilgan (tejash − to‘lovlar − boshlang‘ich to‘lov − bir martalik komissiya) ≥ 0 bo‘lgan birinchi oy.
  let breakEvenMonth: number | null = null;
  if (input.monthlySaving?.length) {
    let acc = -input.downPayment - financed * (input.oneTimeFeePct ?? 0);
    const horizon = Math.max(n, 25 * 12);
    for (let k = 1; k <= horizon; k += 1) {
      const row = schedule[k - 1];
      acc += input.monthlySaving[(k - 1) % 12]! - (row ? row.payment + row.fee : 0);
      if (acc >= 0) {
        breakEvenMonth = k;
        break;
      }
    }
  }

  let shortestSelfFundingTerm: number | null = null;
  if (input.monthlySaving?.length && input.allowedTerms?.length) {
    const avgSaving = input.monthlySaving.reduce((a, b) => a + b, 0) / input.monthlySaving.length;
    for (const term of [...input.allowedTerms].sort((a, b) => a - b)) {
      const plan = loanSchedule({ ...input, termMonths: term, monthlySaving: undefined, allowedTerms: undefined });
      const maxPayment = Math.max(...plan.schedule.map((row) => row.payment + row.fee));
      if (maxPayment <= avgSaving) {
        shortestSelfFundingTerm = term;
        break;
      }
    }
  }

  return {
    financedAmount: financed,
    firstPayment: schedule[0]?.payment ?? 0,
    lastPayment: schedule[schedule.length - 1]?.payment ?? 0,
    totalInterest,
    totalFees,
    totalPaid,
    overpayment: totalPaid - input.initialCost,
    breakEvenMonth,
    shortestSelfFundingTerm,
    schedule,
  };
}
