import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoofShape } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { regionOf } from '../../common/constants/regions';
import { GeoRepository } from './geo.repository';
import { areaFigures, defaultUsableFactor, normalizePolygon } from './geojson';
import { CreateSiteDto, SiteAreaDto, UpdateSiteAreaDto, UpdateSiteDto } from './dto/geo.dto';

const AREA_SELECT = {
  id: true, name: true, areaType: true, roofShape: true, projectedAreaM2: true, surfaceAreaM2: true, usableFactor: true, usableAreaM2: true,
  azimuthDeg: true, tiltDeg: true, shadingLevel: true, obstacleInfoJson: true, createdAt: true, updatedAt: true,
} satisfies Prisma.SiteAreaSelect;

/** Mijoz obyektlari va o‘rnatish maydonlari (TZ 7.5, 9.8, 11.3). Faqat egasiga ko‘rinadi. */
@Injectable()
export class SitesService {
  constructor(
    private readonly db: PrismaService,
    private readonly geo: GeoRepository,
  ) {}

  private async ownSite(userId: string, siteId: string) {
    const site = await this.db.customerSite.findFirst({ where: { id: siteId, userId, archivedAt: null }, select: { id: true } });
    if (!site) throw new NotFoundException(ERRORS.SITE_NOT_FOUND);
    return site;
  }

