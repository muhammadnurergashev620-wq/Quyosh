import { Injectable, NotFoundException, HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import type { SaveQuoteTemplateDto } from './dto/quote.dto';

const MAX_TEMPLATES = 30;

/** Do‘kon taklif shablonlari: tez-tez yuboriladigan to‘plamlarni bir bosishda builderga yuklash. */
@Injectable()
export class QuoteTemplateService {
  constructor(private readonly db: PrismaService) {}

  async list(ctx: ShopContext) {
    const rows = await this.db.quoteTemplate.findMany({ where: { shopId: ctx.shopId }, orderBy: { updatedAt: 'desc' } });
    return rows.map(toView);
  }

  async create(ctx: ShopContext, dto: SaveQuoteTemplateDto) {
    const count = await this.db.quoteTemplate.count({ where: { shopId: ctx.shopId } });
    if (count >= MAX_TEMPLATES) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'QUOTE_TEMPLATE_LIMIT', ERRORS.QUOTE_TEMPLATE_LIMIT);
    const row = await this.db.quoteTemplate.create({ data: { shopId: ctx.shopId, ...payload(dto) } });
    return toView(row);
  }

  async update(ctx: ShopContext, id: string, dto: SaveQuoteTemplateDto) {
    await this.own(ctx, id);
    return toView(await this.db.quoteTemplate.update({ where: { id }, data: payload(dto) }));
  }

  async remove(ctx: ShopContext, id: string) {
    await this.own(ctx, id);
    await this.db.quoteTemplate.delete({ where: { id } });
    return { id };
  }

  private async own(ctx: ShopContext, id: string) {
    const row = await this.db.quoteTemplate.findFirst({ where: { id, shopId: ctx.shopId }, select: { id: true } });
    if (!row) throw new NotFoundException(ERRORS.QUOTE_TEMPLATE_NOT_FOUND);
  }
}

function payload(dto: SaveQuoteTemplateDto) {
  return {
    name: dto.name.trim(),
    itemsJson: dto.items as unknown as Prisma.InputJsonValue,
    defaultsJson: (dto.defaults ?? {}) as unknown as Prisma.InputJsonValue,
  };
}

function toView(row: { id: string; name: string; itemsJson: Prisma.JsonValue; defaultsJson: Prisma.JsonValue; createdAt: Date; updatedAt: Date }) {
  return { id: row.id, name: row.name, items: row.itemsJson, defaults: row.defaultsJson, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
