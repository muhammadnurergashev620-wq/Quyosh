import { BadRequestException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PolicyStatus, PolicyType, Prisma, UserStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { REGIONS } from '../../common/constants/regions';
import { DomainException } from '../../common/exceptions/business.exception';
import type { ShopContext } from '../../common/decorators/shop-permission.decorator';
import { normalizeUzPhone } from '../../common/utils/phone';
import { CalcService } from '../calc/calc.service';
import { CalculationsService } from '../calc/calculations.service';
import { OtpService } from '../otp/otp.service';
import { QuoteRequestService } from '../quote-request/quote-request.service';
import { AnalyticsService } from '../analytics/analytics.service';
import type { WidgetConfigDto, WidgetEstimateDto, WidgetLeadDto } from './dto/shop-content.dto';

export interface WidgetTheme {
  primaryColor: string;
  title: string;
  lang: 'uz' | 'oz' | 'ru';
  showLogo: boolean;
}

const HOST = /^(?=.{1,253}$)(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** WCAG nisbiy yorqinlik va oq matn bilan kontrast (U11.13: 4,5:1 dan past — ogohlantirish va yaqin mos rang). */
function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export function contrastWithWhite(hex: string) {
  return Math.round(((1.05 / (luminance(hex) + 0.05)) * 100)) / 100;
}
export function accessibleColor(hex: string) {
  let rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let out = hex;
  for (let i = 0; i < 40 && contrastWithWhite(out) < 4.5; i += 1) {
    rgb = rgb.map((v) => Math.max(0, Math.round(v * 0.92)));
    out = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  return out;
}

/** Domenni normallashtirish: protokol, yo‘l va portni olib tashlash. */
export function normalizeDomain(raw: string): string | null {
  const host = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '');
  return HOST.test(host) ? host : null;
}

/** Embed vidjet (TZ 4.15, 13.6, U11.13, U13). */
@Injectable()
export class WidgetService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly calc: CalcService,
    private readonly calculations: CalculationsService,
    private readonly otp: OtpService,
    private readonly requests: QuoteRequestService,
    private readonly analytics: AnalyticsService,
  ) {}

  private theme(json: Prisma.JsonValue, shopName: string): WidgetTheme {
    const t = (json ?? {}) as Partial<WidgetTheme>;
    return { primaryColor: t.primaryColor ?? '#1d4ed8', title: t.title ?? shopName, lang: t.lang ?? 'uz', showLogo: t.showLogo ?? true };
  }

  private view(row: { publicKey: string; allowedDomains: string[]; themeJson: Prisma.JsonValue; active: boolean }, shopName: string) {
    const theme = this.theme(row.themeJson, shopName);
    const contrast = contrastWithWhite(theme.primaryColor);
    const apiBase = (process.env.PUBLIC_API_URL ?? `http://localhost:${this.config.get('app.port')}`).replace(/\/$/, '');
    return {
      publicKey: row.publicKey,
      allowedDomains: row.allowedDomains,
      active: row.active,
      theme,
      contrast: { ratio: contrast, ok: contrast >= 4.5, suggestion: contrast >= 4.5 ? null : accessibleColor(theme.primaryColor) },
      embed: `<script src="${apiBase}/api/v1/widget/${row.publicKey}/embed.js" async></script>`,
      frameUrl: `${apiBase}/api/v1/widget/${row.publicKey}/frame`,
    };
  }

  async get(ctx: ShopContext) {
    const shop = await this.db.shop.findUniqueOrThrow({ where: { id: ctx.shopId }, select: { name: true } });
    const row = await this.db.widgetConfig.upsert({ where: { shopId: ctx.shopId }, update: {}, create: { shopId: ctx.shopId, publicKey: randomBytes(12).toString('base64url') } });
    return this.view(row, shop.name);
  }

  async update(ctx: ShopContext, dto: WidgetConfigDto, actorId: string) {
    const current = await this.get(ctx);
    const domains = dto.allowedDomains?.map((d) => {
      const host = normalizeDomain(d);
      if (!host) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'WIDGET_DOMAIN_INVALID', `${ERRORS.WIDGET_DOMAIN_INVALID} (${d})`);
      return host;
    });
    const theme = { ...current.theme, ...(dto.theme ?? {}) };
    const row = await this.db.widgetConfig.update({
      where: { shopId: ctx.shopId },
      data: { ...(domains ? { allowedDomains: [...new Set(domains)] } : {}), ...(dto.active !== undefined ? { active: dto.active } : {}), themeJson: theme as Prisma.InputJsonValue },
    });
    await this.db.auditLog.create({ data: { actorId, action: 'WIDGET_UPDATED', targetType: 'Shop', targetId: ctx.shopId, after: { allowedDomains: row.allowedDomains, active: row.active } } });
    return this.view(row, theme.title);
  }

  // ───────────── Ommaviy (iframe ichidan) ─────────────

  private async byKey(publicKey: string, requireActive = true) {
    const row = await this.db.widgetConfig.findUnique({ where: { publicKey }, include: { shop: { select: { id: true, name: true, slug: true, status: true, verificationStatus: true, archivedAt: true, members: { where: { memberRole: 'OWNER' }, select: { id: true } } } } } });
    const shopOk = row && row.shop.status === 'ACTIVE' && row.shop.verificationStatus === 'VERIFIED' && !row.shop.archivedAt && row.shop.members.length > 0;
    if (!row || !shopOk || (requireActive && !row.active)) throw new NotFoundException(ERRORS.WIDGET_NOT_FOUND);
    return row;
  }

  /** frame-ancestors: ruxsat etilgan domenlar + do‘kon panelining preview’i. Faol bo‘lmasa — faqat preview. */
  async frame(publicKey: string) {
    const row = await this.byKey(publicKey, false);
    const shopPanel = this.config.get<string>('app.shopUrl', '').replace(/\/$/, '');
    const ancestors = [...(row.active ? row.allowedDomains.flatMap((d) => [`https://${d}`, `http://${d}`]) : []), shopPanel].filter(Boolean);
    const theme = this.theme(row.themeJson, row.shop.name);
    const regions = REGIONS.map((r) => ({ key: r.key, name: r.name }));
    return { ancestors, theme: { ...theme, primaryColor: contrastWithWhite(theme.primaryColor) >= 4.5 ? theme.primaryColor : accessibleColor(theme.primaryColor) }, shopName: row.shop.name, regions, platformUrl: this.config.get<string>('app.customerUrl', '') };
  }

  async estimate(publicKey: string, dto: WidgetEstimateDto, anonymousId: string | null) {
    const row = await this.byKey(publicKey, false);
    const region = REGIONS.find((r) => r.key === dto.regionCode);
    if (!region) throw new BadRequestException('Hudud noto‘g‘ri');
    const result = await this.calc.estimate({ mode: 'QUICK', lat: region.lat, lon: region.lon, areaPreset: dto.areaPreset ?? 'MEDIUM', consumption: { monthlyKwh: dto.monthlyKwh } } as never, null);
    await this.analytics.track({ eventType: 'widget_estimate', shopId: row.shop.id, anonymousId, regionCode: region.key });
    return {
      systemPowerKw: result.systemPowerKw,
      systemType: result.systemType,
      annualGenerationKwh: result.generation.annual,
      monthlySaving: result.money.savings === null ? null : Math.round(result.money.savings / 12),
      initialCost: result.money.initialCost,
      simplePaybackYears: result.money.simplePaybackYears,
    };
  }

  async sendOtp(publicKey: string, phone: string, ip: string | null) {
    await this.byKey(publicKey);
    const normalized = normalizeUzPhone(phone);
    if (!normalized) throw new BadRequestException('Telefon raqami noto‘g‘ri');
    const res = await this.otp.issue(normalized, 'PHONE_VERIFICATION', undefined, { ip: ip ?? undefined, panel: 'WIDGET' });
    return { sent: true, resendAfter: res.resendAfter, ...('developmentCode' in res ? { developmentCode: res.developmentCode } : {}) };
  }

  /**
   * Lead (13.6): OTP tasdig‘i → akkaunt (bo‘lmasa yaratiladi, shartlar qabul qilinadi) → hisob saqlanadi →
   * faqat shu do‘konga so‘rov (manba WIDGET). Platformada akkaunt yaratilishi vidjetda aytiladi.
   */
  async lead(publicKey: string, dto: WidgetLeadDto, ip: string | null) {
    const row = await this.byKey(publicKey);
    if (!dto.consent) throw new DomainException(HttpStatus.UNPROCESSABLE_ENTITY, 'POLICY_ACCEPTANCE_MISSING', ERRORS.POLICY_ACCEPTANCE_MISSING);
    const region = REGIONS.find((r) => r.key === dto.regionCode);
    if (!region) throw new BadRequestException('Hudud noto‘g‘ri');
    const phone = normalizeUzPhone(dto.phone);
    if (!phone) throw new BadRequestException('Telefon raqami noto‘g‘ri');
    await this.otp.verify(phone, 'PHONE_VERIFICATION', dto.code);

    let user = await this.db.user.findUnique({ where: { phone }, select: { id: true, status: true, deletedAt: true } });
    let accountCreated = false;
    if (user && (user.deletedAt || user.status === UserStatus.BLOCKED || user.status === UserStatus.DELETED)) throw new DomainException(HttpStatus.FORBIDDEN, 'ACCOUNT_UNAVAILABLE', ERRORS.AUTHENTICATION_REQUIRED);
    if (!user) {
      const policies = await this.db.policyVersion.findMany({ where: { status: PolicyStatus.PUBLISHED, type: { in: [PolicyType.TERMS, PolicyType.PRIVACY, PolicyType.PLATFORM_RULES] } }, select: { id: true } });
      user = await this.db.user.create({
        data: {
          phone, firstName: dto.firstName.trim(), status: UserStatus.ACTIVE, phoneVerifiedAt: new Date(),
          userRoles: { create: { role: 'CUSTOMER' } },
          policies: { create: policies.map((p) => ({ policyId: p.id, ipAddress: ip?.slice(0, 64) ?? null })) },
        },
        select: { id: true, status: true, deletedAt: true },
      });
      accountCreated = true;
    } else if (user.status === UserStatus.PENDING) {
      await this.db.user.update({ where: { id: user.id }, data: { status: UserStatus.ACTIVE, phoneVerifiedAt: new Date() } });
    }
    const saved = await this.calculations.save(user.id, { mode: 'QUICK', lat: region.lat, lon: region.lon, areaPreset: dto.areaPreset ?? 'MEDIUM', consumption: { monthlyKwh: dto.monthlyKwh } } as never, `Vidjet: ${row.shop.name}`);
    const systemType = (saved.result as { systemType?: 'ON_GRID' | 'HYBRID' | 'OFF_GRID' }).systemType ?? 'ON_GRID';
    const request = await this.requests.create(user.id, { calculationId: saved.id, systemType, notes: dto.notes?.trim() || undefined, shopIds: [row.shop.id] }, 'WIDGET');
    await this.analytics.track({ eventType: 'widget_lead', shopId: row.shop.id, userId: user.id, entityId: request.id, regionCode: region.key });
    return { requestNumber: request.number, accountCreated };
  }
}
