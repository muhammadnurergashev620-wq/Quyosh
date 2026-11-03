import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import { M6Notifier } from '../quote-request/m6-notifier.service';
import { createDefaultReminders, DEVIATION_ALERT, deviation, nextOccurrence, SNOOZE_DAYS } from './reminders';
import type { CreateInstalledSystemDto, ReadingDto, ReminderActionDto } from './dto/installed-system.dto';

const DAY = 86_400_000;
const monthStart = (period: string) => new Date(`${period}-01T00:00:00Z`);
const periodOf = (d: Date) => d.toISOString().slice(0, 7);

/** Montajdan keyingi kabinet (TZ 3.6, U10.5): ishlab chiqarish, prognoz bilan taqqoslash, kafolatlar, eslatmalar. */
@Injectable()
export class InstalledSystemService {
  constructor(
    private readonly db: PrismaService,
    private readonly notify: M6Notifier,
  ) {}

  private async own(userId: string, id: string) {
    const row = await this.db.installedSystem.findFirst({ where: { id, userId, archivedAt: null } });
    if (!row) throw new NotFoundException(ERRORS.INSTALLED_SYSTEM_NOT_FOUND);
    return row;
  }

  /** 12 oylik prognoz (kWh): hisobdan yoki viloyat o‘rtacha unumidan. */
  private expected(json: Prisma.JsonValue | null): number[] | null {
    return Array.isArray(json) && json.length === 12 ? (json as number[]).map(Number) : null;
  }

  async list(userId: string) {
    const rows = await this.db.installedSystem.findMany({
      where: { userId, archivedAt: null },
      orderBy: { installedAt: 'desc' },
      include: {
        installation: { select: { id: true, shop: { select: { id: true, name: true, slug: true } } } },
        readings: { orderBy: { periodMonth: 'desc' }, take: 1 },
        reminders: { where: { active: true }, orderBy: { nextAt: 'asc' }, take: 1 },
        warranties: { orderBy: { endsAt: 'asc' } },
      },
    });
    return rows.map((r) => {
      const exp = this.expected(r.expectedMonthlyKwhJson);
      const last = r.readings[0];
      const lastExpected = last && exp ? exp[last.periodMonth.getUTCMonth()] : null;
      return {
        id: r.id,
        title: r.title ?? (r.installation?.shop ? `${r.installation.shop.name}` : null),
        systemPowerKw: r.systemPowerKw,
        systemType: r.systemType,
        installedAt: r.installedAt,
        shop: r.installation?.shop ?? null,
        lastReading: last ? { period: periodOf(last.periodMonth), generatedKwh: Number(last.generatedKwh), expectedKwh: lastExpected, deviation: deviation(Number(last.generatedKwh), lastExpected) } : null,
        nextReminder: r.reminders[0] ?? null,
        warrantyEndsAt: r.warranties[0]?.endsAt ?? null,
      };
    });
  }

  async get(userId: string, id: string) {
    const own = await this.own(userId, id);
    // M7 dan oldin yaratilgan tizimlar: standart eslatmalar bir marta qo‘shiladi.
    if (!(await this.db.maintenanceReminder.count({ where: { installedSystemId: id } }))) {
      await this.db.$transaction((tx) => createDefaultReminders(tx, id, own.installedAt));
    }
    const r = await this.db.installedSystem.findUniqueOrThrow({
      where: { id },
      include: {
        installation: { select: { id: true, quoteId: true, requestId: true, confirmedAt: true, shop: { select: { id: true, name: true, slug: true } } } },
        readings: { orderBy: { periodMonth: 'asc' } },
        reminders: { orderBy: { nextAt: 'asc' } },
        warranties: { orderBy: { endsAt: 'asc' } },
      },
    });
    const exp = this.expected(r.expectedMonthlyKwhJson);
    const now = Date.now();
    const rs = r.installation ? await this.db.quoteRequestShop.findFirst({ where: { requestId: r.installation.requestId, shopId: r.installation.shop.id }, select: { id: true } }) : null;
    return {
      id: r.id,
      title: r.title,
      systemPowerKw: r.systemPowerKw,
      systemType: r.systemType,
      installedAt: r.installedAt,
      components: r.componentsJson,
      checklist: r.checklistJson,
      expectedMonthlyKwh: exp,
      shop: r.installation?.shop ?? null,
      installationId: r.installation?.id ?? null,
      quoteId: r.installation?.quoteId ?? null,
      requestShopId: rs?.id ?? null,
      readings: r.readings.map((x) => {
        const e = exp ? exp[x.periodMonth.getUTCMonth()] : null;
        const d = deviation(Number(x.generatedKwh), e);
        return { id: x.id, period: periodOf(x.periodMonth), generatedKwh: Number(x.generatedKwh), meterReading: x.meterReading === null ? null : Number(x.meterReading), expectedKwh: e, deviation: d, alert: d !== null && Math.abs(d) > DEVIATION_ALERT };
      }),
      warranties: r.warranties.map((w) => ({ id: w.id, component: w.component, months: w.months, startsAt: w.startsAt, endsAt: w.endsAt, daysLeft: Math.ceil((w.endsAt.getTime() - now) / DAY), expiringSoon: w.endsAt.getTime() - now <= 60 * DAY })),
      reminders: r.reminders,
    };
  }

