import { BadRequestException, ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, type SupportStatus, type SupportTicket } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';
import { normalizeUzPhone } from '../../common/utils/phone';
import { tashkentDate } from '../../common/utils/tashkent-date';
import { OtpService } from '../otp/otp.service';
import { M6Notifier } from '../quote-request/m6-notifier.service';
import { CATEGORY_PRIORITY, firstResponseDue, formatTicketNumber } from './sla';
import type { AdminTicketsQueryDto, AdminUpdateTicketDto, AgentMessageDto, CreateTicketDto, ReplyTemplateDto, TicketMessageDto } from './dto/support.dto';

const DAY = 86_400_000;
const AUTOCLOSE_DAYS = 7;

const conflict = () => new DomainException(HttpStatus.CONFLICT, 'TICKET_CLOSED', ERRORS.TICKET_CLOSED);

/** Yordam markazi (TZ 4.20, 7.7, 9.10, U7.7, U12.9). */
@Injectable()
export class SupportService {
  constructor(
    private readonly db: PrismaService,
    private readonly otp: OtpService,
    private readonly notify: M6Notifier,
  ) {}

  private view(t: SupportTicket & { messages?: Array<{ id: string; senderSide: string; body: string; attachmentFileIds: string[]; isInternal: boolean; createdAt: Date; senderUserId: string | null }> }, agent = false) {
    return {
      ...t,
      code: formatTicketNumber(t.number),
      guestContact: agent ? t.guestContact : undefined,
      messages: t.messages?.filter((m) => agent || !m.isInternal),
    };
  }

  // ───────────── Foydalanuvchi ─────────────

  async guestOtp(phone: string, ip: string | null) {
    const normalized = normalizeUzPhone(phone);
    if (!normalized) throw new BadRequestException('Telefon raqami noto‘g‘ri');
    const res = await this.otp.issue(normalized, 'PHONE_VERIFICATION', undefined, { ip: ip ?? undefined, panel: 'SUPPORT' });
    return { sent: true, resendAfter: res.resendAfter, ...('developmentCode' in res ? { developmentCode: res.developmentCode } : {}) };
  }

