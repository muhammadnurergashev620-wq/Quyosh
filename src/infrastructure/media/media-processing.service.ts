import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ScannerService } from '../scanner/scanner.service';
import { ImageProcessorService } from './image-processor.service';

@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    private readonly scanner: ScannerService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  async process(assetId: string): Promise<void> {
    const asset = await this.db.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) {
      this.logger.warn(`${assetId} fayli endi mavjud emas, o‘tkazib yuborildi`);
      return;
    }
    if (asset.status === 'READY' || asset.status === 'REJECTED') {
      return;
    }
    if (!asset.quarantineKey) {
      await this.db.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'FAILED', lastError: 'Missing quarantine key' },
      });
      return;
    }

    await this.db.mediaAsset.update({ where: { id: assetId }, data: { status: 'SCANNING' } });
    const buffer = await this.storage.getObject(asset.quarantineKey);

    const scanResult = this.scanner.isConfigured()
      ? await this.scanner.scan(buffer)
      : { clean: true, detail: 'SKIPPED: scanner not configured' };

    if (!scanResult.clean) {
      await this.db.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'REJECTED', rejectionReason: 'Malware detected', scanResult: scanResult.detail },
      });
      await this.storage.deleteObject(asset.quarantineKey);
      return;
    }

    await this.db.mediaAsset.update({
      where: { id: assetId },
      data: { status: 'PROCESSING', scanResult: scanResult.detail },
    });

    const isImage = (asset.detectedMimeType ?? '').startsWith('image/');
    const originalKey = `media/${assetId}/original`;
    let thumbnailKey: string | undefined;
    let mediumKey: string | undefined;

    if (isImage) {
      let processed;
      try {
        processed = await this.imageProcessor.process(buffer);
      } catch (error) {
        await this.db.mediaAsset.update({
          where: { id: assetId },
          data: { status: 'REJECTED', rejectionReason: `Corrupt or unsupported image: ${(error as Error).message}` },
        });
        await this.storage.deleteObject(asset.quarantineKey);
        return;
      }

      thumbnailKey = `media/${assetId}/thumbnail`;
      mediumKey = `media/${assetId}/medium`;
      // Asl fayl foydalanuvchi yuklagan holda (format, sifat, baytlar) o‘zgarishsiz saqlanadi.
      await this.storage.putObject(originalKey, buffer, asset.detectedMimeType ?? asset.declaredMimeType);
      await this.storage.putObject(thumbnailKey, processed.thumbnail, processed.contentType);
      await this.storage.putObject(mediumKey, processed.medium, processed.contentType);
    } else {
      await this.storage.putObject(originalKey, buffer, asset.detectedMimeType ?? asset.declaredMimeType);
    }

    await this.db.mediaAsset.update({
      where: { id: assetId },
      data: { status: 'READY', originalKey, thumbnailKey, mediumKey },
    });
    await this.storage.deleteObject(asset.quarantineKey);
  }

  async markPermanentlyFailed(assetId: string, error: string, attempts: number): Promise<void> {
    const result = await this.db.mediaAsset.updateMany({
      where: { id: assetId, status: { in: ['UPLOADING', 'QUARANTINED', 'SCANNING', 'PROCESSING'] } },
      data: { status: 'FAILED', lastError: error, attempts },
    });
    if (result.count > 0) this.logger.error(`${assetId} fayli ${attempts} ta urinishdan keyin FAILED deb belgilandi: ${error}`);
  }
}
