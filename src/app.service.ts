import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './infrastructure/database/prisma.service';
import { RedisService } from './infrastructure/redis/redis.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly redis: RedisService,
  ) {}

  getStatus() {
    return { service: 'quyosh-api', status: 'ok' };
  }

  async getReadiness() {
    const check = async (name: string, probe: () => Promise<unknown>) => {
      try {
        await probe();
        return 'up' as const;
      } catch (error) { `QA`
        this.logger.warn(`${name} tayyorlik tekshiruvidan o‘tmadi: ${(error as Error).message}`);
        return 'down' as const;
      }
    };
    const [database, redis] = await Promise.all([
      check('database', () => this.db.$queryRaw`SELECT 1`),
      check('redis', () => this.redis.ping()),
    ]);
    return { status: database === 'up' && redis === 'up' ? 'ready' : 'degraded', database, redis };
  }
}