  private async assertAttachments(userId: string | null, ids: string[]) {
    if (!ids.length) return;
    if (!userId) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'MESSAGE_ATTACHMENT_INVALID', ERRORS.MESSAGE_ATTACHMENT_INVALID);
    const ok = await this.db.mediaAsset.count({ where: { id: { in: ids }, uploaderId: userId, kind: 'SUPPORT_ATTACHMENT', status: { notIn: ['REJECTED', 'FAILED'] } } });
    if (ok !== new Set(ids).size) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'MESSAGE_ATTACHMENT_INVALID', ERRORS.MESSAGE_ATTACHMENT_INVALID);
  }

  /** Bog‘liq obyekt faqat o‘ziniki bo‘lsa (IDOR). */
  private async assertRelated(userId: string | null, type?: string, id?: string) {
    if (!type || !id) return;
    if (!userId) throw new BadRequestException(ERRORS.VALIDATION_FAILED);
    const found =
      type === 'Calculation' ? await this.db.calculation.count({ where: { id, userId } })
      : type === 'QuoteRequest' ? await this.db.quoteRequest.count({ where: { id, userId } })
      : type === 'Installation' ? await this.db.installation.count({ where: { id, userId } })
      : await this.db.shopMember.count({ where: { shopId: id, userId } });
    if (!found) throw new NotFoundException(ERRORS.PRISMA_NOT_FOUND);
  }

  /** Kuniga max 5 yangi murojaat (TZ 9.10). Guest — telefon OTP; shu raqamli akkaunt bo‘lsa unga bog‘lanadi. */
  async create(userId: string | null, dto: CreateTicketDto, ip: string | null) {
    let requesterUserId = userId;
    let guestContact: string | null = null;
    if (!userId) {
      if (!dto.guest) throw new ForbiddenException(ERRORS.AUTHORIZATION_REQUIRED);
      const phone = normalizeUzPhone(dto.guest.phone);
      if (!phone) throw new BadRequestException('Telefon raqami noto‘g‘ri');
      await this.otp.verify(phone, 'PHONE_VERIFICATION', dto.guest.code);
      const existing = await this.db.user.findUnique({ where: { phone }, select: { id: true, deletedAt: true } });
      requesterUserId = existing && !existing.deletedAt ? existing.id : null;
      guestContact = phone;
    }
    const dayStart = new Date(`${tashkentDate()}T00:00:00+05:00`);
    const today = await this.db.supportTicket.count({ where: { createdAt: { gte: dayStart }, ...(requesterUserId ? { requesterUserId } : { guestContact }) } });
    if (today >= 5) throw new DomainException(HttpStatus.TOO_MANY_REQUESTS, 'TICKET_DAILY_LIMIT', ERRORS.TICKET_DAILY_LIMIT);
    await this.assertRelated(userId, dto.relatedType, dto.relatedId);
    await this.assertAttachments(userId, dto.attachmentIds ?? []);
    const shopId = dto.relatedType === 'Shop' ? dto.relatedId ?? null : null;
    const priority = CATEGORY_PRIORITY[dto.category];
    const now = new Date();
    const ticket = await this.db.supportTicket.create({
      data: {
        requesterUserId, guestContact, shopId, category: dto.category, subject: dto.subject.trim(), priority, relatedType: dto.relatedType ?? null, relatedId: dto.relatedId ?? null,
        requestIdRef: dto.requestIdRef ?? null, firstResponseDueAt: firstResponseDue(now, priority), lastMessageAt: now,
        messages: { create: { senderUserId: userId, senderSide: 'USER', body: (dto.guest ? `${dto.guest.name.trim()}:\n` : '') + dto.body.trim(), attachmentFileIds: [...new Set(dto.attachmentIds ?? [])] } },
      },
    });
    return { id: ticket.id, number: ticket.number, code: formatTicketNumber(ticket.number), firstResponseDueAt: ticket.firstResponseDueAt };
  }

  /** Egasi: requesterUserId yoki (guest sifatida yaratilgan) shu telefon. Begona — 404. */
  private async ownTicket(userId: string, id: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const t = await this.db.supportTicket.findFirst({ where: { id, OR: [{ requesterUserId: userId }, ...(user?.phone ? [{ guestContact: user.phone }] : [])] } });
    if (!t) throw new NotFoundException(ERRORS.TICKET_NOT_FOUND);
    return t;
  }

  async mine(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const rows = await this.db.supportTicket.findMany({ where: { OR: [{ requesterUserId: userId }, ...(user?.phone ? [{ guestContact: user.phone }] : [])] }, orderBy: { lastMessageAt: 'desc' }, take: 100 });
    return rows.map((t) => this.view(t));
  }

  async get(userId: string, id: string) {
    const t = await this.ownTicket(userId, id);
    const full = await this.db.supportTicket.findUniqueOrThrow({ where: { id: t.id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    return this.view(full);
  }

  async reply(userId: string, id: string, dto: TicketMessageDto) {
    const t = await this.ownTicket(userId, id);
    if (t.status === 'CLOSED') throw conflict();
    await this.assertAttachments(userId, dto.attachmentIds ?? []);
    const status: SupportStatus = t.status === 'WAITING_USER' || t.status === 'RESOLVED' ? 'IN_PROGRESS' : t.status;
    await this.db.$transaction([
      this.db.supportMessage.create({ data: { ticketId: t.id, senderUserId: userId, senderSide: 'USER', body: dto.body.trim(), attachmentFileIds: [...new Set(dto.attachmentIds ?? [])] } }),
      this.db.supportTicket.update({ where: { id: t.id }, data: { status, lastMessageAt: new Date(), ...(status !== t.status && t.status === 'RESOLVED' ? { resolvedAt: null } : {}) } }),
    ]);
    return this.get(userId, id);
  }

  async resolveByUser(userId: string, id: string) {
    const t = await this.ownTicket(userId, id);
    if (t.status === 'CLOSED') throw conflict();
    await this.db.$transaction([
      this.db.supportTicket.update({ where: { id: t.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } }),
      this.db.supportMessage.create({ data: { ticketId: t.id, senderSide: 'SYSTEM', body: 'Foydalanuvchi murojaatni hal bo‘ldi deb belgiladi' } }),
    ]);
    return this.get(userId, id);
  }

  async reopen(userId: string, id: string) {
    const t = await this.ownTicket(userId, id);
    if (t.status !== 'RESOLVED') throw new DomainException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', ERRORS.INVALID_STATUS_TRANSITION);
    await this.db.$transaction([
      this.db.supportTicket.update({ where: { id: t.id }, data: { status: 'IN_PROGRESS', resolvedAt: null, satisfaction: null } }),
      this.db.supportMessage.create({ data: { ticketId: t.id, senderSide: 'SYSTEM', body: 'Murojaat qayta ochildi' } }),
    ]);
    return this.get(userId, id);
  }

  async rate(userId: string, id: string, score: number) {
    const t = await this.ownTicket(userId, id);
    if (t.status !== 'RESOLVED' && t.status !== 'CLOSED') throw new DomainException(HttpStatus.CONFLICT, 'TICKET_RATE_NOT_ALLOWED', ERRORS.TICKET_RATE_NOT_ALLOWED);
    await this.db.supportTicket.update({ where: { id: t.id }, data: { satisfaction: score } });
    return { satisfaction: score };
  }

  // ───────────── Admin navbati (U12.9) ─────────────

  async adminList(adminId: string, query: AdminTicketsQueryDto) {
    const search = query.search?.trim();
    const num = search?.match(/(\d{1,9})$/)?.[1];
    const rows = await this.db.supportTicket.findMany({
      where: {
        ...(query.status ? { status: query.status } : { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] } }),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.assignee === 'mine' ? { assigneeId: adminId } : query.assignee === 'unassigned' ? { assigneeId: null } : {}),
        ...(search ? { OR: [{ subject: { contains: search, mode: 'insensitive' } }, ...(num ? [{ number: Number(num) }] : [])] } : {}),
      },
      orderBy: [{ firstRespondedAt: { sort: 'asc', nulls: 'first' } }, { firstResponseDueAt: 'asc' }],
      take: 200,
    });
    const now = Date.now();
    return rows.map((t) => {
      const total = t.firstResponseDueAt.getTime() - t.createdAt.getTime();
      const left = t.firstResponseDueAt.getTime() - now;
      return { ...this.view(t, true), sla: t.firstRespondedAt ? 'MET' : left <= 0 ? 'BREACHED' : left <= total * 0.25 ? 'AT_RISK' : 'OK', minutesLeft: t.firstRespondedAt ? null : Math.round(left / 60_000) };
    });
  }

  async adminGet(id: string) {
    const t = await this.db.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!t) throw new NotFoundException(ERRORS.TICKET_NOT_FOUND);
    const requester = t.requesterUserId ? await this.db.user.findUnique({ where: { id: t.requesterUserId }, select: { id: true, firstName: true, lastName: true, phone: true, accountNumber: true } }) : null;
    return { ...this.view(t, true), requester };
  }

  async adminUpdate(adminId: string, id: string, dto: AdminUpdateTicketDto) {
    const t = await this.db.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException(ERRORS.TICKET_NOT_FOUND);
    if (dto.assigneeId) {
      const admin = await this.db.userRole.count({ where: { userId: dto.assigneeId, role: Role.ADMIN } });
      if (!admin) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    }
    const data: Prisma.SupportTicketUpdateInput = {
      ...(dto.status ? { status: dto.status, ...(dto.status === 'RESOLVED' ? { resolvedAt: new Date() } : {}), ...(dto.status === 'CLOSED' ? { closedAt: new Date() } : {}) } : {}),
      ...(dto.priority && dto.priority !== t.priority ? { priority: dto.priority, ...(t.firstRespondedAt ? {} : { firstResponseDueAt: firstResponseDue(t.createdAt, dto.priority), slaWarnedAt: null }) } : {}),
      ...(dto.unassign ? { assigneeId: null } : dto.assigneeId ? { assigneeId: dto.assigneeId } : {}),
    };
    await this.db.$transaction(async (tx) => {
      await tx.supportTicket.update({ where: { id }, data });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'SUPPORT_TICKET_UPDATED', targetType: 'SupportTicket', targetId: id, before: { status: t.status, priority: t.priority, assigneeId: t.assigneeId }, after: data as Prisma.InputJsonValue } });
      if (dto.status === 'RESOLVED' && t.status !== 'RESOLVED' && t.requesterUserId) {
        await this.notify.toUser(tx, t.requesterUserId, { type: 'SUPPORT_RESOLVED', title: `${formatTicketNumber(t.number)} hal qilindi`, body: 'Javobimiz yordam berdimi? Murojaatni baholang.', entityType: 'SupportTicket', entityId: id }, adminId);
      }
    });
    return this.adminGet(id);
  }

  /** Agent javobi yoki ichki izoh (foydalanuvchiga ko‘rinmaydi). Birinchi ochiq javob — firstRespondedAt. */
  async adminReply(adminId: string, id: string, dto: AgentMessageDto) {
    const t = await this.db.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException(ERRORS.TICKET_NOT_FOUND);
    if (t.status === 'CLOSED') throw conflict();
    const internal = !!dto.internal;
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.supportMessage.create({ data: { ticketId: id, senderUserId: adminId, senderSide: 'AGENT', body: dto.body.trim(), isInternal: internal } });
      if (!internal) {
        const status = dto.status ?? 'WAITING_USER';
        await tx.supportTicket.update({ where: { id }, data: { status, lastMessageAt: now, firstRespondedAt: t.firstRespondedAt ?? now, assigneeId: t.assigneeId ?? adminId, ...(status === 'RESOLVED' ? { resolvedAt: now } : {}) } });
        if (t.requesterUserId) {
          await this.notify.toUser(tx, t.requesterUserId, { type: status === 'RESOLVED' ? 'SUPPORT_RESOLVED' : 'SUPPORT_REPLY', title: `${formatTicketNumber(t.number)}: javob keldi`, body: dto.body.trim().slice(0, 140), entityType: 'SupportTicket', entityId: id }, adminId);
        }
      }
    });
    return this.adminGet(id);
  }

  templates() {
    return this.db.supportReplyTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createTemplate(dto: ReplyTemplateDto) {
    return this.db.supportReplyTemplate.create({ data: { titleI18n: dto.titleI18n, bodyI18n: dto.bodyI18n, category: dto.category ?? null, active: dto.active ?? true } });
  }

  async updateTemplate(id: string, dto: ReplyTemplateDto) {
    const r = await this.db.supportReplyTemplate.updateMany({ where: { id }, data: { titleI18n: dto.titleI18n, bodyI18n: dto.bodyI18n, category: dto.category ?? null, active: dto.active ?? true } });
    if (!r.count) throw new NotFoundException(ERRORS.PRISMA_NOT_FOUND);
    return this.db.supportReplyTemplate.findUniqueOrThrow({ where: { id } });
  }

  async deleteTemplate(id: string) {
    await this.db.supportReplyTemplate.deleteMany({ where: { id } });
    return { deleted: true };
  }

  // ───────────── Joblar (14.1) ─────────────

  /** support-sla-watch (har 5 daqiqa): muddat yaqinlashsa (25 % qolganda) yoki o‘tsa — SUPPORT huquqli adminlarga bir marta. */
  async slaWatch(now = new Date()) {
    const open = await this.db.supportTicket.findMany({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, firstRespondedAt: null, slaWarnedAt: null }, select: { id: true, number: true, createdAt: true, firstResponseDueAt: true, assigneeId: true, priority: true } });
    const risky = open.filter((t) => t.firstResponseDueAt.getTime() - now.getTime() <= (t.firstResponseDueAt.getTime() - t.createdAt.getTime()) * 0.25);
    if (!risky.length) return { warned: 0 };
    const admins = await this.db.user.findMany({ where: { deletedAt: null, userRoles: { some: { role: Role.ADMIN } }, OR: [{ isSuperAdmin: true }, { adminPermissions: { has: 'SUPPORT' } }] }, select: { id: true } });
    for (const t of risky) {
      await this.db.$transaction(async (tx) => {
        const marked = await tx.supportTicket.updateMany({ where: { id: t.id, slaWarnedAt: null }, data: { slaWarnedAt: now } });
        if (!marked.count) return;
        const breached = t.firstResponseDueAt <= now;
        const targets = t.assigneeId ? admins.filter((a) => a.id === t.assigneeId) : admins;
        for (const a of targets) {
          await this.notify.toUser(tx, a.id, { type: 'SUPPORT_REPLY', title: `${formatTicketNumber(t.number)}: ${breached ? 'javob muddati o‘tdi' : 'javob muddati yaqin'}`, body: `Ustuvorlik: ${t.priority}. Birinchi javob muddati: ${t.firstResponseDueAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`, entityType: 'SupportTicket', entityId: t.id });
        }
      });
    }
    return { warned: risky.length };
  }

  /** support-autoclose (kunlik): RESOLVED + 7 kun → CLOSED. */
  async autoclose(now = new Date()) {
    const res = await this.db.supportTicket.updateMany({ where: { status: 'RESOLVED', resolvedAt: { lte: new Date(now.getTime() - AUTOCLOSE_DAYS * DAY) } }, data: { status: 'CLOSED', closedAt: now } });
    return { closed: res.count };
  }
}
