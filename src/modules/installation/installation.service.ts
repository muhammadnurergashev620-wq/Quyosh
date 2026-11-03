import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Installation, type InstallationStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import type { Panel } from '../../common/utils/panel';
import { M6Notifier } from '../quote-request/m6-notifier.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { QuoteRequestService } from '../quote-request/quote-request.service';
import { assertInstallationTransition, type InstallationActor } from './installation-state-machine';
import { createDefaultReminders } from '../installed-system/reminders';
import { evaluateChecklist, type ChecklistResultItem, type ChecklistTemplateItem } from './checklist';
import type { ConfirmInstallationDto, DisputeDto, InstallationsQueryDto, ResolveDisputeDto, SaveChecklistDto, UpdateInstallationDto } from './dto/installation.dto';
import { numArrayAt, numAt } from '../../common/utils/json-path';

type Tx = Prisma.TransactionClient;
type Side = 'CUSTOMER' | 'SHOP';

const STATUS_TEXT: Record<InstallationStatus, string> = {
  AGREED: 'Kelishildi',
  SITE_VISIT_SCHEDULED: 'O‘lchov belgilandi',
  INSTALLATION_SCHEDULED: 'Montaj sanasi belgilandi',
  INSTALLED: 'Montaj bajarildi — tekshirib, qabul qiling',
  CONFIRMED: 'Montaj qabul qilindi',
  DISPUTED: 'E’tiroz bildirildi',
  CANCELLED: 'Montaj bekor qilindi',
};

/** Eslatma kunlari (14.1 installation-reminder): INSTALLED dan 3, 7, 14-kun. */
const REMINDER_DAYS = [3, 7, 14];

const LIST_SELECT = {
  id: true, status: true, scheduledDate: true, installedAt: true, confirmedAt: true, createdAt: true, updatedAt: true, requestId: true,
  shop: { select: { id: true, name: true, slug: true, logoAssetId: true } },
  quote: { select: { id: true, total: true, systemPowerKw: true, systemType: true, request: { select: { number: true, title: true } } } },
} satisfies Prisma.InstallationSelect;

/** Montaj va qabul chek-listi (TZ 13.1, 13.7, U9.8–U9.9, U11.5). */
@Injectable()
export class InstallationService {
  constructor(
    private readonly db: PrismaService,
    private readonly requests: QuoteRequestService,
    private readonly notify: M6Notifier,
    private readonly analytics: AnalyticsService,
  ) {}

  private async load(id: string) {
    const row = await this.db.installation.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(ERRORS.INSTALLATION_NOT_FOUND);
    return row;
  }

  /** Tomonni aniqlash: montaj mijozi yoki do‘kon a’zosi (installations.write — yozish uchun). */
  private async access(userId: string, id: string, panel: Panel | null, write: boolean) {
    const inst = await this.load(id);
    const isCustomer = inst.userId === userId;
    const member = await this.db.shopMember.findUnique({ where: { shopId_userId: { shopId: inst.shopId, userId } }, select: { memberRole: true, permissions: true, shop: { select: { status: true } } } });
    if (member && (panel === 'SHOP' || !isCustomer)) {
      const perm = write ? 'installations.write' : 'requests.read';
      if (member.memberRole !== 'OWNER' && !member.permissions.includes(perm) && !member.permissions.includes('installations.write')) throw new ForbiddenException(ERRORS.SHOP_PERMISSION_REQUIRED);
      if (write && member.shop.status === 'SUSPENDED') throw new DomainException(HttpStatus.LOCKED, 'SHOP_SUSPENDED', ERRORS.SHOP_SUSPENDED);
      return { inst, side: 'SHOP' as Side };
    }
    if (isCustomer) return { inst, side: 'CUSTOMER' as Side };
    throw new NotFoundException(ERRORS.INSTALLATION_NOT_FOUND);
  }

