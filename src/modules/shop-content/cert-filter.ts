import type { Prisma } from '@prisma/client';
import { tashkentDate } from '../../common/utils/tashkent-date';

/** Ommaviy ko‘rinadigan sertifikat: APPROVED va muddati o‘tmagan (TZ 4.11, 17.2). */
export function activeCertWhere(): Prisma.ShopCertificationWhereInput {
  return { status: 'APPROVED', OR: [{ validUntil: null }, { validUntil: { gte: new Date(`${tashkentDate()}T00:00:00Z`) } }] };
}