  async list(userId: string) {
    const sites = await this.db.customerSite.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, siteType: true, address: true, regionCode: true, createdAt: true, updatedAt: true, areas: { select: { id: true, usableAreaM2: true, projectedAreaM2: true } } },
    });
    const points = await this.geo.sitePoints(sites.map((site) => site.id));
    return sites.map(({ areas, ...site }) => ({
      ...site,
      ...points.get(site.id),
      areaCount: areas.length,
      usableAreaM2: areas.reduce((sum, area) => sum + Number(area.usableAreaM2), 0).toFixed(2),
    }));
  }

  async get(userId: string, siteId: string) {
    await this.ownSite(userId, siteId);
    const site = await this.db.customerSite.findUniqueOrThrow({
      where: { id: siteId },
      select: { id: true, title: true, siteType: true, address: true, regionCode: true, districtCode: true, notes: true, createdAt: true, updatedAt: true, areas: { orderBy: { createdAt: 'asc' }, select: AREA_SELECT } },
    });
    const [points, polygons] = await Promise.all([this.geo.sitePoints([siteId]), this.geo.areaGeometries([siteId])]);
    return { ...site, ...points.get(siteId), outsideUzbekistan: !site.regionCode, areas: site.areas.map((area) => ({ ...area, polygon: polygons.get(area.id) ?? null })) };
  }

  async create(userId: string, dto: CreateSiteDto) {
    const regionCode = regionOf(dto.lat, dto.lon);
    const id = await this.db.$transaction(async (tx) => {
      const siteId = await this.geo.insertSite(tx, {
        userId,
        title: dto.title.trim(),
        siteType: dto.siteType ?? 'HOUSE',
        address: dto.address?.trim() || null,
        notes: dto.notes?.trim() || null,
        regionCode,
        point: { lat: dto.lat, lon: dto.lon },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'SITE_CREATED', targetType: 'CustomerSite', targetId: siteId, after: { regionCode } } });
      return siteId;
    });
    return this.get(userId, id);
  }

  async update(userId: string, siteId: string, dto: UpdateSiteDto) {
    await this.ownSite(userId, siteId);
    const moved = dto.lat !== undefined && dto.lon !== undefined;
    await this.db.$transaction(async (tx) => {
      await tx.customerSite.update({
        where: { id: siteId },
        data: {
          title: dto.title?.trim(),
          siteType: dto.siteType,
          address: dto.address === undefined ? undefined : dto.address.trim() || null,
          notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
          ...(moved ? { regionCode: regionOf(dto.lat!, dto.lon!) } : {}),
        },
      });
      if (moved) await this.geo.setSiteLocation(siteId, { lat: dto.lat!, lon: dto.lon! }, tx);
    });
    return this.get(userId, siteId);
  }

  /** Arxivlash: hisoblar snapshotlari saqlanib qoladi (TZ 7: soft delete). */
  async archive(userId: string, siteId: string) {
    await this.ownSite(userId, siteId);
    await this.db.customerSite.update({ where: { id: siteId }, data: { archivedAt: new Date() } });
    await this.db.auditLog.create({ data: { actorId: userId, action: 'SITE_ARCHIVED', targetType: 'CustomerSite', targetId: siteId } });
    return { id: siteId, archived: true };
  }

  private figures(projected: number, roofShape: RoofShape, tiltDeg: number | null | undefined, usableFactor: number | undefined) {
    const factor = usableFactor ?? defaultUsableFactor(roofShape);
    return { factor, ...areaFigures(projected, roofShape, tiltDeg, factor) };
  }

  async addArea(userId: string, siteId: string, dto: SiteAreaDto) {
    await this.ownSite(userId, siteId);
    const polygon = normalizePolygon(dto.polygon);
    const roofShape = dto.roofShape ?? 'FLAT';
    const projected = await this.geo.measurePolygon(polygon);
    const values = this.figures(projected, roofShape, dto.tiltDeg, dto.usableFactor);
    const areaId = await this.db.$transaction((tx) =>
      this.geo.insertArea(tx, siteId, polygon, {
        name: dto.name.trim(),
        areaType: dto.areaType ?? 'ROOF',
        roofShape,
        projectedAreaM2: values.projectedAreaM2,
        surfaceAreaM2: values.surfaceAreaM2,
        usableFactor: values.factor,
        usableAreaM2: values.usableAreaM2,
        azimuthDeg: dto.azimuthDeg ?? null,
        tiltDeg: roofShape === 'PITCHED' ? (dto.tiltDeg ?? 30) : (dto.tiltDeg ?? null),
        shadingLevel: dto.shadingLevel ?? 'NONE',
      }),
    );
    return this.areaResult(siteId, areaId);
  }

  /** Har o‘zgarishda maydonlar serverda qayta hisoblanadi (TZ 12). */
  async updateArea(userId: string, siteId: string, areaId: string, dto: UpdateSiteAreaDto) {
    await this.ownSite(userId, siteId);
    const current = await this.db.siteArea.findFirst({ where: { id: areaId, siteId } });
    if (!current) throw new NotFoundException(ERRORS.SITE_AREA_NOT_FOUND);
    const polygon = dto.polygon ? normalizePolygon(dto.polygon) : null;
    const projected = polygon ? await this.geo.measurePolygon(polygon) : Number(current.projectedAreaM2);
    const roofShape = dto.roofShape ?? current.roofShape;
    const tiltDeg = dto.tiltDeg === undefined ? (current.tiltDeg === null ? null : Number(current.tiltDeg)) : dto.tiltDeg;
    const keepFactor = dto.usableFactor ?? (dto.roofShape && dto.roofShape !== current.roofShape ? undefined : Number(current.usableFactor));
    const values = this.figures(projected, roofShape, tiltDeg, keepFactor);
    await this.db.$transaction(async (tx) => {
      if (polygon) await this.geo.writeAreaPolygon(areaId, polygon, tx);
      await tx.siteArea.update({
        where: { id: areaId },
        data: {
          name: dto.name?.trim(),
          areaType: dto.areaType,
          roofShape,
          tiltDeg: roofShape === 'PITCHED' ? (tiltDeg ?? 30) : tiltDeg,
          azimuthDeg: dto.azimuthDeg,
          shadingLevel: dto.shadingLevel,
          projectedAreaM2: values.projectedAreaM2,
          surfaceAreaM2: values.surfaceAreaM2,
          usableFactor: values.factor,
          usableAreaM2: values.usableAreaM2,
        },
      });
    });
    return this.areaResult(siteId, areaId);
  }

  async deleteArea(userId: string, siteId: string, areaId: string) {
    await this.ownSite(userId, siteId);
    const result = await this.db.siteArea.deleteMany({ where: { id: areaId, siteId } });
    if (!result.count) throw new NotFoundException(ERRORS.SITE_AREA_NOT_FOUND);
    return { id: areaId, deleted: true };
  }

  private async areaResult(siteId: string, areaId: string) {
    const [area, polygons] = await Promise.all([this.db.siteArea.findUniqueOrThrow({ where: { id: areaId }, select: AREA_SELECT }), this.geo.areaGeometries([siteId])]);
    return { ...area, polygon: polygons.get(areaId) ?? null };
  }
}