  /** Mijoz platformadan tashqari tizimni qo‘shadi; prognoz — viloyat o‘rtacha unumi bo‘yicha (bo‘lsa). */
  async create(userId: string, dto: CreateInstalledSystemDto) {
    const site = dto.siteId ? await this.db.customerSite.findFirst({ where: { id: dto.siteId, userId, archivedAt: null }, select: { id: true, regionCode: true } }) : null;
    if (dto.siteId && !site) throw new NotFoundException(ERRORS.SITE_NOT_FOUND);
    const yieldRow = site?.regionCode ? await this.db.regionalYield.findUnique({ where: { regionCode: site.regionCode } }) : null;
    const perKw = Array.isArray(yieldRow?.monthlyYieldJson) ? (yieldRow!.monthlyYieldJson as number[]) : null;
    const installedAt = new Date(dto.installedAt);
    const id = await this.db.$transaction(async (tx) => {
      const system = await tx.installedSystem.create({
        data: {
          userId, siteId: site?.id ?? null, title: dto.title.trim(), systemPowerKw: dto.systemPowerKw, systemType: dto.systemType, installedAt,
          componentsJson: (dto.components ?? []).map((c) => ({ title: c.title.trim(), quantity: c.quantity ?? 1 })) as Prisma.InputJsonValue,
          expectedMonthlyKwhJson: perKw?.length === 12 ? (perKw.map((v) => Math.round(Number(v) * dto.systemPowerKw)) as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
      for (const w of dto.warranties ?? []) {
        const ends = new Date(installedAt);
        ends.setUTCMonth(ends.getUTCMonth() + w.months);
        await tx.warrantyItem.create({ data: { installedSystemId: system.id, component: w.component.trim(), months: w.months, startsAt: installedAt, endsAt: ends } });
      }
      await createDefaultReminders(tx, system.id, installedAt);
      return system.id;
    });
    return this.get(userId, id);
  }

  async archive(userId: string, id: string) {
    const row = await this.own(userId, id);
    if (row.installationId) throw new DomainException(HttpStatus.CONFLICT, 'INSTALLED_SYSTEM_LINKED', ERRORS.INSTALLED_SYSTEM_LINKED);
    await this.db.installedSystem.update({ where: { id }, data: { archivedAt: new Date() } });
    return { archived: true };
  }

  /**
   * Oylik ko‘rsatkich (TZ 3.6): kWh yoki hisoblagich ko‘rsatkichi. Hisoblagich berilsa va oldingi oy ko‘rsatkichi bo‘lsa — farq kWh sifatida.
   * Kelajak oy va o‘rnatishdan oldingi oy rad etiladi.
   */
  async addReading(userId: string, id: string, dto: ReadingDto) {
    const system = await this.own(userId, id);
    const period = monthStart(dto.period);
    const nowPeriod = monthStart(new Date().toISOString().slice(0, 7));
    if (period > nowPeriod || period < monthStart(periodOf(system.installedAt))) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'READING_PERIOD_INVALID', ERRORS.READING_PERIOD_INVALID);
    let kwh = dto.generatedKwh;
    if (kwh === undefined && dto.meterReading !== undefined) {
      const prev = await this.db.productionReading.findFirst({ where: { installedSystemId: id, periodMonth: { lt: period }, meterReading: { not: null } }, orderBy: { periodMonth: 'desc' } });
      if (!prev?.meterReading) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'READING_PREVIOUS_METER_REQUIRED', ERRORS.READING_PREVIOUS_METER_REQUIRED);
      kwh = dto.meterReading - Number(prev.meterReading);
      if (kwh < 0) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'READING_METER_DECREASED', ERRORS.READING_METER_DECREASED);
    }
    if (kwh === undefined) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'READING_VALUE_REQUIRED', ERRORS.READING_VALUE_REQUIRED);
    await this.db.productionReading.upsert({
      where: { installedSystemId_periodMonth: { installedSystemId: id, periodMonth: period } },
      update: { generatedKwh: kwh, meterReading: dto.meterReading ?? null },
      create: { installedSystemId: id, periodMonth: period, generatedKwh: kwh, meterReading: dto.meterReading ?? null },
    });
    const view = await this.get(userId, id);
    return { reading: view.readings.find((r) => r.period === dto.period)!, system: view };
  }

