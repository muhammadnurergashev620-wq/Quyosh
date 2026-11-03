import { ProviderStatsService } from '../ops/provider-stats.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ERRORS } from '../../common/constants/error-messages';
import { DomainException } from '../../common/exceptions/business.exception';

const ESRI = 'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer';

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
  score?: number;
}

const unavailable = () => new DomainException(HttpStatus.SERVICE_UNAVAILABLE, 'GEOCODING_UNAVAILABLE', ERRORS.GEOCODING_UNAVAILABLE);

/**
 * Esri geocoding adapteri (TZ 12.1): forStorage=false — natija serverda saqlanmaydi va keshlanmaydi.
 * Kalit yo‘q yoki limit tugagan bo‘lsa — 503 (frontend pin/koordinata rejimiga o‘tadi).
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly stats: ProviderStatsService) {}

  private key() {
    return process.env.GEOCODING_API_KEY?.trim() || process.env.MAP_TILE_API_KEY?.trim() || '';
  }

  private async call(path: string, params: Record<string, string>) {
    const key = this.key();
    if (!key) throw unavailable();
    const url = new URL(`${ESRI}/${path}`);
    for (const [name, value] of Object.entries({ ...params, f: 'json', forStorage: 'false', token: key })) url.searchParams.set(name, value);
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      this.stats.record('ESRI_GEOCODE', response.ok);
    } catch (error) {
      this.stats.record('ESRI_GEOCODE', false);
      this.logger.warn(`Esri geocoding xatosi: ${(error as Error).message}`);
      throw unavailable();
    }
    const body = (await response.json().catch(() => ({}))) as { error?: { code?: number; message?: string } } & Record<string, unknown>;
    if (!response.ok || body.error) {
      const code = body.error?.code ?? response.status;
      if (code === 429 || code === 403 || code === 498 || code === 499) {
        this.logger.warn(`Esri geocoding limiti/kaliti: ${code} ${body.error?.message ?? ''}`);
        throw new DomainException(HttpStatus.SERVICE_UNAVAILABLE, 'MAP_QUOTA_EXCEEDED', ERRORS.MAP_QUOTA_EXCEEDED);
      }
      throw unavailable();
    }
    return body;
  }

  async search(q: string, lang: 'uz' | 'ru' = 'uz'): Promise<GeocodeResult[]> {
    const body = (await this.call('findAddressCandidates', { SingleLine: q, countryCode: 'UZB', langCode: lang, maxLocations: '6', outFields: 'Match_addr' })) as {
      candidates?: Array<{ address: string; location: { x: number; y: number }; score: number }>;
    };
    return (body.candidates ?? []).map((item) => ({ label: item.address, lat: item.location.y, lon: item.location.x, score: item.score }));
  }

  async reverse(lat: number, lon: number, lang: 'uz' | 'ru' = 'uz'): Promise<GeocodeResult | null> {
    const body = (await this.call('reverseGeocode', { location: `${lon},${lat}`, langCode: lang })) as { address?: { LongLabel?: string; Match_addr?: string } };
    const label = body.address?.LongLabel ?? body.address?.Match_addr;
    return label ? { label, lat, lon } : null;
  }
}
