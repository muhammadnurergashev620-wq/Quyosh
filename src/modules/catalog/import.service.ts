import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Currency, Prisma, StockStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import { tashkentDate } from '../../common/utils/tashkent-date';
import { csvEscape, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, parseCsv, parseXlsx, RawRow, toRawRows } from './import-parse';

const invalid = (code: string, message: string) => new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
const MONEY = /^\d{1,16}([.,]\d{1,2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STOCK: Record<string, StockStatus> = { in_stock: 'IN_STOCK', bor: 'IN_STOCK', on_order: 'ON_ORDER', buyurtma: 'ON_ORDER', out_of_stock: 'OUT_OF_STOCK', yoq: 'OUT_OF_STOCK', 'yo‘q': 'OUT_OF_STOCK' };

export interface ImportError { row: number; column: string; reason: string }
export interface ValidRow {
  row: number;
  productModelId: string;
  label: string;
  branchId: string | null;
  price: string;
  currency: Currency;
  vatIncluded: boolean;
  stockStatus: StockStatus;
  quantity: number | null;
  validFrom: string;
  validUntil: string | null;
  description: string | null;
}

/** Ommaviy import (U11.7): yuklash → tekshirish (qator/ustun/sabab) → faqat to‘g‘ri qatorlarni bitta tranzaksiyada qo‘llash. */
@Injectable()
export class ImportService {
  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async upload(shopId: string, actorId: string, file: { buffer: Buffer; originalname: string; size: number }) {
    if (file.size > IMPORT_MAX_BYTES) throw invalid('FILE_TOO_LARGE', 'Fayl hajmi 5 MB dan oshmasligi kerak');
    const isXlsx = /\.xlsx$/i.test(file.originalname) || file.buffer.subarray(0, 2).toString() === 'PK';
    let table: string[][];
    try {
      table = isXlsx ? await parseXlsx(file.buffer) : parseCsv(file.buffer.toString('utf8'));
    } catch {
      throw invalid('IMPORT_FILE_INVALID', ERRORS.IMPORT_FILE_INVALID);
    }
    const { rows, missing } = toRawRows(table);
    if (missing.length) throw invalid('IMPORT_FILE_INVALID', `${ERRORS.IMPORT_FILE_INVALID} (yo‘q ustunlar: ${missing.join(', ')})`);
    if (rows.length === 0) throw invalid('IMPORT_FILE_INVALID', ERRORS.IMPORT_FILE_INVALID);
    if (rows.length > IMPORT_MAX_ROWS) throw invalid('IMPORT_TOO_MANY_ROWS', ERRORS.IMPORT_TOO_MANY_ROWS);

    const { valid, errors } = await this.validate(shopId, rows);
    const job = await this.db.importJob.create({
      data: {
        shopId,
        createdById: actorId,
        fileName: file.originalname.slice(0, 255),
        status: valid.length ? 'VALIDATED' : 'FAILED',
        rowCount: rows.length,
        errorCount: errors.length ? new Set(errors.map((error) => error.row)).size : 0,
        rowsJson: valid as unknown as Prisma.InputJsonValue,
        errorsJson: errors as unknown as Prisma.InputJsonValue,
      },
    });
    await this.db.auditLog.create({ data: { actorId, action: 'IMPORT_VALIDATED', targetType: 'Shop', targetId: shopId, after: { importId: job.id, rows: rows.length, valid: valid.length, errors: job.errorCount } } });
    return this.summary(job);
  }

  /** Har qator: model (brend+model APPROVED), narx ≥ 0, valyuta, zaxira, sanalar, filial nomi. */
  async validate(shopId: string, rows: RawRow[]) {
    const [models, branches] = await Promise.all([
      this.db.productModel.findMany({ where: { status: 'APPROVED' }, select: { id: true, brand: true, model: true } }),
      this.db.shopBranch.findMany({ where: { shopId, archivedAt: null }, select: { id: true, name: true } }),
    ]);
    const modelKey = (brand: string, model: string) => `${brand.trim().toLowerCase()}|${model.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    const modelByKey = new Map(models.map((item) => [modelKey(item.brand, item.model), item]));
    const branchByName = new Map(branches.map((item) => [item.name.trim().toLowerCase(), item.id]));
    const today = tashkentDate();
    const valid: ValidRow[] = [];
    const errors: ImportError[] = [];
    const seen = new Map<string, number>();

    for (const raw of rows) {
      const rowErrors: ImportError[] = [];
      const fail = (column: string, reason: string) => rowErrors.push({ row: raw.row, column, reason });
      const brand = raw.brand ?? '';
      const modelName = raw.model ?? '';
      if (!brand) fail('brand', 'Brend kiritilmagan');
      if (!modelName) fail('model', 'Model kiritilmagan');
      const model = brand && modelName ? modelByKey.get(modelKey(brand, modelName)) : undefined;
      if (brand && modelName && !model) fail('model', 'Katalogda tasdiqlangan bunday model yo‘q — avval «Yangi model taklif qilish»');

      const priceRaw = (raw.price ?? '').replace(/\s/g, '');
      if (!MONEY.test(priceRaw)) fail('price', 'Narx manfiy bo‘lmagan son bo‘lishi kerak (masalan 1450000 yoki 1250.50)');
      const currencyRaw = (raw.currency || 'UZS').toUpperCase();
      if (currencyRaw !== 'UZS' && currencyRaw !== 'USD') fail('currency', 'Valyuta UZS yoki USD bo‘lishi kerak');
      const vatRaw = (raw.vat_included || 'true').toLowerCase();
      if (!['true', 'false', 'ha', "yo'q", 'yo‘q', '1', '0'].includes(vatRaw)) fail('vat_included', 'true yoki false bo‘lishi kerak');
      const stockRaw = (raw.stock_status || 'IN_STOCK').toLowerCase();
      const stockStatus = STOCK[stockRaw];
      if (!stockStatus) fail('stock_status', 'IN_STOCK, ON_ORDER yoki OUT_OF_STOCK');
      let quantity: number | null = null;
      if (raw.quantity) {
        quantity = Number(raw.quantity);
        if (!Number.isInteger(quantity) || quantity < 0) fail('quantity', 'Miqdor butun, manfiy bo‘lmagan son');
      }
      let branchId: string | null = null;
      if (raw.branch) {
        branchId = branchByName.get(raw.branch.toLowerCase()) ?? null;
        if (!branchId) fail('branch', `«${raw.branch}» nomli filial topilmadi`);
      }
      const validFrom = raw.valid_from || today;
      const validUntil = raw.valid_until || null;
      if (!DATE.test(validFrom) || Number.isNaN(Date.parse(validFrom))) fail('valid_from', 'Sana formati YYYY-MM-DD');
      if (validUntil && (!DATE.test(validUntil) || Number.isNaN(Date.parse(validUntil)))) fail('valid_until', 'Sana formati YYYY-MM-DD');
      else if (validUntil && validUntil < validFrom) fail('valid_until', 'Tugash sanasi boshlanishidan oldin');
      if ((raw.description ?? '').length > 10000) fail('description', 'Tavsif 10 000 belgidan oshmasin');
      if (model) {
        const key = `${model.id}|${branchId ?? ''}`;
        const previous = seen.get(key);
        if (previous) fail('model', `Takroriy qator (${previous}-qator bilan bir xil model va filial)`);
        else seen.set(key, raw.row);
      }

      if (rowErrors.length || !model || !stockStatus) {
        errors.push(...rowErrors);
        continue;
      }
      valid.push({
        row: raw.row,
        productModelId: model.id,
        label: `${model.brand} ${model.model}`,
        branchId,
        price: priceRaw.replace(',', '.'),
        currency: currencyRaw as Currency,
        vatIncluded: ['true', 'ha', '1'].includes(vatRaw),
        stockStatus,
        quantity,
        validFrom,
        validUntil,
        description: raw.description || null,
      });
    }
    return { valid, errors };
  }

  private summary(job: { id: string; status: string; fileName: string; rowCount: number; errorCount: number; appliedAt: Date | null; createdAt: Date; errorsJson: Prisma.JsonValue; rowsJson: Prisma.JsonValue }) {
    const errors = (job.errorsJson as unknown as ImportError[] | null) ?? [];
    const rows = (job.rowsJson as unknown as ValidRow[] | null) ?? [];
    return {
      id: job.id,
      status: job.status,
      fileName: job.fileName,
      rowCount: job.rowCount,
      validCount: rows.length,
      errorCount: job.errorCount,
      errors: errors.slice(0, 500),
      preview: rows.slice(0, 20).map(({ row, label, price, currency, stockStatus, branchId }) => ({ row, label, price, currency, stockStatus, branchId })),
      appliedAt: job.appliedAt,
      createdAt: job.createdAt,
    };
  }

  private async jobOrThrow(shopId: string, id: string) {
    const job = await this.db.importJob.findFirst({ where: { id, shopId } });
    if (!job) throw new NotFoundException(ERRORS.IMPORT_NOT_FOUND);
    return job;
  }

  async get(shopId: string, id: string) {
    return this.summary(await this.jobOrThrow(shopId, id));
  }

  async list(shopId: string) {
    return this.db.importJob.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, fileName: true, status: true, rowCount: true, errorCount: true, appliedAt: true, createdAt: true } });
  }

  async errorsCsv(shopId: string, id: string) {
    const job = await this.jobOrThrow(shopId, id);
    const errors = (job.errorsJson as unknown as ImportError[] | null) ?? [];
    return `﻿qator,ustun,sabab\n${errors.map((error) => [error.row, error.column, error.reason].map(csvEscape).join(',')).join('\n')}\n`;
  }

  /** Qo‘llash: bitta tranzaksiya; mahsulot yo‘q bo‘lsa yaratiladi (ACTIVE), filial bo‘yicha narx yangilanadi yoki qo‘shiladi. */
  async apply(shopId: string, actorId: string, id: string) {
    const job = await this.jobOrThrow(shopId, id);
    if (job.status !== 'VALIDATED') throw new DomainException(HttpStatus.CONFLICT, 'IMPORT_NOT_VALIDATED', ERRORS.IMPORT_NOT_VALIDATED);
    const rows = (job.rowsJson as unknown as ValidRow[] | null) ?? [];
    // Tekshiruvdan keyin model yoki filial o‘zgargan bo‘lishi mumkin — qayta tasdiqlaymiz.
    const [approved, branches] = await Promise.all([
      this.db.productModel.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.productModelId))] }, status: 'APPROVED' }, select: { id: true } }),
      this.db.shopBranch.findMany({ where: { shopId, archivedAt: null }, select: { id: true } }),
    ]);
    const approvedIds = new Set(approved.map((row) => row.id));
    const branchIds = new Set(branches.map((row) => row.id));
    const applicable = rows.filter((row) => approvedIds.has(row.productModelId) && (!row.branchId || branchIds.has(row.branchId)));

    const result = await this.db.$transaction(
      async (tx) => {
        const claimed = await tx.importJob.updateMany({ where: { id, status: 'VALIDATED' }, data: { status: 'APPLIED', appliedAt: new Date() } });
        if (claimed.count === 0) throw new DomainException(HttpStatus.CONFLICT, 'IMPORT_NOT_VALIDATED', ERRORS.IMPORT_NOT_VALIDATED);
        let created = 0;
        let updated = 0;
        for (const row of applicable) {
          const product = await tx.shopProduct.upsert({
            where: { shopId_productModelId: { shopId, productModelId: row.productModelId } },
            update: { status: 'ACTIVE', ...(row.description ? { description: row.description } : {}), version: { increment: 1 } },
            create: { shopId, productModelId: row.productModelId, status: 'ACTIVE', description: row.description },
          });
          const data = { price: row.price, currency: row.currency, vatIncluded: row.vatIncluded, stockStatus: row.stockStatus, quantity: row.quantity, validFrom: new Date(row.validFrom), validUntil: row.validUntil ? new Date(row.validUntil) : null };
          const existing = await tx.productOffer.findFirst({ where: { shopProductId: product.id, branchId: row.branchId }, select: { id: true } });
          if (existing) {
            await tx.productOffer.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } });
            updated += 1;
          } else {
            await tx.productOffer.create({ data: { ...data, shopProductId: product.id, branchId: row.branchId } });
            created += 1;
          }
        }
        await tx.auditLog.create({ data: { actorId, action: 'IMPORT_APPLIED', targetType: 'Shop', targetId: shopId, after: { importId: id, applied: applicable.length, skipped: rows.length - applicable.length, created, updated } } });
        await this.outbox.emit(tx, {
          eventName: 'import.applied',
          aggregateType: 'ImportJob',
          aggregateId: id,
          payload: { userId: actorId, title: 'Import yakunlandi', body: `${applicable.length} ta qator qo‘llandi (${created} yangi narx, ${updated} yangilandi).` },
          createdById: actorId,
        });
        return { created, updated };
      },
      { timeout: 60_000 },
    );
    return { id, status: 'APPLIED', applied: applicable.length, skipped: rows.length - applicable.length, ...result };
  }
}
