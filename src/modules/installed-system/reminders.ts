import type { Prisma } from '@prisma/client';

const DAY = 86_400_000;
/** TZ 3.6: panel tozalash har 90 kun, yillik ko‘rik, kafolat tugashiga 60 kun qolganda. */
export const CLEANING_DAYS = 90;
export const INSPECTION_DAYS = 365;
export const WARRANTY_NOTICE_DAYS = 60;
export const SNOOZE_DAYS = 7;

/** Keyingi muddat: boshlanish sanasidan interval qadamlari bilan, bugundan keyingi birinchi sana. */
export function nextOccurrence(from: Date, intervalDays: number, now = new Date()): Date {
  let at = new Date(from.getTime() + intervalDays * DAY);
  while (at.getTime() <= now.getTime()) at = new Date(at.getTime() + intervalDays * DAY);
  return at;
}

/** Yangi o‘rnatilgan tizim uchun standart eslatmalar (tozalash, ko‘rik, har kafolat tugashi). */
export async function createDefaultReminders(tx: Prisma.TransactionClient, systemId: string, installedAt: Date, now = new Date()) {
  const warranties = await tx.warrantyItem.findMany({ where: { installedSystemId: systemId } });
  const data: Prisma.MaintenanceReminderCreateManyInput[] = [
    { installedSystemId: systemId, type: 'CLEANING', intervalDays: CLEANING_DAYS, nextAt: nextOccurrence(installedAt, CLEANING_DAYS, now) },
    { installedSystemId: systemId, type: 'INSPECTION', intervalDays: INSPECTION_DAYS, nextAt: nextOccurrence(installedAt, INSPECTION_DAYS, now) },
    ...warranties
      .filter((w) => w.endsAt.getTime() > now.getTime())
      .map((w) => ({ installedSystemId: systemId, type: 'WARRANTY_EXPIRY' as const, warrantyItemId: w.id, nextAt: new Date(Math.max(now.getTime(), w.endsAt.getTime() - WARRANTY_NOTICE_DAYS * DAY)) })),
  ];
  await tx.maintenanceReminder.createMany({ data });
}

/** Prognozdan farq (ulush): (haqiqiy − prognoz) / prognoz; prognoz yo‘q bo‘lsa null. 20 % dan ko‘p — ogohlantirish. */
export function deviation(actual: number, expected: number | null | undefined): number | null {
  if (!expected || expected <= 0) return null;
  return Math.round(((actual - expected) / expected) * 1000) / 1000;
}
export const DEVIATION_ALERT = 0.2;
