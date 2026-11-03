import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, Role } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { DomainException } from '../../common/exceptions/business.exception';
import { PROVIDERS, ProviderStatsService, type Provider } from './provider-stats.service';

const LIMIT_ENV: Record<Provider, string> = {
  ESRI_GEOCODE: 'ESRI_GEOCODE_MONTHLY_LIMIT', ESRI_BASEMAP: 'ESRI_BASEMAP_MONTHLY_LIMIT', PVGIS: 'PVGIS_MONTHLY_LIMIT',
  NASA_POWER: 'NASA_POWER_MONTHLY_LIMIT', SMS: 'SMS_MONTHLY_LIMIT', EMAIL: 'EMAIL_MONTHLY_LIMIT',
};
/** Esri bepul tarifi: geocoding 20 000/oy; boshqalar — env bilan (berilmasa limit yo‘q). */
const DEFAULT_LIMIT: Partial<Record<Provider, number>> = { ESRI_GEOCODE: 20_000 };

export interface AlertmanagerPayload {
  alerts?: Array<{ status?: string; labels?: Record<string, string>; annotations?: Record<string, string>; startsAt?: string; endsAt?: string; fingerprint?: string }>;
}
export interface DeployPayload {
  service: string; environment: string; version: string; gitSha?: string; status: string; startedAt?: string; finishedAt?: string; triggeredBy?: string; changelogUrl?: string;
}

/** Provayder kvotalari, alertlar va deploylar (TZ 7.7 Ops*, 9.11 admin/ops, 19.1). */
@Injectable()
export class OpsService {
  private readonly logger = new Logger(OpsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly stats: ProviderStatsService,
    private readonly outbox: OutboxService,
  ) {}

  limitOf(provider: Provider): number | null {
    const raw = Number(process.env[LIMIT_ENV[provider]]);
    return Number.isFinite(raw) && raw > 0 ? raw : (DEFAULT_LIMIT[provider] ?? null);
  }

  /** Jonli holat: oylik ishlatilgan, limit, ulush, bugungi muvaffaqiyat foizi. */
  async providers() {
    return Promise.all(PROVIDERS.map(async (provider) => {
      const c = await this.stats.counters(provider);
      const used = c.month.ok + c.month.fail;
      const limit = this.limitOf(provider);
      const todayTotal = c.day.ok + c.day.fail;
      return {
        provider, used, limit, usage: limit ? Math.round((used / limit) * 1000) / 10 : null,
        today: { ok: c.day.ok, fail: c.day.fail, successRate: todayTotal ? Math.round((c.day.ok / todayTotal) * 1000) / 10 : null },
        state: todayTotal >= 5 && c.day.fail / todayTotal > 0.5 ? 'DEGRADED' : 'OK',
      };
    }));
  }

  /** provider-quota-poll (har 15 daqiqa): snapshot + 80 % / 95 % alert (oyiga bir marta har bosqich). */
  @Cron('*/15 * * * *', { name: 'provider-quota-poll' })
  async pollQuotas(now = new Date()) {
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rows = await this.providers();
    let alerts = 0;
    for (const r of rows) {
      await this.db.providerQuotaSnapshot.create({ data: { provider: r.provider, metric: 'requests_month', used: r.used, limit: r.limit, failures: (await this.stats.counters(r.provider as Provider)).month.fail, periodStart } });
      if (!r.limit || r.usage === null) continue;
      const level = r.usage >= 95 ? 'CRITICAL' : r.usage >= 80 ? 'WARNING' : null;
      if (!level) continue;
      const created = await this.raiseAlert({ fingerprint: `quota:${r.provider}:${level}`, alertName: `${r.provider} kvotasi ${level === 'CRITICAL' ? '95' : '80'} %`, severity: level, startsAt: periodStart, summary: `${r.provider}: ${r.used} / ${r.limit} (${r.usage} %) — oy boshidan`, labels: { provider: r.provider } });
      if (created) alerts += 1;
    }
    return { snapshots: rows.length, alerts };
  }

  /** Yangi alert (fingerprint+startsAt bo‘yicha bir marta) — Super Admin’larga in-app OPS_ALERT. */
  async raiseAlert(input: { fingerprint: string; alertName: string; severity: string; startsAt: Date; summary: string; labels?: Record<string, string>; status?: string; endsAt?: Date | null }) {
    const existing = await this.db.opsAlertEvent.findUnique({ where: { fingerprint_startsAt: { fingerprint: input.fingerprint, startsAt: input.startsAt } } });
    if (existing) {
      if (input.status && input.status !== existing.status) await this.db.opsAlertEvent.update({ where: { id: existing.id }, data: { status: input.status, endsAt: input.endsAt ?? null } });
      return false;
    }
    await this.db.$transaction(async (tx) => {
      const alert = await tx.opsAlertEvent.create({ data: { fingerprint: input.fingerprint, alertName: input.alertName.slice(0, 120), severity: input.severity, status: input.status ?? 'FIRING', startsAt: input.startsAt, endsAt: input.endsAt ?? null, summary: input.summary.slice(0, 1000), labelsJson: (input.labels ?? {}) as Prisma.InputJsonValue } });
      if ((input.status ?? 'FIRING') !== 'FIRING') return;
      const admins = await tx.user.findMany({ where: { isSuperAdmin: true, deletedAt: null, userRoles: { some: { role: Role.ADMIN } } }, select: { id: true } });
      for (const a of admins) {
        await this.outbox.emit(tx, { eventName: 'OPS_ALERT', aggregateType: 'OpsAlertEvent', aggregateId: alert.id, payload: { userId: a.id, title: `${input.severity === 'CRITICAL' ? 'Kritik' : 'Ogohlantirish'}: ${input.alertName}`, body: input.summary.slice(0, 300), entityId: alert.id } });
      }
    });
    return true;
  }