  private async requestShopId(tx: Tx, inst: Pick<Installation, 'requestId' | 'shopId'>) {
    const rs = await tx.quoteRequestShop.findUniqueOrThrow({ where: { requestId_shopId: { requestId: inst.requestId, shopId: inst.shopId } }, select: { id: true, assignedMemberId: true } });
    return rs;
  }

  /** Holat o‘tishi + tarix + chat tizim xabari + mijozga INSTALLATION_STATUS_CHANGED. */
  private async transition(tx: Tx, inst: Installation, to: InstallationStatus, actor: InstallationActor, actorId: string | null, extra: Prisma.InstallationUpdateInput = {}, note?: string) {
    assertInstallationTransition(inst.status, to, actor);
    const history = [...((inst.historyJson as unknown[]) ?? []), { status: to, at: new Date().toISOString(), side: actor, byUserId: actorId, ...(note ? { note } : {}) }];
    const updated = await tx.installation.updateMany({ where: { id: inst.id, status: inst.status, version: inst.version }, data: { status: to, historyJson: history as Prisma.InputJsonValue, version: { increment: 1 } } });
    if (!updated.count) throw new DomainException(HttpStatus.CONFLICT, 'VERSION_CONFLICT', ERRORS.VERSION_CONFLICT);
    if (Object.keys(extra).length) await tx.installation.update({ where: { id: inst.id }, data: extra });
    const rs = await this.requestShopId(tx, inst);
    await this.requests.systemMessage(tx, rs.id, 'INSTALLATION', `${STATUS_TEXT[to]}${note ? `: ${note}` : ''}`);
    if (actor !== 'CUSTOMER') {
      await this.notify.toUser(tx, inst.userId, { type: 'INSTALLATION_STATUS_CHANGED', title: 'Montaj holati o‘zgardi', body: STATUS_TEXT[to], entityType: 'Installation', entityId: inst.id, newStatus: to }, actorId ?? undefined);
    }
    if (actor !== 'SHOP') {
      await this.notify.toShop(tx, inst.shopId, { type: 'INSTALLATION_STATUS_CHANGED', title: 'Montaj holati o‘zgardi', body: STATUS_TEXT[to], entityType: 'Installation', entityId: inst.id, newStatus: to }, { actorId: actorId ?? undefined, permission: 'installations.write', assignedMemberId: rs.assignedMemberId });
    }
  }

  // ───────────── Ro‘yxat va detail ─────────────

  listMine(userId: string, query: InstallationsQueryDto) {
    return this.db.installation.findMany({ where: { userId, ...(query.status ? { status: query.status } : {}) }, orderBy: { updatedAt: 'desc' }, take: 100, select: LIST_SELECT });
  }

  listForShop(ctx: ShopContext, query: InstallationsQueryDto) {
    return this.db.installation.findMany({ where: { shopId: ctx.shopId, ...(query.status ? { status: query.status } : {}) }, orderBy: { updatedAt: 'desc' }, take: 200, select: { ...LIST_SELECT, user: { select: { firstName: true, lastName: true, phone: true } } } });
  }

  async get(userId: string, id: string, panel: Panel | null) {
    const { inst, side } = await this.access(userId, id, panel, false);
    return this.view(inst.id, side);
  }

