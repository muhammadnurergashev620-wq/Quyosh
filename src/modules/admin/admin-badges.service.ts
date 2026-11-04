import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminBadgesQueryDto } from './dto/badges-query.dto';

const after = (since?: string) => (since ? { gt: new Date(since) } : undefined);

/** Admin menyusidagi belgilar: faqat oxirgi kirishdan keyin paydo bo‘lgan yangi ishlar. */
@Injectable()
export class AdminBadgesService {
  constructor(private readonly db: PrismaService) {}

  async get(query: AdminBadgesQueryDto) {
    const [users, pendingModels] = await Promise.all([
      query.usersSince ? this.db.user.count({ where: { createdAt: after(query.usersSince), deletedAt: null } }) : 0,
      // Moderatsiya navbati: «yangi»lik emas, kutilayotganlar soni.
      this.db.productModel.count({ where: { status: 'PENDING' } }),
    ]);
    return { users, pendingModels, now: new Date().toISOString() };
  }
}
