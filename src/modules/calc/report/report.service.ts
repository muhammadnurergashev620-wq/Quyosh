import { Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import type Redis from 'ioredis';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { BULLMQ_CONNECTION } from '../../../infrastructure/queue/queue.constants';
import { REGIONS } from '../../../common/constants/regions';
import { CalculationsService } from '../calculations.service';
import { buildReportPdf } from './report-pdf';
import { toUzbekCyrillic } from '../../../common/utils/translit';
import type { EngineResult } from '../../calc-engine';

export const REPORTS_QUEUE = 'calc-reports';
const SIGNED_URL_SECONDS = 600;

/** TZ 9.9 / 12: PDF hisobot — job ID, fon worker, S3, 10 daqiqalik imzolangan havola, tayyor bo‘lsa bildirishnoma. */
@Injectable()
export class ReportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportService.name);
  private queue!: Queue<{ jobId: string }>;
  private worker!: Worker<{ jobId: string }>;

  constructor(
    @Inject(BULLMQ_CONNECTION) private readonly connection: Redis,
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    private readonly outbox: OutboxService,
    private readonly calculations: CalculationsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.queue = new Queue(REPORTS_QUEUE, { connection: this.connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: { age: 3600 }, removeOnFail: { age: 86_400 } } });
    this.worker = new Worker(REPORTS_QUEUE, (job) => this.process(job), { connection: this.connection, concurrency: 2 });
    this.worker.on('failed', (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) void this.db.reportJob.update({ where: { id: job.data.jobId }, data: { status: 'FAILED', error: error.message.slice(0, 1000), finishedAt: new Date() } }).catch(() => undefined);
    });
    this.worker.on('error', (error) => this.logger.error(`PDF worker: ${error.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async create(userId: string, calculationId: string, lang: string, qrMode: 'SHARE' | 'CABINET' | 'NONE') {
    await this.calculations.get(userId, calculationId); // egalik tekshiruvi
    const job = await this.db.reportJob.create({ data: { userId, calculationId, lang, qrMode } });
    await this.queue.add('render', { jobId: job.id }, { jobId: job.id });
    return { id: job.id, status: job.status };
  }

  async status(userId: string, id: string) {
    const job = await this.db.reportJob.findFirst({ where: { id, userId } });
    if (!job) throw new NotFoundException('Hisobot topilmadi');
    return { id: job.id, status: job.status, error: job.status === 'FAILED' ? job.error : null, createdAt: job.createdAt, finishedAt: job.finishedAt };
  }

  async download(userId: string, id: string) {
    const job = await this.db.reportJob.findFirst({ where: { id, userId, status: 'READY' } });
    if (!job?.objectKey) throw new NotFoundException('Hisobot hali tayyor emas');
    const url = await this.storage.getSignedGetUrl(job.objectKey, SIGNED_URL_SECONDS, { contentType: 'application/pdf', downloadFilename: `quyosh-hisob-${job.calculationId.slice(0, 8)}.pdf` });
    return { url, expiresIn: SIGNED_URL_SECONDS };
  }

  private customerBase() {
    return (process.env.SHARE_BASE_URL || process.env.VITE_DEV_CUSTOMER_URL || 'http://localhost:5173').replace(/\/$/, '');
  }

  private async process(job: Job<{ jobId: string }>) {
    const row = await this.db.reportJob.update({ where: { id: job.data.jobId }, data: { status: 'RUNNING' } });
    const calc = await this.calculations.get(row.userId, row.calculationId);
    let qrUrl: string | null = null;
    const qrMode = row.qrMode as 'SHARE' | 'CABINET' | 'NONE';
    if (qrMode === 'SHARE') {
      // Mavjud faol havola tokeni saqlanmaydi (faqat xeshi) — PDF uchun yangi 30 kunlik havola yaratiladi.
      const share = await this.calculations.share(row.userId, row.calculationId, 30);
      qrUrl = `${this.customerBase()}/mijoz/ulashish/${share.token}`;
    } else if (qrMode === 'CABINET') qrUrl = `${this.customerBase()}/mijoz/natija/${row.calculationId}`;
    const result = calc.result as unknown as EngineResult & { meta: { regionCode: string } };
    const latin = REGIONS.find((region) => region.key === result.meta.regionCode)?.name ?? result.meta.regionCode;
    const regionName = row.lang === 'oz' ? toUzbekCyrillic(latin) : latin;
    const pdf = await buildReportPdf(result as never, { lang: row.lang, qrUrl, qrMode, regionName, title: calc.title });
    const objectKey = `reports/${row.userId}/${row.id}.pdf`;
    await this.storage.putObject(objectKey, pdf, 'application/pdf');
    await this.db.$transaction(async (tx) => {
      await tx.reportJob.update({ where: { id: row.id }, data: { status: 'READY', objectKey, finishedAt: new Date() } });
      await this.outbox.emit(tx, { eventName: 'report.ready', aggregateType: 'ReportJob', aggregateId: row.id, payload: { userId: row.userId, title: 'PDF hisobot tayyor', body: 'Hisobingiz PDF ko‘rinishida tayyor — yuklab olishingiz mumkin.' }, createdById: row.userId });
    });
    this.logger.log(`PDF tayyor: ${row.id} (${Math.round(pdf.length / 1024)} KB)`);
  }
}
