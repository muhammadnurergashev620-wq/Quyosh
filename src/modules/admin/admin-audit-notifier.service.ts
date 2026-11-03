import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { NotificationChannel, Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationService } from '../notification/notification.service';

const POLL_MS = 15_000;
const TEMPLATE = 'admin.audit';
/**
 * Adminni bezovta qilmaydigan doimiy texnik yozuvlar — bular Audit jurnalida to'liq ko'rinadi,
 * lekin har biri uchun bildirishnoma yuborilmaydi (aks holda mijoz/usta kundalik amallari
 * adminlarni bildirishnomalar bilan to'ldirib yuboradi). Faqat admin e'tiborini talab qiladigan
 * hodisalar (nizo, apellyatsiya, kafolat da'vosi, pul qaytarish, hujjat tasdiqlash va h.k.) ochiq qoladi.
 */
const SILENT = new Set([
  'AUTH_REFRESH_ROTATED',
  'AUTH_LOGIN_COMPLETED',
  'AUTH_LOGOUT',
  'AUTH_LOGOUT_ALL',
  'AUTH_SESSION_REVOKED',
  'AUTH_OTHER_SESSIONS_REVOKED',
  'REQUEST_CREATED',
  'REQUEST_UPDATED',
  'REQUEST_SUBMITTED',
  'REQUEST_CANCELLED',
  'OFFER_CREATED',
  'OFFER_WITHDRAWN',
  'OFFER_ACCEPTED',
  'ORDER_CONFIRMED',
  'ORDER_ON_THE_WAY',
  'ORDER_ARRIVED',
  'ORDER_IN_PROGRESS',
  'ORDER_WAITING_CONFIRMATION',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED',
  'ORDER_RESCHEDULE_PROPOSED',
  'ORDER_RESCHEDULE_ACCEPTED',
  'ORDER_RESCHEDULE_DECLINED',
  'MASTER_STATUS_CHANGED',
  'MASTER_PAUSED',
  'MASTER_RESUMED',
  'MASTER_PORTFOLIO_CREATED',
  'MASTER_PORTFOLIO_UPDATED',
  'MASTER_PORTFOLIO_REMOVED',
  'CUSTOMER_PROFILE_UPDATED',
  'CUSTOMER_ADDRESS_CREATED',
  'CUSTOMER_ADDRESS_UPDATED',
  'CUSTOMER_ADDRESS_REMOVED',
  'REVIEW_CREATED',
  'WARRANTY_CREATED',
]);

