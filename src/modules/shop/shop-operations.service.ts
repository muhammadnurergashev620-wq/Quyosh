import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainException } from '../../common/exceptions/business.exception';
import { regionOf } from '../../common/constants/regions';
import { GeoRepository } from '../geo/geo.repository';
import { normalizeMultiPolygon } from '../geo/geojson';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { normalizeUzPhone } from '../../common/utils/phone';
import { conflict } from './shop.service';
import { BranchDto, ServiceDto, UpdateBranchDto } from './dto/shop.dto';
import type { ServiceAreaDto } from '../geo/dto/geo.dto';

const json = (value: unknown) => (value === undefined ? undefined : value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue));

/** Filiallar (TZ 3.6, U11.8) va xizmatlar (TZ 7.4 Service). */
@Injectable()
export class ShopOperationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly geo: GeoRepository,
  ) {}

  /** Nuqta: ikkala koordinata birga; viloyat berilmagan bo‘lsa nuqtadan aniqlanadi. */
  private point(dto: BranchDto) {
    if (dto.lat === undefined && dto.lon === undefined) return undefined;
    if (dto.lat === null || dto.lon === null || dto.lat === undefined || dto.lon === undefined) return null;
    return { lat: dto.lat, lon: dto.lon };
  }

  async listBranches(shopId: string) {
    const branches = await this.db.shopBranch.findMany({ where: { shopId, archivedAt: null }, orderBy: { createdAt: 'asc' } });
    const points = await this.geo.branchPoints(branches.map((branch) => branch.id));
    return branches.map((branch) => {
      const point = points.get(branch.id);
      return { ...branch, lat: point?.lat ?? null, lon: point?.lon ?? null, hasServiceArea: point?.hasServiceArea ?? false };
    });
  }

  async createBranch(shopId: string, actorId: string, dto: BranchDto) {
    return this.db.$transaction(async (tx) => {
      const branch = await tx.shopBranch.create({
        data: {
          shopId,
          name: dto.name.trim(),
          address: dto.address.trim(),
          regionCode: dto.regionCode,
          phone: dto.phone ? normalizeUzPhone(dto.phone) : null,
          openingHoursJson: json(dto.openingHoursJson),
          holidayExceptionsJson: json(dto.holidayExceptionsJson),
          status: dto.status,
        },
      });
      const point = this.point(dto);
      if (point) {
        await this.geo.setBranchLocation(branch.id, point, tx);
        if (!dto.regionCode) await tx.shopBranch.update({ where: { id: branch.id }, data: { regionCode: regionOf(point.lat, point.lon) } });
      }
      await tx.auditLog.create({ data: { actorId, action: 'SHOP_BRANCH_CREATED', targetType: 'Shop', targetId: shopId, after: { branchId: branch.id, name: branch.name } } });
      return tx.shopBranch.findUniqueOrThrow({ where: { id: branch.id } });
    });
  }

  /** Optimistic lock: eskirgan `version` bilan — 409 VERSION_CONFLICT (TZ 6.6). */
  async updateBranch(shopId: string, actorId: string, branchId: string, dto: UpdateBranchDto) {
    const current = await this.db.shopBranch.findFirst({ where: { id: branchId, shopId, archivedAt: null } });
    if (!current) throw new NotFoundException(ERRORS.BRANCH_NOT_FOUND);
    return this.db.$transaction(async (tx) => {
      const result = await tx.shopBranch.updateMany({
        where: { id: branchId, shopId, version: dto.version, archivedAt: null },
        data: {
          name: dto.name.trim(),
          address: dto.address.trim(),
          regionCode: dto.regionCode ?? null,
          phone: dto.phone ? normalizeUzPhone(dto.phone) : null,
          openingHoursJson: json(dto.openingHoursJson ?? null),
          holidayExceptionsJson: json(dto.holidayExceptionsJson ?? null),
          status: dto.status ?? current.status,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) throw conflict('VERSION_CONFLICT', ERRORS.VERSION_CONFLICT);
      const point = this.point(dto);
      if (point !== undefined) await this.geo.setBranchLocation(branchId, point, tx);
      if (point && !dto.regionCode) await tx.shopBranch.update({ where: { id: branchId }, data: { regionCode: regionOf(point.lat, point.lon) } });
      await tx.auditLog.create({ data: { actorId, action: 'SHOP_BRANCH_UPDATED', targetType: 'Shop', targetId: shopId, before: { branchId, name: current.name, address: current.address }, after: { name: dto.name, address: dto.address } } });
      return tx.shopBranch.findUniqueOrThrow({ where: { id: branchId } });
    });
  }

  async archiveBranch(shopId: string, actorId: string, branchId: string) {
    const result = await this.db.shopBranch.updateMany({ where: { id: branchId, shopId, archivedAt: null }, data: { archivedAt: new Date(), status: 'INACTIVE', version: { increment: 1 } } });
    if (result.count === 0) throw new NotFoundException(ERRORS.BRANCH_NOT_FOUND);
    await this.db.auditLog.create({ data: { actorId, action: 'SHOP_BRANCH_ARCHIVED', targetType: 'Shop', targetId: shopId, after: { branchId } } });
    return { id: branchId, archived: true };
  }

  // ───────────── Xizmat hududi (TZ 9.7: PUT /branches/:id/service-area) ─────────────

  private async branchOrThrow(shopId: string, branchId: string) {
    const branch = await this.db.shopBranch.findFirst({ where: { id: branchId, shopId, archivedAt: null }, select: { id: true } });
    if (!branch) throw new NotFoundException(ERRORS.BRANCH_NOT_FOUND);
    return branch;
  }

  async getServiceArea(shopId: string, branchId: string) {
    await this.branchOrThrow(shopId, branchId);
    const [area] = await this.geo.serviceAreas([branchId]);
    return area ? { id: area.id, areaKm2: area.area_km2.toString(), serviceTypes: area.service_types, active: area.active, geometry: JSON.parse(area.geojson) } : null;
  }

  async putServiceArea(shopId: string, actorId: string, branchId: string, dto: ServiceAreaDto) {
    await this.branchOrThrow(shopId, branchId);
    let geometry;
    if (dto.geometry) geometry = normalizeMultiPolygon(dto.geometry);
    else if (dto.radiusKm) {
      geometry = await this.geo.radiusGeometry(branchId, dto.radiusKm);
      if (!geometry) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', ERRORS.BRANCH_LOCATION_REQUIRED);
    } else throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', ERRORS.POLYGON_INVALID);
    const result = await this.db.$transaction(async (tx) => {
      const saved = await this.geo.replaceServiceArea(branchId, geometry, dto.serviceTypes ?? [], tx);
      await tx.auditLog.create({ data: { actorId, action: 'SHOP_SERVICE_AREA_UPDATED', targetType: 'Shop', targetId: shopId, after: { branchId, areaKm2: saved.areaKm2, radiusKm: dto.radiusKm ?? null } } });
      return saved;
    });
    return { ...result, geometry };
  }

  async deleteServiceArea(shopId: string, actorId: string, branchId: string) {
    await this.branchOrThrow(shopId, branchId);
    await this.geo.deleteServiceArea(branchId);
    await this.db.auditLog.create({ data: { actorId, action: 'SHOP_SERVICE_AREA_DELETED', targetType: 'Shop', targetId: shopId, after: { branchId } } });
    return { branchId, deleted: true };
  }

  private async assertBranch(shopId: string, branchId?: string | null) {
    if (!branchId) return;
    const branch = await this.db.shopBranch.findFirst({ where: { id: branchId, shopId, archivedAt: null }, select: { id: true } });
    if (!branch) throw new NotFoundException(ERRORS.BRANCH_NOT_FOUND);
  }

  listServices(shopId: string) {
    return this.db.service.findMany({ where: { shopId }, orderBy: [{ serviceType: 'asc' }, { createdAt: 'asc' }] });
  }

  async createService(shopId: string, actorId: string, dto: ServiceDto) {
    await this.assertBranch(shopId, dto.branchId);
    const service = await this.db.service.create({
      data: {
        shopId,
        branchId: dto.branchId,
        serviceType: dto.serviceType,
        pricingModel: dto.pricingModel,
        price: dto.price,
        currency: dto.currency,
        descriptionI18n: json(dto.descriptionI18n),
        warrantyMonths: dto.warrantyMonths,
        active: dto.active ?? true,
      },
    });
    await this.db.auditLog.create({ data: { actorId, action: 'SHOP_SERVICE_CREATED', targetType: 'Shop', targetId: shopId, after: { serviceId: service.id, serviceType: service.serviceType } } });
    return service;
  }

  async updateService(shopId: string, actorId: string, serviceId: string, dto: ServiceDto) {
    const current = await this.db.service.findFirst({ where: { id: serviceId, shopId } });
    if (!current) throw new NotFoundException(ERRORS.SERVICE_NOT_FOUND);
    await this.assertBranch(shopId, dto.branchId);
    const service = await this.db.service.update({
      where: { id: serviceId },
      data: {
        branchId: dto.branchId ?? null,
        serviceType: dto.serviceType,
        pricingModel: dto.pricingModel,
        price: dto.price ?? null,
        currency: dto.currency ?? current.currency,
        descriptionI18n: json(dto.descriptionI18n ?? null),
        warrantyMonths: dto.warrantyMonths ?? null,
        active: dto.active ?? current.active,
      },
    });
    await this.db.auditLog.create({ data: { actorId, action: 'SHOP_SERVICE_UPDATED', targetType: 'Shop', targetId: shopId, before: { price: current.price?.toString() ?? null, active: current.active }, after: { serviceId, price: service.price?.toString() ?? null, active: service.active } } });
    return service;
  }

  async deleteService(shopId: string, actorId: string, serviceId: string) {
    const result = await this.db.service.deleteMany({ where: { id: serviceId, shopId } });
    if (result.count === 0) throw new NotFoundException(ERRORS.SERVICE_NOT_FOUND);
    await this.db.auditLog.create({ data: { actorId, action: 'SHOP_SERVICE_DELETED', targetType: 'Shop', targetId: shopId, after: { serviceId } } });
    return { id: serviceId, deleted: true };
  }
}
