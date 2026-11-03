import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/** Bosh sayt ishonch raqamlari (TZ 5.6): qo‘lda yozilmaydi, bazadan hisoblanadi. */
@Injectable()
export class PublicService {
  constructor(private readonly db: PrismaService) {}

  async stats() {
    const [verifiedShops, calculations, confirmedInstallations] = await Promise.all([
      this.db.shop.count({ where: { status: 'ACTIVE', verificationStatus: 'VERIFIED', archivedAt: null } }),
      this.db.calculation.count(),
      this.db.installation.count({ where: { status: 'CONFIRMED' } }),
    ]);
    return { verifiedShops, calculations, confirmedInstallations };
  }
}