const TITLES: Record<string, string> = {
  AUTH_REGISTERED: 'Yangi foydalanuvchi ro‘yxatdan o‘tdi',
  AUTH_REGISTRATION_VERIFIED: 'Foydalanuvchi telefonini tasdiqladi',
  VERIFICATION_SUBMITTED: 'Yangi tasdiqlash hujjati yuborildi',
  VERIFICATION_START_REVIEW: 'Hujjat ko‘rib chiqila boshlandi',
  VERIFICATION_APPROVE: 'Hujjat tasdiqlandi',
  VERIFICATION_REJECT: 'Hujjat rad etildi',
  VERIFICATION_REQUEST_CORRECTION: 'Hujjatni tuzatish so‘raldi',
  VERIFICATION_DELETED: 'Hujjat o‘chirildi',
  ADMIN_USER_SUSPENDED: 'Foydalanuvchi to‘xtatildi',
  ADMIN_USER_REACTIVATED: 'Foydalanuvchi qayta faollashtirildi',
  ADMIN_USER_DELETED: 'Foydalanuvchi o‘chirildi',
  USER_ACTION_CREATED: 'Foydalanuvchiga chora qo‘llandi',
  MASTER_PROFILE_CREATED: 'Usta profili yaratildi',
  MASTER_PROFILE_UPDATED: 'Usta profili yangilandi',
  ADMIN_PORTFOLIO_APPROVED: 'Portfolio ishi tasdiqlandi',
  ADMIN_PORTFOLIO_REJECTED: 'Portfolio ishi rad etildi',
  SERVICE_CATEGORY_CREATED: 'Xizmat kategoriyasi yaratildi',
  SERVICE_CREATED: 'Yangi xizmat qo‘shildi',
  SERVICE_UPDATED: 'Xizmat yangilandi',
  SERVICE_DEACTIVATED: 'Xizmat faolsizlantirildi',
  DISPUTE_STATUS_CHANGED: 'Nizo holati o‘zgardi',
  COMPLAINT_STATUS_CHANGED: 'Shikoyat holati o‘zgardi',
  APPEAL_UPDATED: 'Apellyatsiya yangilandi',
  WARRANTY_CLAIM_UPDATED: 'Kafolat da’vosi yangilandi',
  ADMIN_ORDER_CANCELLED: 'Buyurtma administrator tomonidan bekor qilindi',
  ADMIN_ORDER_COMPLETED: 'Nizoli buyurtma administrator tomonidan yakunlandi',
  CHAT_MESSAGE_EDITED: 'Chatdagi xabar tahrirlandi',
  CHAT_MESSAGE_DELETED: 'Chatdagi xabar o‘chirildi',
  PAYMENT_WEBHOOK_MISMATCH: 'To‘lov webhook’i mos kelmadi',
  ORDER_DISPUTED: 'Buyurtma bo‘yicha nizo ochildi',
  PAYMENT_REFUNDED: 'To‘lov qaytarildi',
  WARRANTY_CLAIM_CREATED: 'Yangi kafolat da’vosi yuborildi',
  APPEAL_CREATED: 'Yangi apellyatsiya yuborildi',
};

const humanize = (code: string) => {
  const text = code.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Audit jurnaliga yozilgan har bir muhim amal haqida barcha adminlarga ilova ichida bildirishnoma yuboradi. */
@Injectable()
export class AdminAuditNotifierService {
  private readonly logger = new Logger(AdminAuditNotifierService.name);
  private cursor: Date | null = null;
  private running = false;

  constructor(
    private readonly db: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Interval(POLL_MS)
  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      this.cursor ??= await this.initialCursor();
      const logs = await this.db.auditLog.findMany({
        where: { createdAt: { gt: this.cursor }, action: { notIn: [...SILENT] } },
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: { actor: { select: { firstName: true, lastName: true, accountNumber: true } } },
      });
      if (logs.length === 0) return;

      const admins = await this.db.user.findMany({
        where: { userRoles: { some: { role: Role.ADMIN } }, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      for (const log of logs) {
        const who = log.actor ? [log.actor.firstName, log.actor.lastName].filter(Boolean).join(' ') || `ID ${log.actor.accountNumber}` : 'Tizim';
        const body = `${who}${log.reason ? ` · Sabab: ${log.reason}` : ''}`;
        for (const admin of admins) {
          if (admin.id === log.actorId) continue; // o‘z amali haqida o‘zini bezovta qilmaymiz
          await this.notifications
            .create({
              userId: admin.id,
              channel: NotificationChannel.IN_APP,
              title: TITLES[log.action] ?? humanize(log.action),
              body,
              template: TEMPLATE,
              data: { auditLogId: log.id, action: log.action, path: '/admin/audit' },
            })
            .catch((error: unknown) => this.logger.warn(`Bildirishnoma yaratilmadi (${log.action}): ${(error as Error).message}`));
        }
      }
      this.cursor = logs[logs.length - 1]!.createdAt;
    } catch (error) {
      this.logger.error(`Audit bildirishnomalari: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Qayta ishga tushganda eski yozuvlar uchun bildirishnomalar to‘planib qolmasin: hozirgi paytdan boshlanadi. */
  private async initialCursor(): Promise<Date> {
    const latest = await this.db.auditLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    return latest?.createdAt ?? new Date();
  }
}