  /** "Bajarildi" (keyingi muddat), "Keyinga surish (7 kun)", "O‘chirish"/"Yoqish". */
  async reminderAction(userId: string, id: string, reminderId: string, dto: ReminderActionDto) {
    await this.own(userId, id);
    const r = await this.db.maintenanceReminder.findFirst({ where: { id: reminderId, installedSystemId: id } });
    if (!r) throw new NotFoundException(ERRORS.REMINDER_NOT_FOUND);
    const now = new Date();
    const data: Prisma.MaintenanceReminderUpdateInput =
      dto.action === 'DONE'
        ? r.intervalDays ? { lastDoneAt: now, nextAt: nextOccurrence(now, r.intervalDays, now), lastSentAt: null } : { lastDoneAt: now, active: false }
        : dto.action === 'SNOOZE'
          ? { nextAt: new Date(Math.max(now.getTime(), r.nextAt.getTime()) + SNOOZE_DAYS * DAY), lastSentAt: null }
          : dto.action === 'DISABLE'
            ? { active: false }
            : { active: true, ...(r.nextAt < now && r.intervalDays ? { nextAt: nextOccurrence(r.nextAt, r.intervalDays, now) } : {}) };
    return this.db.maintenanceReminder.update({ where: { id: r.id }, data });
  }

  /**
   * Job maintenance-reminder (14.1, kunlik): muddati yetgan eslatmalar — har muddat uchun bir marta
   * (MAINTENANCE_REMINDER / WARRANTY_EXPIRING). Kafolat tugagach eslatma o‘chadi.
   */
  async sendDueReminders(now = new Date()) {
    const due = await this.db.maintenanceReminder.findMany({
      where: { active: true, nextAt: { lte: now }, lastSentAt: null, installedSystem: { archivedAt: null } },
      include: { installedSystem: { select: { id: true, userId: true, title: true } } },
      take: 500,
    });
    let sent = 0;
    for (const r of due) {
      const warranty = r.warrantyItemId ? await this.db.warrantyItem.findUnique({ where: { id: r.warrantyItemId } }) : null;
      await this.db.$transaction(async (tx) => {
        const marked = await tx.maintenanceReminder.updateMany({ where: { id: r.id, lastSentAt: null }, data: { lastSentAt: now, ...(r.type === 'WARRANTY_EXPIRY' && warranty && warranty.endsAt <= now ? { active: false } : {}) } });
        if (!marked.count) return;
        const text =
          r.type === 'CLEANING'
            ? { title: 'Panellarni tozalash vaqti', body: 'Chang ishlab chiqarishni kamaytiradi. Panellarni tozalang va «Bajarildi» deb belgilang.' }
            : r.type === 'INSPECTION'
              ? { title: 'Yillik ko‘rik vaqti', body: 'Ulanishlar, himoya avtomatlari va invertor holatini tekshirtiring.' }
              : { title: 'Kafolat tugayapti', body: `${warranty?.component ?? 'Komponent'} kafolati ${warranty ? warranty.endsAt.toISOString().slice(0, 10) : ''} da tugaydi.` };
        await this.notify.toUser(tx, r.installedSystem.userId, { type: r.type === 'WARRANTY_EXPIRY' ? 'WARRANTY_EXPIRING' : 'MAINTENANCE_REMINDER', ...text, entityType: 'InstalledSystem', entityId: r.installedSystem.id });
        sent += 1;
      });
    }
    return { sent };
  }
}
