import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../constants/error-messages';

/** Buyurtma/so‘rov yaratishdan oldin: telefon raqami kiritilgan va tasdiqlangan bo‘lishi shart (Google orqali telefonsiz ochilgan akkauntlar uchun). */
export async function assertPhoneVerified(db: PrismaService, userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
  if (!user?.phone || !user.phoneVerifiedAt) throw new ForbiddenException(ERRORS.PHONE_VERIFICATION_REQUIRED);
}
