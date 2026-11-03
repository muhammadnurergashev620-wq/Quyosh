import { HttpStatus, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Currency, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import { tashkentDate } from '../../common/utils/tashkent-date';

const CBU_URL = (currency: string) => `https://cbu.uz/uz/arkhiv-kursov-valyut/json/${currency}/`;
const SOURCE = 'O‘zbekiston Respublikasi Markaziy banki (cbu.uz)';
/** Kurs shu kundan eski bo‘lsa — «eskirgan» ogohlantirishi (TZ 12: oxirgi kurs + alert). */
const STALE_DAYS = 3;

export interface LatestRate {
  currency: Currency;
  rateToUzs: string;
  rateDate: string;
  source: string;
  stale: boolean;
}

/** MB rasmiy kursi (TZ 9.5, 12: exchange-rate-refresh har kuni 09:30 Asia/Tashkent). */
@Injectable()
export class ExchangeRateService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(private readonly db: PrismaService) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test' || process.env.EXCHANGE_RATE_FETCH === 'false') return;
    // Bazada kurs bo‘lmasa — ishga tushganda bir marta (fon rejimida) olib ko‘ramiz.
    void this.db.exchangeRate
      .count()
      .then((count) => (count === 0 ? this.refresh('USD') : undefined))
      .catch((error: Error) => this.logger.warn(`Boshlang‘ich kurs olinmadi: ${error.message}`));
  }

  @Cron('30 9 * * *', { name: 'exchange-rate-refresh', timeZone: 'Asia/Tashkent' })
  async scheduledRefresh() {
    try {
      await this.refresh('USD');
    } catch (error) {
      this.logger.error(`Kurs yangilanmadi, oxirgi kurs ishlatiladi: ${(error as Error).message}`);
    }
  }

  /** MB’dan kursni olib saqlaydi (idempotent: currency+rateDate unique). */
  async refresh(currency: Currency = 'USD') {
    const response = await fetch(CBU_URL(currency), { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`cbu.uz HTTP ${response.status}`);
    const body = (await response.json()) as Array<{ Ccy?: string; Rate?: string; Date?: string }>;
    const row = body.find((item) => item.Ccy === currency);
    const match = row?.Date?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    const rate = Number(row?.Rate);
    if (!row || !match || !Number.isFinite(rate) || rate <= 0) throw new Error('cbu.uz javobi noto‘g‘ri');
    const rateDate = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00Z`);
    const saved = await this.db.exchangeRate.upsert({
      where: { currency_rateDate: { currency, rateDate } },
      update: { rateToUzs: row.Rate!, fetchedAt: new Date(), source: SOURCE },
      create: { currency, rateToUzs: row.Rate!, rateDate, source: SOURCE },
    });
    this.logger.log(`Kurs: 1 ${currency} = ${saved.rateToUzs.toString()} so‘m (${match[0]})`);
    return saved;
  }

  async latest(currency: Currency = 'USD'): Promise<LatestRate | null> {
    if (currency === 'UZS') return { currency, rateToUzs: '1', rateDate: tashkentDate(), source: 'UZS', stale: false };
    const row = await this.db.exchangeRate.findFirst({ where: { currency }, orderBy: { rateDate: 'desc' } });
    if (!row) return null;
    const rateDate = row.rateDate.toISOString().slice(0, 10);
    const ageDays = (Date.parse(tashkentDate()) - Date.parse(rateDate)) / 86_400_000;
    return { currency, rateToUzs: row.rateToUzs.toString(), rateDate, source: row.source, stale: ageDays > STALE_DAYS };
  }

  async latestOrThrow(currency: Currency = 'USD') {
    const rate = await this.latest(currency);
    if (!rate) throw new DomainException(HttpStatus.SERVICE_UNAVAILABLE, 'EXCHANGE_RATE_UNAVAILABLE', ERRORS.EXCHANGE_RATE_UNAVAILABLE);
    return rate;
  }

  history(currency: Currency = 'USD') {
    return this.db.exchangeRate.findMany({ where: { currency }, orderBy: { rateDate: 'desc' }, take: 60 });
  }

  /** Narxni so‘mga o‘giradi (Decimal aniqligida, 2 xona). */
  static toUzs(price: Prisma.Decimal | string, currency: Currency, rate: LatestRate | null): string | null {
    const value = new Prisma.Decimal(price);
    if (currency === 'UZS') return value.toFixed(2);
    if (!rate) return null;
    return value.mul(rate.rateToUzs).toDecimalPlaces(2).toFixed(2);
  }
}
