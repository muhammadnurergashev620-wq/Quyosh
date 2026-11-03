import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { ERRORS } from '../../common/constants/error-messages';
const NodeClam = require('clamscan');

export interface ScanResult {
  clean: boolean;
  detail: string;
}

@Injectable()
export class ScannerService implements OnModuleInit {
  private readonly logger = new Logger(ScannerService.name);
  /** clamscan (CJS, tiplarsiz) — faqat ishlatiladigan metod. */
  private clam: { scanStream(stream: NodeJS.ReadableStream): Promise<{ isInfected: boolean | null; viruses: string[] }> } | null = null;
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.config.get<string>('scanner.host');
    const port = this.config.get<number>('scanner.port');
    const timeoutMs = this.config.get<number>('scanner.timeoutMs');

    if (!host) {
      this.logger.warn(
        'CLAMAV_HOST sozlanmagan — virus tekshiruvi O‘CHIRILGAN. Tekshiruv talab qiladigan fayllar FAILED holatiga o‘tadi. Haqiqiy tekshiruv uchun CLAMAV_HOST ni sozlang.',
      );
      return;
    }

    try {
      this.clam = await new NodeClam().init({
        clamdscan: { host, port, timeout: timeoutMs, socket: false, active: true },
        preference: 'clamdscan',
      });
      this.configured = true;
      this.logger.log(`ClamAV skaneriga ulanildi: ${host}:${port}`);
    } catch (error) {
      this.logger.error(`ClamAV mijozini ishga tushirib bo‘lmadi: ${(error as Error).message}`);
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async scan(buffer: Buffer): Promise<ScanResult> {
    if (!this.configured || !this.clam) {
      throw new Error(ERRORS.SCANNER_NOT_CONFIGURED);
    }

    const { isInfected, viruses } = await this.clam.scanStream(Readable.from(buffer));
    if (isInfected) {
      return { clean: false, detail: `INFECTED:${viruses.join(',')}` };
    }
    return { clean: true, detail: 'CLEAN' };
  }
}
