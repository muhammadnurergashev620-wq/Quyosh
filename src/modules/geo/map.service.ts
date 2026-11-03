import { ProviderStatsService } from '../ops/provider-stats.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { ShopService } from '../shop/shop.service';
import { GeoRepository } from './geo.repository';
import { BboxQueryDto, ServingQueryDto } from './dto/geo.dto';

/** Klasterlash chegarasi (TZ 9.8): zoom < 13 — klasterlar, aks holda markerlar. */
export const CLUSTER_MAX_ZOOM = 13;

@Injectable()
export class MapService {
  constructor(
    private readonly db: PrismaService,
    private readonly geo: GeoRepository,
    private readonly config: ConfigService,
    private readonly stats: ProviderStatsService,
  ) {}

  /**
   * Frontend xarita sozlamasi (TZ 12.1). Esri kaliti referrer bilan cheklangan public kalit — brauzerga beriladi.
   * Kalit bo‘lmasa: zaxira OSM uslubi, sun’iy yo‘ldosh qatlami yo‘q.
   */
  mapConfig() {
    const key = process.env.MAP_TILE_API_KEY?.trim() || '';
    const esri = (process.env.MAP_TILE_PROVIDER ?? 'ESRI') === 'ESRI' && !!key;
    // Basemap plitkalari brauzerdan to‘g‘ridan-to‘g‘ri yuklanadi — server xarita sessiyalarini (konfiguratsiya so‘rovlari) hisoblaydi.
    if (esri) this.stats.record('ESRI_BASEMAP', true);
    return {
      provider: esri ? 'ESRI' : 'FALLBACK',
      apiKey: esri ? key : null,
      basemapStyle: process.env.MAP_BASEMAP_STYLE || 'arcgis/streets',
      satelliteStyle: process.env.MAP_SATELLITE_STYLE || 'arcgis/imagery',
      fallbackStyleUrl: process.env.MAP_FALLBACK_STYLE_URL || null,
      satelliteAvailable: esri,
      geocodingAvailable: !!(process.env.GEOCODING_API_KEY?.trim() || key),
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      environment: this.config.get<string>('app.environment'),
    };
  }

  async shops(query: BboxQueryDto) {
    const bbox = { west: query.west, south: query.south, east: query.east, north: query.north };
    if (query.zoom < CLUSTER_MAX_ZOOM) {
      const rows = await this.geo.mapClusters(bbox, query.zoom, query.serviceType);
      return { mode: 'clusters' as const, items: rows.map((row) => ({ lat: row.lat, lon: row.lon, count: Number(row.count), branchId: row.branch_id })) };
    }
    const rows = await this.geo.mapMarkers(bbox, query.serviceType);
    return {
      mode: 'markers' as const,
      truncated: rows.length >= 500,
      items: rows.map((row) => ({ branchId: row.branch_id, branchName: row.branch_name, lat: row.lat, lon: row.lon, shop: { id: row.shop_id, slug: row.slug, name: row.name, ratingAvg: row.rating_avg.toString(), ratingCount: row.rating_count, logoAssetId: row.logo_asset_id } })),
    };
  }

  /** Marker mini-card (TZ 9.8). */
  async shopCard(shopId: string) {
    const shop = await this.db.shop.findFirst({
      where: { ...ShopService.publicWhere(), id: shopId },
      select: {
        id: true, slug: true, name: true, ratingAvg: true, ratingCount: true, avgResponseMinutes: true, logoAssetId: true,
        services: { where: { active: true }, select: { serviceType: true }, distinct: ['serviceType'] },
        branches: { where: { archivedAt: null, status: 'ACTIVE' }, select: { id: true, name: true, address: true, openingHoursJson: true } },
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
    });
    if (!shop) throw new NotFoundException(ERRORS.SHOP_NOT_FOUND);
    const { services, _count, ...rest } = shop;
    return { ...rest, serviceTypes: services.map((item) => item.serviceType), productCount: _count.products };
  }

  async serving(query: ServingQueryDto) {
    const rows = await this.geo.servingShops({ lat: query.lat, lon: query.lon }, query.serviceType);
    return rows.map((row) => ({ id: row.shop_id, slug: row.slug, name: row.name, ratingAvg: row.rating_avg.toString(), ratingCount: row.rating_count, logoAssetId: row.logo_asset_id, distanceKm: Math.round(row.distance_m / 100) / 10 }));
  }
}