  // ───────────── Webhooklar (HMAC) ─────────────

  verifySignature(raw: Buffer | undefined, signature: string | undefined) {
    const secret = process.env.OPS_WEBHOOK_SECRET;
    if (!secret || !raw || !signature) throw new DomainException(HttpStatus.UNAUTHORIZED, 'WEBHOOK_SIGNATURE_INVALID', 'Webhook imzosi noto‘g‘ri');
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const given = signature.replace(/^sha256=/, '');
    if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      throw new DomainException(HttpStatus.UNAUTHORIZED, 'WEBHOOK_SIGNATURE_INVALID', 'Webhook imzosi noto‘g‘ri');
    }
  }

  async alertmanager(payload: AlertmanagerPayload) {
    let n = 0;
    // Alertmanager guruhlari odatda kichik; katta yoki noto‘g‘ri payload bazani to‘ldirmasin.
    const alerts = Array.isArray(payload.alerts) ? payload.alerts.slice(0, 100) : [];
    const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
    const date = (v: unknown) => { const d = typeof v === 'string' ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
    for (const a of alerts) {
      if (!a || typeof a !== 'object') continue;
      // Faqat satr qiymatli yorliqlar (Alertmanager formati), hajmi cheklangan.
      const labels = Object.fromEntries(Object.entries(a.labels && typeof a.labels === 'object' ? a.labels : {}).filter(([, v]) => typeof v === 'string').slice(0, 30).map(([k, v]) => [k.slice(0, 60), (v as string).slice(0, 300)]));
      const severity = (labels.severity ?? 'WARNING').toUpperCase();
      const alertName = labels.alertname || 'alert';
      const resolved = a.status === 'resolved';
      await this.raiseAlert({
        fingerprint: (text(a.fingerprint, 120) || `${alertName}:${labels.instance ?? ''}`).slice(0, 120), alertName, severity: ['CRITICAL', 'WARNING', 'INFO'].includes(severity) ? severity : 'WARNING',
        startsAt: date(a.startsAt) ?? new Date(), summary: (text(a.annotations?.summary, 500) || text(a.annotations?.description, 500) || alertName), labels, status: resolved ? 'RESOLVED' : 'FIRING',
        endsAt: resolved ? date(a.endsAt) : null,
      });
      n += 1;
    }
    return { received: n };
  }

  async deploy(p: DeployPayload) {
    const startedAt = p.startedAt ? new Date(p.startedAt) : new Date();
    const existing = await this.db.opsDeployment.findFirst({ where: { service: p.service, environment: p.environment, version: p.version }, orderBy: { startedAt: 'desc' } });
    const data = { status: p.status.toUpperCase().slice(0, 20), gitSha: p.gitSha ?? null, finishedAt: p.finishedAt ? new Date(p.finishedAt) : ['SUCCEEDED', 'FAILED', 'ROLLED_BACK'].includes(p.status.toUpperCase()) ? new Date() : null, triggeredBy: p.triggeredBy ?? null, changelogUrl: p.changelogUrl ?? null };
    const row = existing
      ? await this.db.opsDeployment.update({ where: { id: existing.id }, data })
      : await this.db.opsDeployment.create({ data: { service: p.service.slice(0, 20), environment: p.environment.slice(0, 20), version: p.version.slice(0, 60), startedAt, ...data } });
    if (row.status === 'FAILED') await this.raiseAlert({ fingerprint: `deploy:${row.id}`, alertName: `Deploy xatosi: ${row.service}`, severity: 'CRITICAL', startsAt: row.startedAt, summary: `${row.service} ${row.version} (${row.environment}) deploy muvaffaqiyatsiz` });
    return { id: row.id, status: row.status };
  }

  deployments() {
    return this.db.opsDeployment.findMany({ orderBy: { startedAt: 'desc' }, take: 50 });
  }

  alerts(status?: string) {
    return this.db.opsAlertEvent.findMany({ where: status ? { status } : {}, orderBy: { startsAt: 'desc' }, take: 100 });
  }

  async ack(adminId: string, id: string) {
    await this.db.$transaction([
      this.db.opsAlertEvent.update({ where: { id }, data: { acknowledgedBy: adminId, acknowledgedAt: new Date() } }),
      this.db.auditLog.create({ data: { actorId: adminId, action: 'OPS_ALERT_ACK', targetType: 'OpsAlertEvent', targetId: id } }),
    ]);
    return { acknowledged: true };
  }

  async snapshots(provider?: string) {
    return this.db.providerQuotaSnapshot.findMany({ where: provider ? { provider } : {}, orderBy: { capturedAt: 'desc' }, take: 200 });
  }
}
