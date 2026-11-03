import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

/** Admin boshqaruv paneli (TZ U12.1). Navbat kartalari modellar qo‘shilgan sari (sharh, shikoyat, murojaat) to‘ldiriladi. */
@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService) {}

  async getDashboard(query: DashboardQueryDto) {
    const range = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
    const createdAt = Object.keys(range).length ? range : undefined;
    const [users, newUsers, shops, shopsPending] = await Promise.all([
      this.db.user.count({ where: { deletedAt: null, status: { not: UserStatus.DELETED } } }),
      this.db.user.count({ where: { deletedAt: null, createdAt } }),
      this.db.shop.count({ where: { archivedAt: null } }),
      this.db.shop.count({ where: { archivedAt: null, status: 'PENDING_REVIEW' } }),
    ]);
    return { users: { total: users, new: newUsers }, shops: { total: shops, pendingReview: shopsPending } };
  }
}
