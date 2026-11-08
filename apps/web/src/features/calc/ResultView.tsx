import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BatteryCharging, CalendarDays, ExternalLink, Lightbulb, PlugZap, Sun, TrendingDown, Zap } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { regionName } from '@/lib/regions';
import { cx } from '@/lib/utils';
import { formatDate, formatDecimal, formatNumber, formatPercent } from '@/lib/format';
import { CashflowChart, DayChart, MonthlyBars, RangeBar } from './charts';
import { ASSUMPTION_TEXT, insightText, kw, kwh, LIMITING, METHOD, monthName, OPTION_LABEL, sum, sumShort, SYSTEM_TYPE, TERM_TIP, WARNING_TEXT, years } from './labels';
import type { EstimateResult, Insight } from './types';
import { t } from '@/i18n';
import { track } from '@/features/m7/track';
import './calc.css';
import { safeExternalUrl } from '@/lib/return-to';
import { InfoTip } from '@/components/ui/InfoTip';
import { Tab, TabBar } from '@/components/ui/Tabs';
import { headline } from './ResultView.helpers';

const INSIGHT_ICON: Record<Insight['type'], ReactNode> = {
  BEST_SAVING_MONTH: <TrendingDown size={20} />,
  LOWEST_GENERATION_MONTH: <Sun size={20} />,
  PEAK_IMPORT_MONTH: <PlugZap size={20} />,
  BATTERY_CRITICAL_MONTH: <BatteryCharging size={20} />,
  SUMMER_SURPLUS: <Zap size={20} />,
};

export function Kpis({ result, pending, compact }: { result: EstimateResult; pending?: boolean; compact?: boolean }) {
  const s = result.scenarios;
  const monthly = (v: number | null) => (v === null ? null : v / 12);
  const noMoney = result.status === 'TARIFF_NOT_FOUND';
  return (
    <div className={cx('qs-calc-kpis', pending && 'is-pending', compact && 'is-compact')}>
      <div>
        <small className="qs-kpi-label">{t('Tavsiya etilgan quvvat')} <InfoTip text={TERM_TIP.power} label={t('Tavsiya etilgan quvvat')} /></small>
        <strong>{kw(result.systemPowerKw)}</strong>
        <span className="qs-muted">{t('{n} ta panel · invertor {inv} kVt', { n: result.panelCountEstimate, inv: result.inverterKw })}{result.batteryKwh ? ` · ${t('akk. {b} kWh', { b: result.batteryKwh })}` : ''}</span>
      </div>
      <div>
        <small className="qs-kpi-label">{t('Oylik tejash')} <InfoTip text={TERM_TIP.savings} label={t('Oylik tejash')} /></small>
        {noMoney ? <strong className="qs-muted">{t('Hisoblab bo‘lmaydi')}</strong> : <strong>{sumShort((result.money.savings ?? 0) / 12)}</strong>}
        {!noMoney && <RangeBar low={monthly(s.low.saving)} base={monthly(s.base.saving)} high={monthly(s.high.saving)} format={sumShort} />}
      </div>
      <div>
        <small className="qs-kpi-label">{t('Taxminiy narx')} <InfoTip text={TERM_TIP.cost} label={t('Taxminiy narx')} /></small>
        <strong>{sumShort(result.money.initialCost)}</strong>
        <span className="qs-muted">{result.money.costProvenance === 'CATALOG_MEDIAN' ? t('Katalog medianasi (90 kun)') : result.money.costProvenance === 'USER' ? t('Siz kiritgan') : t('Standart baho')}</span>
      </div>
      <div>
        <small className="qs-kpi-label">{t('O‘zini oqlash')} <InfoTip text={TERM_TIP.payback} label={t('O‘zini oqlash')} /></small>
        {result.money.simplePaybackYears !== null ? (
          <>
            <strong>{years(result.money.simplePaybackYears)}</strong>
            <RangeBar low={s.low.simplePaybackYears} base={s.base.simplePaybackYears} high={s.high.simplePaybackYears} format={(v) => years(v)} />
          </>
        ) : (
          <strong className="qs-muted qs-kpi-note">{result.money.paybackUnavailableReason === 'NON_POSITIVE_BENEFIT' ? t('O‘zini oqlamaydi — yillik sof foyda musbat emas') : t('Hisoblab bo‘lmaydi')}</strong>
        )}
      </div>
    </div>
  );
}

export function ResultChips({ result }: { result: EstimateResult }) {
  return (
    <div className="qs-chips">
      <Badge tone="neutral">{t('Taxminiy · Standart ssenariy')}</Badge>
      <Badge tone="primary">{LIMITING[result.limitingFactor]}</Badge>
      <Badge tone={result.productionMethod === 'DEFAULT' ? 'warning' : 'neutral'}>{METHOD[result.productionMethod]}</Badge>
      <Badge tone="neutral">{result.modelVersion}</Badge>
    </div>
  );
}