  private async view(id: string, side: Side) {
    const inst = await this.db.installation.findUniqueOrThrow({
      where: { id },
      include: {
        shop: { select: { id: true, name: true, slug: true, logoAssetId: true, phone: true } },
        quote: { select: { id: true, total: true, currency: true, systemPowerKw: true, systemType: true, durationDays: true, warrantyEquipmentMonths: true, warrantyInstallationMonths: true, request: { select: { id: true, number: true, title: true } } } },
        review: { select: { id: true, rating: true, comment: true, moderationStatus: true, createdAt: true, reply: { select: { body: true, createdAt: true } } } },
        installedSystem: { select: { id: true, systemPowerKw: true, installedAt: true } },
        user: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    const rs = await this.db.quoteRequestShop.findUnique({ where: { requestId_shopId: { requestId: inst.requestId, shopId: inst.shopId } }, select: { id: true } });
    const template = await this.templateFor(inst);
    const result = (inst.checklistResultJson as ChecklistResultItem[] | null) ?? [];
    return {
      id: inst.id,
      side,
      status: inst.status,
      scheduledDate: inst.scheduledDate,
      installedAt: inst.installedAt,
      confirmedAt: inst.confirmedAt,
      cancelReason: inst.cancelReason,
      disputeReason: inst.disputeReason,
      history: inst.historyJson,
      requestShopId: rs?.id ?? null,
      shop: inst.shop,
      quote: inst.quote,
      customer: side === 'SHOP' ? inst.user : undefined,
      checklist: template ? { items: template, result, evaluation: evaluateChecklist(template, result), completedAt: inst.checklistCompletedAt } : null,
      review: side === 'CUSTOMER' || inst.review?.moderationStatus === 'PUBLISHED' ? inst.review : null,
      installedSystem: inst.installedSystem,
      version: inst.version,
    };
  }

  private async templateFor(inst: Pick<Installation, 'checklistTemplateId'> & { quote?: { systemType: string | null } | null }): Promise<ChecklistTemplateItem[] | null> {
    if (!inst.checklistTemplateId) return null;
    const tpl = await this.db.acceptanceChecklistTemplate.findUnique({ where: { id: inst.checklistTemplateId }, select: { itemsJson: true } });
    return (tpl?.itemsJson as ChecklistTemplateItem[] | undefined) ?? null;
  }

  // ───────────── Do‘kon va mijoz amallari ─────────────

  async update(userId: string, id: string, panel: Panel | null, dto: UpdateInstallationDto) {
    const { inst, side } = await this.access(userId, id, panel, true);
    await this.db.$transaction(async (tx) => {
      switch (dto.action) {
        case 'SCHEDULE': {
          if (side !== 'SHOP') throw new ForbiddenException(ERRORS.SHOP_PERMISSION_REQUIRED);
          if (!dto.scheduledDate) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', ERRORS.SITE_VISIT_SLOTS_INVALID);
          const date = new Date(`${dto.scheduledDate.slice(0, 10)}T00:00:00Z`);
          // Sana qayta belgilanishi mumkin (INSTALLATION_SCHEDULED holatida) — holat o‘zgarmaydi.
          if (inst.status === 'INSTALLATION_SCHEDULED') {
            await tx.installation.update({ where: { id: inst.id }, data: { scheduledDate: date, version: { increment: 1 } } });
            const rs = await this.requestShopId(tx, inst);
            await this.requests.systemMessage(tx, rs.id, 'INSTALLATION', `Montaj sanasi o‘zgardi: ${dto.scheduledDate.slice(0, 10).split('-').reverse().join('.')}`);
            await this.notify.toUser(tx, inst.userId, { type: 'INSTALLATION_STATUS_CHANGED', title: 'Montaj sanasi o‘zgardi', body: dto.scheduledDate.slice(0, 10), entityType: 'Installation', entityId: inst.id }, userId);
            break;
          }
          await this.transition(tx, inst, 'INSTALLATION_SCHEDULED', 'SHOP', userId, { scheduledDate: date }, dto.scheduledDate.slice(0, 10).split('-').reverse().join('.'));
          break;
        }
        case 'MARK_INSTALLED':
          if (side !== 'SHOP') throw new ForbiddenException(ERRORS.SHOP_PERMISSION_REQUIRED);
          await this.transition(tx, inst, 'INSTALLED', 'SHOP', userId, { installedAt: new Date(), remindersSent: 0 }, dto.note?.trim());
          break;
        case 'CANCEL': {
          const reason = dto.reason?.trim();
          if (!reason) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'CANCEL_REASON_REQUIRED', ERRORS.CANCEL_REASON_REQUIRED);
          await this.transition(tx, inst, 'CANCELLED', side, userId, { cancelReason: reason }, reason);
          break;
        }
      }
    });
    return this.view(inst.id, side);
  }

  async checklist(userId: string, id: string, panel: Panel | null) {
    const { inst } = await this.access(userId, id, panel, false);
    const template = await this.templateFor(inst);
    const result = (inst.checklistResultJson as ChecklistResultItem[] | null) ?? [];
    return { status: inst.status, items: template ?? [], result, evaluation: template ? evaluateChecklist(template, result) : null };
  }

  private async customerOnly(userId: string, id: string) {
    const inst = await this.load(id);
    if (inst.userId !== userId) throw new NotFoundException(ERRORS.INSTALLATION_NOT_FOUND);
    return inst;
  }

  /** Rasmlar: mijoz yuklagan, shu montajga biriktirilgan fayllar. */
  private async assertPhotos(userId: string, installationId: string, ids: string[]) {
    if (!ids.length) return;
    const ok = await this.db.mediaAsset.count({ where: { id: { in: ids }, uploaderId: userId, kind: 'MESSAGE_ATTACHMENT', linkedResourceType: 'Installation', linkedResourceId: installationId, status: { notIn: ['REJECTED', 'FAILED'] } } });
    if (ok !== ids.length) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'MESSAGE_ATTACHMENT_INVALID', ERRORS.MESSAGE_ATTACHMENT_INVALID);
  }

  async saveChecklist(userId: string, id: string, dto: SaveChecklistDto) {
    const inst = await this.customerOnly(userId, id);
    if (inst.status !== 'INSTALLED') throw new DomainException(HttpStatus.CONFLICT, 'CHECKLIST_NOT_AVAILABLE', ERRORS.CHECKLIST_NOT_AVAILABLE);
    const template = (await this.templateFor(inst)) ?? [];
    const items: ChecklistResultItem[] = dto.items
      .filter((item) => template.some((t) => t.code === item.code))
      .map((item) => ({ code: item.code, status: item.status, comment: item.comment?.trim() || null, photoFileIds: [...new Set(item.photoFileIds ?? [])] }));
    await this.assertPhotos(userId, inst.id, items.flatMap((i) => i.photoFileIds ?? []));
    await this.db.installation.update({ where: { id: inst.id }, data: { checklistResultJson: items as unknown as Prisma.InputJsonValue } });
    return { result: items, evaluation: evaluateChecklist(template, items) };
  }

  /** INSTALLED → CONFIRMED (13.7): chek-list to‘liq bo‘lmasa 409; muammo bo‘lsa — faqat "Baribir tasdiqlash" bilan. */
  async confirm(userId: string, id: string, dto: ConfirmInstallationDto) {
    const inst = await this.customerOnly(userId, id);
    assertInstallationTransition(inst.status, 'CONFIRMED', 'CUSTOMER');
    const template = (await this.templateFor(inst)) ?? [];
    const result = (inst.checklistResultJson as ChecklistResultItem[] | null) ?? [];
    const evaluation = evaluateChecklist(template, result);
    if (!evaluation.complete || (evaluation.hasIssues && !dto.acceptWithIssues)) {
      throw new DomainException(HttpStatus.CONFLICT, 'CHECKLIST_INCOMPLETE', ERRORS.CHECKLIST_INCOMPLETE);
    }
    await this.db.$transaction(async (tx) => {
      const now = new Date();
      await this.transition(tx, inst, 'CONFIRMED', 'CUSTOMER', userId, { confirmedAt: now, checklistCompletedAt: now }, evaluation.hasIssues ? 'muammolar bilan qabul qilindi' : undefined);
      if (evaluation.hasIssues) {
        const rs = await this.requestShopId(tx, inst);
        await this.notify.toShop(tx, inst.shopId, { type: 'INSTALLATION_ISSUE_REPORTED', title: 'Chek-listda muammo bor', body: 'Mijoz montajni qabul qildi, lekin ayrim bandlarda muammo ko‘rsatdi.', entityType: 'Installation', entityId: inst.id }, { actorId: userId, permission: 'installations.write', assignedMemberId: rs.assignedMemberId });
      }
      await this.createInstalledSystem(tx, inst.id, now, result);
      await this.analytics.track({ eventType: 'installation_confirmed', userId, shopId: inst.shopId, entityId: inst.id, properties: { withIssues: evaluation.hasIssues } }, tx);
    });
    return this.view(inst.id, 'CUSTOMER');
  }

  /** "Do‘kondan tuzatishni so‘rash": chatga avtomatik xabar, status INSTALLED qoladi. */
  async requestFix(userId: string, id: string) {
    const inst = await this.customerOnly(userId, id);
    if (inst.status !== 'INSTALLED') throw new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);
    const template = (await this.templateFor(inst)) ?? [];
    const issues = ((inst.checklistResultJson as ChecklistResultItem[] | null) ?? []).filter((i) => i.status === 'ISSUE');
    const lines = issues.map((i) => `• ${template.find((t) => t.code === i.code)?.titleI18n.uz ?? i.code}: ${i.comment ?? ''}`);
    await this.db.$transaction(async (tx) => {
      const rs = await this.requestShopId(tx, inst);
      await tx.conversationMessage.create({ data: { requestShopId: rs.id, senderUserId: userId, senderSide: 'CUSTOMER', systemKind: 'FIX_REQUEST', body: `Montajda tuzatish kerak:\n${lines.join('\n') || '—'}`, attachmentFileIds: [] } });
      await this.notify.toShop(tx, inst.shopId, { type: 'INSTALLATION_ISSUE_REPORTED', title: 'Mijoz tuzatishni so‘radi', body: `${issues.length} ta bandda muammo`, entityType: 'Installation', entityId: inst.id }, { actorId: userId, permission: 'installations.write', assignedMemberId: rs.assignedMemberId });
    });
    return { ok: true };
  }

