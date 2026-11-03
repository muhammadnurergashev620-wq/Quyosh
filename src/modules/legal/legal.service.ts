import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PolicyStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { PolicyQueryDto } from './dto/policy-query.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@Injectable()
export class LegalService {
  constructor(private readonly db: PrismaService) {}

  findAll(query: PolicyQueryDto) {
    return this.db.policyVersion.findMany({
      where: { type: query.type, status: PolicyStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
    });
  }

  findAllForAdmin(query: PolicyQueryDto) {
    return this.db.policyVersion.findMany({
      where: { type: query.type, status: query.status },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const policy = await this.db.policyVersion.findUnique({ where: { id } });
    if (!policy) {
      throw new NotFoundException(ERRORS.POLICY_NOT_FOUND);
    }
    return policy;
  }

  async create(adminId: string, dto: CreatePolicyDto) {
    const policy = await this.db.policyVersion.create({ data: dto });
    await this.writeAudit(adminId, 'POLICY_CREATED', policy.id);
    return policy;
  }

  async update(adminId: string, id: string, dto: UpdatePolicyDto) {
    const policy = await this.findOne(id);
    if (policy.status !== PolicyStatus.DRAFT) {
      throw new ConflictException(ERRORS.POLICY_NOT_DRAFT);
    }

    const updated = await this.db.policyVersion.update({ where: { id }, data: dto });
    await this.writeAudit(adminId, 'POLICY_UPDATED', id);
    return updated;
  }

  async publish(adminId: string, id: string) {
    const policy = await this.findOne(id);

    await this.db.policyVersion.updateMany({
      where: { type: policy.type, status: PolicyStatus.PUBLISHED },
      data: { status: PolicyStatus.ARCHIVED },
    });
    const published = await this.db.policyVersion.update({
      where: { id },
      data: { status: PolicyStatus.PUBLISHED, publishedAt: new Date() },
    });

    await this.writeAudit(adminId, 'POLICY_PUBLISHED', id);
    return published;
  }

  async accept(userId: string, id: string, ip: string) {
    const policy = await this.findOne(id);
    if (policy.status !== PolicyStatus.PUBLISHED) {
      throw new ConflictException(ERRORS.POLICY_NOT_PUBLISHED);
    }

    const existing = await this.db.policyAcceptance.findUnique({
      where: { userId_policyId: { userId, policyId: id } },
    });
    if (existing) {
      throw new ConflictException(ERRORS.DUPLICATE_POLICY_ACCEPTANCE);
    }

    return this.db.policyAcceptance.create({
      data: { userId, policyId: id, ipAddress: ip },
    });
  }

  findAllAcceptances(userId: string) {
    return this.db.policyAcceptance.findMany({
      where: { userId },
      include: { policy: { select: { type: true, version: true, title: true } } },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  private async writeAudit(adminId: string, action: string, policyId: string) {
    await this.db.auditLog.create({
      data: { actorId: adminId, action, targetType: 'PolicyVersion', targetId: policyId },
    });
  }
}
