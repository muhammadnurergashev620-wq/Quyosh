import { Injectable } from '@nestjs/common';
import { Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { clusterGridDeg, type MultiPolygonGeometry, type PolygonGeometry, polygonInvalid, polygonTooLarge } from './geojson';

type Db = Prisma.TransactionClient | PrismaService;

export interface Bbox { west: number; south: number; east: number; north: number }
export interface LatLon { lat: number; lon: number }

/** Mijoz maydoni (TZ 10.1) va xizmat hududi chegaralari. */
export const MAX_SITE_AREA_M2 = 50_000;
export const MAX_SERVICE_AREA_KM2 = 20_000;

/** Ochiq do‘kon filiali sharti (TZ 3.5: faqat ACTIVE + VERIFIED). */
const PUBLIC_BRANCH = Prisma.sql`
  s.status = 'ACTIVE' AND s.verification_status = 'VERIFIED' AND s.archived_at IS NULL
  AND b.archived_at IS NULL AND b.status = 'ACTIVE' AND b.location IS NOT NULL`;

const serviceFilter = (serviceType?: ServiceType) =>
  serviceType
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM services sv WHERE sv.shop_id = s.id AND sv.active AND sv.service_type = ${serviceType}::"ServiceType")`
    : Prisma.empty;

/**
 * PostGIS ustunlariga barcha yozish/o‘qish shu yerda (TZ 7: Unsupported() ustunlar faqat parametrli $queryRaw orqali).
 * Geometriyani server o‘zi tekshiradi (ST_IsValid) va maydonni o‘zi hisoblaydi — klient qiymati faqat preview.
 */
@Injectable()
export class GeoRepository {
  constructor(private readonly db: PrismaService) {}

  // ───────────── Filial nuqtasi ─────────────

  async setBranchLocation(branchId: string, point: LatLon | null, db: Db = this.db) {
    if (!point) {
      await db.$executeRaw`UPDATE shop_branches SET location = NULL WHERE id = ${branchId}::uuid`;
      return;
    }
    await db.$executeRaw`UPDATE shop_branches SET location = ST_SetSRID(ST_MakePoint(${point.lon}, ${point.lat}), 4326)::geography WHERE id = ${branchId}::uuid`;
  }

  async branchPoints(branchIds: string[]): Promise<Map<string, LatLon & { hasServiceArea: boolean }>> {
    if (!branchIds.length) return new Map();
    const rows = await this.db.$queryRaw<Array<{ id: string; lat: number | null; lon: number | null; has_area: boolean }>>`
      SELECT b.id, ST_Y(b.location::geometry) AS lat, ST_X(b.location::geometry) AS lon,
             EXISTS (SELECT 1 FROM service_areas a WHERE a.branch_id = b.id AND a.active) AS has_area
      FROM shop_branches b WHERE b.id IN (${Prisma.join(branchIds.map((id) => Prisma.sql`${id}::uuid`))})`;
    return new Map(rows.filter((row) => row.lat !== null).map((row) => [row.id, { lat: row.lat!, lon: row.lon!, hasServiceArea: row.has_area }]));
  }

  // ───────────── Xizmat hududi ─────────────

  /** GeoJSON MultiPolygon → tekshirish va maydon (km²). */
  private async measureMultiPolygon(geometry: MultiPolygonGeometry, db: Db) {
    const [row] = await db.$queryRaw<Array<{ valid: boolean; km2: number }>>`
      SELECT ST_IsValid(g) AS valid, ST_Area(g::geography) / 1e6 AS km2
      FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326) AS g) t`;
    if (!row?.valid) throw polygonInvalid();
    if (row.km2 > MAX_SERVICE_AREA_KM2) throw polygonTooLarge(`Xizmat hududi ${MAX_SERVICE_AREA_KM2.toLocaleString('ru-RU')} km² dan oshmasligi kerak`);
    if (row.km2 <= 0) throw polygonInvalid();
    return row.km2;
  }

  /** Filialning yagona faol xizmat hududini almashtiradi. */
  async replaceServiceArea(branchId: string, geometry: MultiPolygonGeometry, serviceTypes: ServiceType[], db: Db = this.db) {
    const km2 = await this.measureMultiPolygon(geometry, db);
    await db.$executeRaw`DELETE FROM service_areas WHERE branch_id = ${branchId}::uuid`;
    const types = serviceTypes.length ? Prisma.sql`ARRAY[${Prisma.join(serviceTypes.map((type) => Prisma.sql`${type}::"ServiceType"`))}]` : Prisma.sql`ARRAY[]::"ServiceType"[]`;
    const [row] = await db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO service_areas (id, branch_id, geom, area_km2, service_types, active, "updatedAt")
      VALUES (gen_random_uuid(), ${branchId}::uuid, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326)::geography,
              ${Math.round(km2 * 1000) / 1000}, ${types}, true, now())
      RETURNING id`;
    return { id: row!.id, areaKm2: Math.round(km2 * 1000) / 1000 };
  }

  /** Filial nuqtasi atrofida radius bo‘yicha hudud (U11.8 tez tanlov). 64 segmentli doira. */
  async radiusGeometry(branchId: string, radiusKm: number, db: Db = this.db): Promise<MultiPolygonGeometry | null> {
    const [row] = await db.$queryRaw<Array<{ geojson: string | null }>>`
      SELECT ST_AsGeoJSON(ST_Multi(ST_Buffer(location, ${radiusKm * 1000}, 16)::geometry), 6) AS geojson
      FROM shop_branches WHERE id = ${branchId}::uuid AND location IS NOT NULL`;
    return row?.geojson ? (JSON.parse(row.geojson) as MultiPolygonGeometry) : null;
  }

  async serviceAreas(branchIds: string[]) {
    if (!branchIds.length) return [];
    return this.db.$queryRaw<Array<{ id: string; branch_id: string; area_km2: Prisma.Decimal; service_types: ServiceType[]; active: boolean; geojson: string }>>`
      SELECT id, branch_id, area_km2, service_types, active, ST_AsGeoJSON(geom, 6) AS geojson
      FROM service_areas WHERE branch_id IN (${Prisma.join(branchIds.map((id) => Prisma.sql`${id}::uuid`))})`;
  }

  async deleteServiceArea(branchId: string) {
    return this.db.$executeRaw`DELETE FROM service_areas WHERE branch_id = ${branchId}::uuid`;
  }

  // ───────────── Ochiq xarita ─────────────

  /** zoom < 13: server klasterlari (ST_SnapToGrid), aks holda markerlar (max 500) — TZ 9.8, 12. */
  async mapClusters(bbox: Bbox, zoom: number, serviceType?: ServiceType) {
    const grid = clusterGridDeg(zoom);
    return this.db.$queryRaw<Array<{ lat: number; lon: number; count: bigint; branch_id: string | null }>>`
      SELECT ST_Y(ST_Centroid(ST_Collect(b.location::geometry))) AS lat,
             ST_X(ST_Centroid(ST_Collect(b.location::geometry))) AS lon,
             COUNT(*) AS count,
             CASE WHEN COUNT(*) = 1 THEN (array_agg(b.id))[1] ELSE NULL END AS branch_id
      FROM shop_branches b JOIN shops s ON s.id = b.shop_id
      WHERE ${PUBLIC_BRANCH}
        AND b.location && ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)::geography
        ${serviceFilter(serviceType)}
      GROUP BY ST_SnapToGrid(b.location::geometry, ${grid})
      LIMIT 2000`;
  }

  async mapMarkers(bbox: Bbox, serviceType?: ServiceType, limit = 500) {
    return this.db.$queryRaw<Array<{ branch_id: string; branch_name: string; lat: number; lon: number; shop_id: string; slug: string; name: string; rating_avg: Prisma.Decimal; rating_count: number; logo_asset_id: string | null }>>`
      SELECT b.id AS branch_id, b.name AS branch_name, ST_Y(b.location::geometry) AS lat, ST_X(b.location::geometry) AS lon,
             s.id AS shop_id, s.slug, s.name, s.rating_avg, s.rating_count, s.logo_asset_id
      FROM shop_branches b JOIN shops s ON s.id = b.shop_id
      WHERE ${PUBLIC_BRANCH}
        AND b.location && ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)::geography
        ${serviceFilter(serviceType)}
      ORDER BY s.rating_avg DESC, b.id
      LIMIT ${limit}`;
  }

  /** Nuqtaga xizmat ko‘rsatadigan do‘konlar (ST_Covers), eng yaqin filial masofasi bilan (KNN). */
  async servingShops(point: LatLon, serviceType?: ServiceType, limit = 50) {
    const typeFilter = serviceType ? Prisma.sql`AND (cardinality(a.service_types) = 0 OR ${serviceType}::"ServiceType" = ANY(a.service_types))` : Prisma.empty;
    return this.db.$queryRaw<Array<{ shop_id: string; slug: string; name: string; rating_avg: Prisma.Decimal; rating_count: number; logo_asset_id: string | null; distance_m: number }>>`
      WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${point.lon}, ${point.lat}), 4326)::geography AS g)
      SELECT s.id AS shop_id, s.slug, s.name, s.rating_avg, s.rating_count, s.logo_asset_id,
             MIN(ST_Distance(b.location, p.g)) AS distance_m
      FROM service_areas a
      JOIN shop_branches b ON b.id = a.branch_id
      JOIN shops s ON s.id = b.shop_id, p
      WHERE a.active AND ${PUBLIC_BRANCH} AND ST_Covers(a.geom, p.g) ${typeFilter}
      GROUP BY s.id
      ORDER BY distance_m ASC
      LIMIT ${limit}`;
  }

  /** Eng yaqin ochiq filiallar (ST_DWithin + KNN <->). */
  async nearestShops(point: LatLon, radiusKm: number, serviceType?: ServiceType, limit = 50) {
    return this.db.$queryRaw<Array<{ shop_id: string; distance_m: number }>>`
      WITH p AS (SELECT ST_SetSRID(ST_MakePoint(${point.lon}, ${point.lat}), 4326)::geography AS g)
      SELECT shop_id, MIN(distance_m) AS distance_m FROM (
        SELECT s.id AS shop_id, ST_Distance(b.location, p.g) AS distance_m
        FROM shop_branches b JOIN shops s ON s.id = b.shop_id, p
        WHERE ${PUBLIC_BRANCH} AND ST_DWithin(b.location, p.g, ${radiusKm * 1000}) ${serviceFilter(serviceType)}
        ORDER BY b.location <-> p.g
        LIMIT ${limit * 3}
      ) near GROUP BY shop_id ORDER BY distance_m LIMIT ${limit}`;
  }

  // ───────────── Mijoz obyektlari ─────────────

  async setSiteLocation(siteId: string, point: LatLon, db: Db = this.db) {
    await db.$executeRaw`UPDATE customer_sites SET location = ST_SetSRID(ST_MakePoint(${point.lon}, ${point.lat}), 4326)::geography WHERE id = ${siteId}::uuid`;
  }

  async insertSite(db: Db, data: { userId: string; title: string; siteType: string; address: string | null; notes: string | null; regionCode: string | null; point: LatLon }) {
    const [row] = await db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO customer_sites (id, user_id, title, site_type, address, notes, region_code, location, "updatedAt")
      VALUES (gen_random_uuid(), ${data.userId}::uuid, ${data.title}, ${data.siteType}::"SiteType", ${data.address}, ${data.notes}, ${data.regionCode},
              ST_SetSRID(ST_MakePoint(${data.point.lon}, ${data.point.lat}), 4326)::geography, now())
      RETURNING id`;
    return row!.id;
  }

  async sitePoints(siteIds: string[]): Promise<Map<string, LatLon>> {
    if (!siteIds.length) return new Map();
    const rows = await this.db.$queryRaw<Array<{ id: string; lat: number; lon: number }>>`
      SELECT id, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon FROM customer_sites
      WHERE id IN (${Prisma.join(siteIds.map((id) => Prisma.sql`${id}::uuid`))})`;
    return new Map(rows.map((row) => [row.id, { lat: row.lat, lon: row.lon }]));
  }

  /** Poligonni tekshiradi va geodezik maydonni (m²) qaytaradi; markaz va eng uzun qirra yo‘nalishi ham (layout uchun). */
  async measurePolygon(geometry: PolygonGeometry, db: Db = this.db) {
    const [row] = await db.$queryRaw<Array<{ valid: boolean; m2: number; reason: string }>>`
      SELECT ST_IsValid(g) AS valid, ST_IsValidReason(g) AS reason, ST_Area(g::geography) AS m2
      FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326) AS g) t`;
    if (!row?.valid) throw polygonInvalid();
    if (row.m2 > MAX_SITE_AREA_M2) throw polygonTooLarge(`Maydon ${MAX_SITE_AREA_M2.toLocaleString('ru-RU')} m² dan oshmasligi kerak`);
    if (row.m2 < 1) throw polygonInvalid();
    return row.m2;
  }

  async writeAreaPolygon(areaId: string, geometry: PolygonGeometry, db: Db) {
    await db.$executeRaw`UPDATE site_areas SET polygon = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326) WHERE id = ${areaId}::uuid`;
  }

  async insertArea(db: Db, siteId: string, geometry: PolygonGeometry, values: { name: string; areaType: string; roofShape: string; projectedAreaM2: number; surfaceAreaM2: number; usableFactor: number; usableAreaM2: number; azimuthDeg: number | null; tiltDeg: number | null; shadingLevel: string }) {
    const [row] = await db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO site_areas (id, site_id, name, area_type, roof_shape, polygon, projected_area_m2, surface_area_m2, usable_factor, usable_area_m2, azimuth_deg, tilt_deg, shading_level, "updatedAt")
      VALUES (gen_random_uuid(), ${siteId}::uuid, ${values.name}, ${values.areaType}::"AreaType", ${values.roofShape}::"RoofShape",
              ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326), ${values.projectedAreaM2}, ${values.surfaceAreaM2}, ${values.usableFactor},
              ${values.usableAreaM2}, ${values.azimuthDeg}, ${values.tiltDeg}, ${values.shadingLevel}::"ShadingLevel", now())
      RETURNING id`;
    return row!.id;
  }

  async areaGeometries(siteIds: string[]) {
    if (!siteIds.length) return new Map<string, PolygonGeometry>();
    const rows = await this.db.$queryRaw<Array<{ id: string; geojson: string }>>`
      SELECT id, ST_AsGeoJSON(polygon, 7) AS geojson FROM site_areas WHERE site_id IN (${Prisma.join(siteIds.map((id) => Prisma.sql`${id}::uuid`))})`;
    return new Map(rows.map((row) => [row.id, JSON.parse(row.geojson) as PolygonGeometry]));
  }
}