function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="qs-calc-section" open={open}>
      <summary>{title}</summary>
      <div className="qs-calc-section__body">{children}</div>
    </details>
  );
}

const EXPORT_STATUS: Record<string, string> = { VERIFIED: t('Tasdiqlangan'), UNVERIFIED: t('Tasdiqlanmagan — hisoblanmadi'), NOT_APPLICABLE: t('Qo‘llanmaydi') };

/** U8.10 to‘liq natija. `cta` — «Do‘konlardan taklif olish» kartasi; `actions` — Saqlash/PDF/Ulashish. */
export function ResultView({ result, actions, cta, shared }: { result: EstimateResult; actions?: ReactNode; cta?: ReactNode; shared?: boolean }) {
  useEffect(() => { if (!shared) track({ eventType: 'calc_result', regionCode: result.meta?.regionCode ?? undefined, properties: { mode: 'DETAILED' } }, `calc-result-${result.systemPowerKw}`); }, [result, shared]);
  const [season, setSeason] = useState(2);
  const day = result.typicalDays[season];
  const maxGen = Math.max(...result.generation.monthly);
  const replacements = (result.lifetime?.years ?? []).filter((y) => y.replacement > 0).map((y) => y.year);
  const outage = result.outage;

  return (
    <div className="qs-page qs-result">
      <header className="qs-result__head">
        <h1>{headline(result)}</h1>
        <ResultChips result={result} />
        {actions && <div className="qs-page__actions">{actions}</div>}
      </header>
      {result.warnings.filter((w) => WARNING_TEXT[w]).map((w) => <Alert key={w} tone={w === 'TARIFF_NOT_FOUND' ? 'warning' : 'info'}>{WARNING_TEXT[w]}</Alert>)}

      <div className="qs-result__top">
        <Kpis result={result} />
        {cta}
      </div>

      {day && (
        <section className="qs-card">
          <TabBar variant="tabs" role="tablist">
            {result.typicalDays.map((item, index) => (
              <Tab key={item.month} role="tab" aria-selected={season === index} onClick={() => setSeason(index)} selected={season === index}>{monthName(item.month)}</Tab>
            ))}
          </TabBar>
          <DayChart title={t('Quyosh kuni: {m}dagi odatiy kun', { m: monthName(day.month) })} generation={day.generation} load={day.load} />
        </section>
      )}

      {result.insights.length > 0 && (
        <div className="qs-insights">
          {result.insights.map((item) => (
            <article key={item.type} className="qs-insight">
              <span aria-hidden="true">{INSIGHT_ICON[item.type]}</span>
              <p>{insightText(item, { maxGeneration: maxGen })}</p>
            </article>
          ))}
        </div>
      )}

      <Section title={t('Energiya')} open>
        <div className="qs-stat-line">
          <span>{t('Kunlik')}: <b>{kwh(Math.round(result.generation.annual / 365))}</b></span>
          <span>{t('Oylik')}: <b>{kwh(Math.round(result.generation.annual / 12))}</b></span>
          <span>{t('Yillik')}: <b>{kwh(result.generation.annual)}</b></span>
          <span>{t('1 kVt dan')}: <b>{kwh(result.generation.specificYield)}</b></span>
        </div>
        <MonthlyBars title={t('Oylik ishlab chiqarish va iste’mol')} tip={TERM_TIP.kwh} unit="kWh" format={(v) => kwh(Math.round(v))} series={[{ name: t('Ishlab chiqarish'), color: 'gen', values: result.generation.monthly }, { name: t('Iste’mol'), color: 'load', values: result.load.monthly }]} />
        <dl className="qs-dl">
          <dt>{t('O‘zida iste’mol')}</dt><dd>{kwh(result.energy.selfConsumedKwh)} ({Math.round(result.energy.selfSufficiency * 100)} %)</dd>
          <dt>{t('Tarmoqdan olish')}</dt><dd>{kwh(result.energy.gridImportKwh)}</dd>
          <dt>{t('Tarmoqqa berish')}</dt><dd>{kwh(result.energy.gridExportKwh)}</dd>
          {result.batteryKwh > 0 && <><dt>{t('Akkumulyator orqali')}</dt><dd>{kwh(result.energy.batteryThroughputKwh)}</dd></>}
          {result.clippingLossKwh > 0 && <><dt>{t('Invertor cheklovi (clipping)')} <InfoTip text={TERM_TIP.inverter} label={t('Invertor')} /></dt><dd>{kwh(result.clippingLossKwh)}</dd></>}
          {result.curtailmentKwh > 0 && <><dt>{t('Foydalanilmagan ortiqcha')}</dt><dd>{kwh(result.curtailmentKwh)}</dd></>}
        </dl>
      </Section>

      <Section title={t('Pul')}>
        {result.status === 'TARIFF_NOT_FOUND' ? (
          <Alert tone="warning">{t('Bu hudud uchun tarif ma’lumoti yo‘q — kWh asosidagi natijalar ko‘rsatildi.')}</Alert>
        ) : (
          <>
            <MonthlyBars title={t('Elektr to‘lovi: quyoshsiz va quyosh bilan')} unit={t('so‘m')} format={sumShort} series={[{ name: t('Quyoshsiz'), color: 'load', values: result.money.monthlyBillWithout ?? [] }, { name: t('Quyosh bilan'), color: 'gen', values: result.money.monthlyBillWith ?? [] }]} />
            <dl className="qs-dl">
              <dt>{t('Yillik to‘lov quyoshsiz')}</dt><dd>{sum(result.money.billWithoutSolar ?? 0)}</dd>
              <dt>{t('Yillik to‘lov quyosh bilan')}</dt><dd>{sum(result.money.billWithSolar ?? 0)}</dd>
              <dt>{t('Yillik tejash')}</dt><dd><b>{sum(result.money.savings ?? 0)}</b></dd>
              <dt>{t('Eksport daromadi')}</dt><dd>{result.money.exportIncome.value !== null ? sum(result.money.exportIncome.value) : `${kwh(result.money.exportIncome.exportKwh)} · ${EXPORT_STATUS[result.money.exportIncome.status]}`}</dd>
              <dt>{t('Yillik servis')}</dt><dd>{sum(result.money.annualOpex)}</dd>
              <dt>{t('Boshlang‘ich xarajat')}</dt><dd>{sum(result.money.initialCost)} <small className="qs-muted">({t('uskuna {a}, montaj {b}, yetkazish {c}', { a: sumShort(result.money.costBreakdown.equipment), b: sumShort(result.money.costBreakdown.installation), c: sumShort(result.money.costBreakdown.delivery) })})</small></dd>
            </dl>
          </>
        )}
      </Section>

      {result.lifetime && (
        <Section title={t('25 yil')}>
          <CashflowChart title={t('Jamg‘arilgan pul oqimi')} points={result.lifetime.years.map((y) => ({ year: y.year, value: y.cumulative }))} markers={replacements} format={sumShort} />
          <p className="qs-muted qs-m-0">{t('Belgilar — invertor yoki akkumulyator almashtirish yillari. CO₂ tejalishi: {t} t.', { t: formatDecimal((result.lifetime.co2Kg / 1000), 1) })}</p>
          <details>
            <summary>{t('Kengaytirilgan ko‘rsatkichlar')}</summary>
            <dl className="qs-dl qs-mt-2">
              <dt title={t('Kelajakdagi foydaning bugungi qiymati')}>NPV</dt><dd>{sum(result.lifetime.npv)}</dd>
              <dt title={t('Ichki daromadlilik darajasi')}>IRR</dt><dd>{result.lifetime.irr === null ? t('hisoblanmadi') : `${formatPercent(result.lifetime.irr, 1)}`}</dd>
              <dt title={t('1 kWh energiyaning o‘rtacha tannarxi')}>LCOE</dt><dd>{result.lifetime.lcoe === null ? '—' : `${formatNumber(result.lifetime.lcoe)} ${t('so‘m/kWh')}`}</dd>
              <dt>{t('Diskontlangan qoplanish')}</dt><dd>{result.lifetime.discountedPayback === null ? t('25 yil ichida yo‘q') : years(result.lifetime.discountedPayback)}</dd>
            </dl>
          </details>
        </Section>
      )}

      {result.financing && !shared && (
        <Section title={t('Kredit va bo‘lib to‘lash')}>
          <dl className="qs-dl">
            <dt>{t('Oylik to‘lov')}</dt><dd>{result.financing.firstPayment === result.financing.lastPayment ? sum(result.financing.firstPayment) : `${sum(result.financing.firstPayment)} → ${sum(result.financing.lastPayment)}`}</dd>
            <dt>{t('Jami to‘lov')}</dt><dd>{sum(result.financing.totalPaid)}</dd>
            <dt>{t('Ortiqcha to‘lov')}</dt><dd>{sum(result.financing.overpayment)}</dd>
            <dt>{t('Tejash qoplaydigan oy')}</dt><dd>{result.financing.breakEvenMonth ? t('{n}-oy', { n: result.financing.breakEvenMonth }) : '—'}</dd>
          </dl>
          <Alert tone="info">{t('Bu taxminiy hisob. Yakuniy shartlarni bank yoki sotuvchi belgilaydi; platforma kredit bermaydi va tasdiqlamaydi.')}</Alert>
        </Section>
      )}

      <Section title={t('Elektr o‘chganda')}>
        {!outage || !outage.applicable ? (
          <Alert tone="warning" title={t('Zaxira yo‘q')}>
            {t('Tarmoqqa ulangan tizim elektr o‘chganda xavfsizlik uchun o‘chadi.')} {!shared && <Link to="/mijoz/uzilish">{t('Gibrid variantni hisoblash')}</Link>}
          </Alert>
        ) : (
          <dl className="qs-dl">
            <dt>{t('Kritik yuklama')}</dt><dd>{kw(outage.criticalLoadKw)} ({t('ishga tushish {p}', { p: kw(outage.peakStartKw) })})</dd>
            <dt>{t('Tunda zaxira')}</dt><dd>{outage.backupHoursNight === null ? '—' : t('{h} soat', { h: formatDecimal(outage.backupHoursNight, 1) })}</dd>
            <dt>{t('Kunduzi')}</dt><dd>{outage.dayUnlimited ? t('Quyosh bor paytda cheklanmagan') : outage.backupHoursDay === null ? '—' : t('{h} soat', { h: formatDecimal(outage.backupHoursDay, 1) })}</dd>
            <dt>{t('Invertor')}</dt><dd>{outage.inverterOk ? t('Yetarli') : t('Yetarli emas')}</dd>
          </dl>
        )}
      </Section>

      <Section title={t('Qanday hisoblandi?')}>
        <dl className="qs-dl">
          <dt>{t('Quyosh ma’lumoti')}</dt><dd>{METHOD[result.productionMethod]} · {kwh(result.meta.solar.annualKwhPerKwp)}/kVt {t('(yo‘qotishlarsiz)')}</dd>
          <dt>{t('Hudud')}</dt><dd>{regionName(result.meta.regionCode)}</dd>
          <dt>{t('Panel burchagi')}</dt><dd>{result.meta.tiltDeg}° · {t('yo‘nalish')} {result.meta.azimuthDeg}°</dd>
          <dt>{t('Tarif')}</dt><dd>{result.meta.tariff ? <>{result.meta.tariff.title} · v{result.meta.tariff.version} · {formatDate(result.meta.tariff.effectiveFrom)} {safeExternalUrl(result.meta.tariff.sourceUrl) && <a href={safeExternalUrl(result.meta.tariff.sourceUrl)} target="_blank" rel="noreferrer"><ExternalLink size={12} /> {t('manba')}</a>}</> : t('Topilmadi')}</dd>
          <dt>{t('Eksport qoidasi')}</dt><dd>{result.meta.exportRule ? `v${result.meta.exportRule.version}` : t('Yo‘q')}</dd>
          <dt>{t('Valyuta kursi')}</dt><dd>{result.meta.exchangeRate ? `1 USD = ${formatNumber(Number(result.meta.exchangeRate.rateToUzs))} ${t('so‘m')} (${formatDate(result.meta.exchangeRate.rateDate)})` : '—'}</dd>
          <dt>{t('Model versiyasi')}</dt><dd>{result.modelVersion} · {result.meta.calculationSettings.modelVersion}</dd>
          <dt>{t('Tizim turi')}</dt><dd>{SYSTEM_TYPE[result.systemType].title}</dd>
          <dt>{t('Variantlar')}</dt><dd>{result.sizingOptions.map((o) => `${OPTION_LABEL[o.key]} ${kw(o.kwp)}`).join(' · ')}</dd>
          <dt>{t('Ssenariylar')}</dt><dd>{t('konservativ: unumdorlik {a} %, yo‘qotish +{b} p.p.; optimistik: +{c} %', { a: Math.round(result.scenarios.low.assumptions.yieldDelta * 100), b: Math.round(result.scenarios.low.assumptions.lossDelta * 100), c: Math.round(result.scenarios.high.assumptions.yieldDelta * 100) })}</dd>
          <dt>{t('Hisoblangan')}</dt><dd><CalendarDays size={12} /> {formatDate(result.meta.calculatedAt)}</dd>
        </dl>
        {result.assumptions.length > 0 && <ul className="qs-calc-notes">{result.assumptions.map((a) => <li key={a}><Lightbulb size={14} /> {ASSUMPTION_TEXT[a] ?? a}</li>)}</ul>}
      </Section>

      <p className="qs-result__disclaimer"><AlertTriangle size={14} aria-hidden="true" /> {t('Natijalar prognoz. Haqiqiy ishlab chiqarish ob-havo, soya, uskuna va montaj sifatiga bog‘liq.')}</p>
    </div>
  );
}

