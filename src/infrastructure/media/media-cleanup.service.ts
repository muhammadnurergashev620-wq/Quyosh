import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';

const SWEEP_INTERVAL_MS = 60_000;
const STALLED_AFTER_MS = 30 * 60_000;
const REJECTED_RETENTION_MS = 24 * 60 * 60_000;

@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);
  private running = false;

  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Interval(SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.failStalledUploads();
      await this.purgeQuarantineForTerminalAssets();
      await this.purgeOldRejected();
    } catch (error) {
      this.logger.error(`Fayllarni tozalash bajarilmadi: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async failStalledUploads(): Promise<void> {
    const cutoff = new Date(Date.now() - STALLED_AFTER_MS);
    const stalled = await this.db.mediaAsset.findMany({
      where: { status: { in: ['UPLOADING', 'SCANNING', 'PROCESSING'] }, updatedAt: { lt: cutoff } },
      select: { id: true, quarantineKey: true },
    });
    for (const asset of stalled) {
      const claimed = await this.db.mediaAsset.updateMany({
        where: { id: asset.id, status: { in: ['UPLOADING', 'SCANNING', 'PROCESSING'] } },
        data: { status: 'FAILED', lastError: 'Stalled: exceeded processing time budget' },
      });
      if (claimed.count > 0 && asset.quarantineKey) {
        await this.deleteQuietly(asset.quarantineKey);
      }
    }
    if (stalled.length > 0) this.logger.warn(`${stalled.length} ta qotib qolgan fayl FAILED deb belgilandi`);
  }

  private async purgeQuarantineForTerminalAssets(): Promise<void> {
    const orphaned = await this.db.mediaAsset.findMany({
      where: { status: { in: ['REJECTED', 'FAILED'] }, quarantineKey: { not: null }, cleanedUpAt: null },
      select: { id: true, quarantineKey: true },
      take: 100,
    });
    for (const asset of orphaned) {
      if (asset.quarantineKey) await this.deleteQuietly(asset.quarantineKey);
      await this.db.mediaAsset.update({ where: { id: asset.id }, data: { cleanedUpAt: new Date() } });
    }
  }

  private async purgeOldRejected(): Promise<void> {
    const cutoff = new Date(Date.now() - REJECTED_RETENTION_MS);
    const count = await this.db.mediaAsset.count({
      where: { status: 'REJECTED', cleanedUpAt: { lt: cutoff } },
    });
    if (count > 0) this.logger.log(`Saqlash muddati o‘tgan ${count} ta rad etilgan fayl (obyektlar allaqachon o‘chirilgan)`);
  }

  private async deleteQuietly(key: string): Promise<void> {
    try {
      await this.storage.deleteObject(key);
    } catch (error) {
      this.logger.warn(`${key} obyektini o‘chirib bo‘lmadi: ${(error as Error).message}`);
    }
  }
}