  async dispute(userId: string, id: string, dto: DisputeDto) {
    const inst = await this.customerOnly(userId, id);
    const reason = dto.reason.trim();
    if (reason.length < 5) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'DISPUTE_REASON_REQUIRED', ERRORS.DISPUTE_REASON_REQUIRED);
    await this.assertPhotos(userId, inst.id, dto.photoFileIds ?? []);
    await this.db.$transaction(async (tx) => {
      await this.transition(tx, inst, 'DISPUTED', 'CUSTOMER', userId, { disputeReason: reason }, reason);
      await tx.complaint.create({ data: { reporterId: userId, targetType: 'SHOP', targetId: inst.shopId, reason: 'OTHER', details: `INSTALLATION_DISPUTE ${inst.id}: ${reason}` } });
    });
    return this.view(inst.id, 'CUSTOMER');
  }

  /** O‘rnatilgan tizim kartasi + kafolatlar (montajdan keyingi kabinet M7 da kengayadi). */
  private async createInstalledSystem(tx: Tx, installationId: string, at: Date, checklist: ChecklistResultItem[]) {
    const inst = await tx.installation.findUniqueOrThrow({
      where: { id: installationId },
      include: { quote: { include: { items: { orderBy: { sortOrder: 'asc' } }, request: { select: { siteId: true, calculationId: true, systemType: true } } } }, installedSystem: { select: { id: true } } },
    });
    if (inst.installedSystem) return;
    const q = inst.quote;
    const calc = q.request.calculationId ? await tx.calculation.findUnique({ where: { id: q.request.calculationId }, select: { outputSummaryJson: true } }) : null;
    const calcPower = numAt(calc?.outputSummaryJson, 'systemPowerKw');
    const power = q.systemPowerKw ? Number(q.systemPowerKw) : calcPower ?? 0;
    const scale = calcPower ? power / calcPower : 1;
    const monthly = numArrayAt(calc?.outputSummaryJson, 'generation.monthly')?.map((v) => Math.round(v * scale)) ?? null;
    const components = q.items.filter((i) => i.itemType === 'EQUIPMENT').map((i) => ({ title: i.titleSnapshot, quantity: Number(i.quantity), specs: i.specsSnapshotJson }));
    const system = await tx.installedSystem.create({
      data: {
        userId: inst.userId, siteId: q.request.siteId, installationId: inst.id, systemPowerKw: power, systemType: q.systemType ?? q.request.systemType,
        componentsJson: components as Prisma.InputJsonValue, checklistJson: checklist as unknown as Prisma.InputJsonValue, installedAt: inst.installedAt ?? at,
        expectedMonthlyKwhJson: monthly ? (monthly as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
    const start = inst.installedAt ?? at;
    const addMonths = (d: Date, m: number) => {
      const r = new Date(d);
      r.setUTCMonth(r.getUTCMonth() + m);
      return r;
    };
    const warranties: Array<{ component: string; months: number }> = [];
    if (q.warrantyEquipmentMonths) warranties.push({ component: 'Uskuna', months: q.warrantyEquipmentMonths });
    if (q.warrantyInstallationMonths) warranties.push({ component: 'Montaj', months: q.warrantyInstallationMonths });
    for (const item of q.items) {
      const months = (item.specsSnapshotJson as Record<string, unknown> | null)?.warrantyMonths;
      if (item.itemType === 'EQUIPMENT' && typeof months === 'number' && months > 0) warranties.push({ component: item.titleSnapshot.slice(0, 200), months });
    }
    if (warranties.length) {
      await tx.warrantyItem.createMany({ data: warranties.map((w) => ({ installedSystemId: system.id, component: w.component, months: w.months, startsAt: start, endsAt: addMonths(start, w.months) })) });
    }
    await createDefaultReminders(tx, system.id, start);
  }

  // ───────────── Admin: e’tirozlar (13.1 DISPUTED → CONFIRMED/CANCELLED) ─────────────

  listDisputes() {
    return this.db.installation.findMany({
      where: { status: 'DISPUTED' },
      orderBy: { updatedAt: 'asc' },
      select: { ...LIST_SELECT, disputeReason: true, checklistResultJson: true, user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    });
  }

  async resolveDispute(adminId: string, id: string, dto: ResolveDisputeDto) {
    const inst = await this.load(id);
    await this.db.$transaction(async (tx) => {
      const now = new Date();
      await this.transition(tx, inst, dto.decision, 'ADMIN', adminId, dto.decision === 'CONFIRMED' ? { confirmedAt: now } : { cancelReason: dto.note.trim() }, dto.note.trim());
      await tx.auditLog.create({ data: { actorId: adminId, action: 'INSTALLATION_DISPUTE_RESOLVED', targetType: 'Installation', targetId: inst.id, before: { status: inst.status }, after: { status: dto.decision, note: dto.note.trim() } } });
      if (dto.decision === 'CONFIRMED') await this.createInstalledSystem(tx, inst.id, now, (inst.checklistResultJson as ChecklistResultItem[] | null) ?? []);
    });
    return this.view(inst.id, 'CUSTOMER');
  }

  // ───────────── Job: installation-reminder (14.1) ─────────────

  async sendConfirmReminders(now = new Date()) {
    const rows = await this.db.installation.findMany({ where: { status: 'INSTALLED', remindersSent: { lt: REMINDER_DAYS.length }, installedAt: { not: null } }, select: { id: true, userId: true, installedAt: true, remindersSent: true } });
    let sent = 0;
    for (const row of rows) {
      const days = (now.getTime() - row.installedAt!.getTime()) / 86_400_000;
      if (days < REMINDER_DAYS[row.remindersSent]) continue;
      await this.db.$transaction(async (tx) => {
        const marked = await tx.installation.updateMany({ where: { id: row.id, remindersSent: row.remindersSent }, data: { remindersSent: { increment: 1 } } });
        if (!marked.count) return;
        await this.notify.toUser(tx, row.userId, { type: 'INSTALLATION_CONFIRM_REMINDER', title: 'Montajni qabul qiling', body: 'Do‘kon montaj bajarilganini bildirdi. Chek-listni to‘ldirib, qabul qiling yoki muammoni yozing.', entityType: 'Installation', entityId: row.id });
        sent += 1;
      });
    }
    return { sent };
  }
}
