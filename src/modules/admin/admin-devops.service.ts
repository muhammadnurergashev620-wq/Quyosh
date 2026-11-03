import { OpsService } from '../ops/ops.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import * as v8 from 'node:v8';
import { RequestRateService, TrafficWindow } from '../../infrastructure/metrics/request-rate.service';
import { SystemMetricsService } from '../../infrastructure/metrics/system-metrics.service';

const execFileAsync = promisify(execFile);

export interface PingResult {
  ok: boolean;
  latencyMs: number | null;
}

export interface DiskUsage {
  totalGB: number;
  usedGB: number;
  freeGB: number;
  usedPercent: number;
}

/** Ilova va server holatini (CPU/RAM/disk, Node jarayoni, versiya, DB/Redis ulanishi, trafik) real vaqtda o'qiydi — admin "DevOps" sahifasi uchun. */
const PROVIDER_LABEL: Record<string, string> = {
  ESRI_GEOCODE: 'Esri geokoder', ESRI_BASEMAP: 'Esri xarita (sessiya)', PVGIS: 'PVGIS', NASA_POWER: 'NASA POWER', SMS: 'SMS', EMAIL: 'Email',
};

@Injectable()
export class AdminDevopsService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly db: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly requestRate: RequestRateService,
    private readonly system: SystemMetricsService,
    private readonly ops: OpsService,
  ) {}

  async snapshot(window: TrafficWindow) {
    const [cpuPercent, disk, database, redisStatus] = await Promise.all([
      this.cpuUsagePercent(),
      this.diskUsage(),
      this.pingDatabase(),
      this.pingRedis(),
    ]);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedMemPercent = Math.round((usedMem / totalMem) * 100);

    const appVersion = this.readVersion();
    const commit = await this.gitCommit();
    const environment = this.config.get<string>('app.environment', 'development');
    const telegramConfigured = !!this.config.get<string>('telegram.botToken') && !!this.config.get<string>('telegram.chatId');
    const metricsTokenSet = !!process.env.METRICS_TOKEN;

    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const backup = this.backupStatus();
    const since = (ms: number) => new Date(Date.now() - ms);
    const [errors1h, errors24h] = await Promise.all([
      this.db.errorLog.count({ where: { severity: 'ERROR', createdAt: { gte: since(3_600_000) } } }).catch(() => 0),
      this.db.errorLog.count({ where: { severity: 'ERROR', createdAt: { gte: since(86_400_000) } } }).catch(() => 0),
    ]);
    // Tashqi provayderlar (TZ 19.1.1): bugungi muvaffaqiyat/xato, oylik kvota (ProviderStatsService, provider-quota-poll).
    const providers = (await this.ops.providers()).map((p) => ({
      key: p.provider, provider: p.provider, label: PROVIDER_LABEL[p.provider] ?? p.provider, state: p.state === 'DEGRADED' ? 'OPEN' : 'CLOSED', success: p.today.ok, failure: p.today.fail, avgLatencyMs: null as number | null,
      successRate: p.today.successRate, used: p.used, limit: p.limit, usage: p.usage,
    }));
    const [openAlerts, lastDeploy] = await Promise.all([
      this.db.opsAlertEvent.count({ where: { status: 'FIRING', acknowledgedAt: null } }).catch(() => 0),
      this.db.opsDeployment.findFirst({ orderBy: { startedAt: 'desc' } }).catch(() => null),
    ]);
    const errorSeries = await this.errorSeries(window);
    const total24h = await this.db.errorLog.count({ where: { createdAt: { gte: since(86_400_000) } } }).catch(() => 0);

    const issues: Array<{ level: 'warning' | 'danger'; message: string }> = [];
    if (usedMemPercent >= 90) issues.push({ level: 'warning', message: `Xotira (RAM) ${usedMemPercent}% band` });
    if (disk && disk.usedPercent >= 90) issues.push({ level: 'warning', message: `Disk ${disk.usedPercent}% to‘lgan` });
    if (!backup.configured) issues.push({ level: 'warning', message: 'Zaxira nusxa sozlanmagan' });
    else if (backup.stale) issues.push({ level: 'danger', message: `Oxirgi zaxira nusxa ${backup.ageHours} soat oldin olingan` });
    for (const provider of providers) {
      if (provider.state === 'OPEN') issues.push({ level: 'danger', message: `${provider.label}: bugun xatolar ulushi yuqori` });
      if (provider.usage !== null && provider.usage >= 80) issues.push({ level: provider.usage >= 95 ? 'danger' : 'warning', message: `${provider.label} kvotasi ${provider.usage}% ishlatilgan` });
    }
    if (openAlerts > 0) issues.push({ level: 'warning', message: `${openAlerts} ta qabul qilinmagan alert` });
    if (errors1h >= 20) issues.push({ level: 'warning', message: `Oxirgi 1 soatda ${errors1h} ta server xatosi` });
    if (environment === 'production' && !metricsTokenSet) {
      issues.push({ level: 'danger', message: 'Production muhitida METRICS_TOKEN o‘rnatilmagan — /metrics ochiq qolishi mumkin' });
    }
    if (!database.ok) issues.push({ level: 'danger', message: 'Ma’lumotlar bazasiga ulanib bo‘lmadi' });
    if (!redisStatus.ok) issues.push({ level: 'danger', message: 'Redis’ga ulanib bo‘lmadi' });

    return {
      checkedAt: new Date().toISOString(),
      issues,
      system: {
        hostname: os.hostname(),
        platform: `${os.type()} ${os.release()}`,
        cpuCount: os.cpus().length,
        cpuPercent,
        loadAvg: os.loadavg().map((value) => Math.round(value * 100) / 100),
        totalMemMB: Math.round(totalMem / 1024 / 1024),
        freeMemMB: Math.round(freeMem / 1024 / 1024),
        usedMemPercent,
        uptimeSeconds: Math.round(os.uptime()),
        disk,
      },
      process: {
        supervisor: this.supervisor(),
        pid: process.pid,
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        heapLimitMB: Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024),
        cpuUserMs: Math.round(cpuUsage.user / 1000),
        cpuSystemMs: Math.round(cpuUsage.system / 1000),
      },
      version: {
        appVersion,
        commit,
        environment,
        nodeVersion: process.version,
        startedAt: new Date(this.startedAt).toISOString(),
      },
      dependencies: {
        database,
        redis: redisStatus,
        telegramAlerting: telegramConfigured,
      },
      backup,
      providers,
      openAlerts,
      lastDeploy,
      errors: { lastHour: errors1h, last24h: errors24h, logged24h: total24h, series: errorSeries },
      history: this.system.history(window),
      traffic: this.requestRate.series(window),
      trafficSummary: this.requestRate.summary(window),
      topEndpoints: this.requestRate.topEndpoints(window),
    };
  }

  /** Tanlangan oyna bo‘yicha server (ERROR) xatolari soni — bazadagi haqiqiy jurnaldan, ~24 ta ustunga bo‘lingan. */
  private async errorSeries(window: TrafficWindow): Promise<Array<{ at: string; count: number }>> {
    const windowMs = { '1h': 3_600_000, '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 }[window];
    const steps = window === '1h' ? 12 : window === '24h' ? 24 : window === '7d' ? 28 : 30;
    const stepMs = windowMs / steps;
    const from = Date.now() - windowMs;
    const rows = await this.db.errorLog
      .findMany({ where: { severity: 'ERROR', createdAt: { gte: new Date(from) } }, select: { createdAt: true }, take: 20_000 })
      .catch(() => []);
    const counts = new Array<number>(steps).fill(0);
    for (const row of rows) counts[Math.min(steps - 1, Math.floor((row.createdAt.getTime() - from) / stepMs))]! += 1;
    return counts.map((count, i) => ({ at: new Date(from + i * stepMs).toISOString(), count }));
  }

  /** `infrastructure/backup/backup.sh` yaratgan eng yangi `quyosh-*.dump` faylini topadi (BACKUP_DIR, standart ./backups). */
  private backupStatus(): { configured: boolean; message: string; stale: boolean; ageHours: number | null; lastAt: string | null; sizeMB: number | null; file: string | null; count: number; keepDaily: number } {
    const dir = process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), 'backups');
    try {
      const files = fs
        .readdirSync(dir)
        .filter((name) => /^quyosh-.*\.dump$/.test(name))
        .map((name) => ({ name, stat: fs.statSync(path.join(dir, name)) }))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
      const latest = files[0];
      if (!latest) throw new Error('empty');
      const ageHours = Math.round((Date.now() - latest.stat.mtimeMs) / 3_600_000);
      const stale = ageHours > 26;
      return {
        configured: true,
        stale,
        ageHours,
        lastAt: latest.stat.mtime.toISOString(),
        sizeMB: Math.round((latest.stat.size / 1024 / 1024) * 10) / 10,
        file: latest.name,
        count: files.length,
        keepDaily: Number(process.env.KEEP_DAILY) || 14,
        message: stale ? `Oxirgi zaxira ${ageHours} soat oldin olingan — kunlik zaxira ishlamayotgan bo‘lishi mumkin.` : `Oxirgi zaxira ${ageHours} soat oldin olingan (${latest.name}).`,
      };
    } catch {
      return { configured: false, stale: false, ageHours: null, lastAt: null, sizeMB: null, file: null, count: 0, keepDaily: Number(process.env.KEEP_DAILY) || 14, message: 'Avtomatik zaxira nusxa topilmadi. infrastructure/backup/backup.sh ni cron orqali kuniga bir marta ishga tushiring (docs/runbooks/backup-restore.md).' };
    }
  }

  /** Jarayonni kim boshqaradi: haqiqiy muhitdan aniqlanadi (PM2, systemd, Docker yoki oddiy jarayon). */
  private supervisor(): 'pm2' | 'systemd' | 'docker' | 'none' {
    if (process.env.pm_id !== undefined || process.env.PM2_HOME !== undefined) return 'pm2';
    if (process.env.INVOCATION_ID || process.env.JOURNAL_STREAM) return 'systemd';
    if (fs.existsSync('/.dockerenv')) return 'docker';
    return 'none';
  }

  private async cpuUsagePercent(sampleMs = 200): Promise<number> {
    const start = os.cpus();
    await new Promise((resolve) => setTimeout(resolve, sampleMs));
    const end = os.cpus();
    let idleDiff = 0;
    let totalDiff = 0;
    for (let i = 0; i < start.length; i++) {
      const s = start[i]!.times;
      const e = end[i]!.times;
      const sTotal = s.user + s.nice + s.sys + s.idle + s.irq;
      const eTotal = e.user + e.nice + e.sys + e.idle + e.irq;
      idleDiff += e.idle - s.idle;
      totalDiff += eTotal - sTotal;
    }
    return totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
  }

  private async diskUsage(): Promise<DiskUsage | null> {
    try {
      const { stdout } = await execFileAsync('df', ['-Pk', '/']);
      const lines = stdout.trim().split('\n');
      const parts = lines[lines.length - 1]!.trim().split(/\s+/);
      const totalKB = Number(parts[1]);
      const usedKB = Number(parts[2]);
      const freeKB = Number(parts[3]);
      if (!Number.isFinite(totalKB) || totalKB === 0) return null;
      return {
        totalGB: Math.round((totalKB / 1024 / 1024) * 10) / 10,
        usedGB: Math.round((usedKB / 1024 / 1024) * 10) / 10,
        freeGB: Math.round((freeKB / 1024 / 1024) * 10) / 10,
        usedPercent: Math.round((usedKB / totalKB) * 100),
      };
    } catch {
      return null;
    }
  }

  private async pingDatabase(): Promise<PingResult> {
    const start = Date.now();
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: null };
    }
  }

  private async pingRedis(): Promise<PingResult> {
    const start = Date.now();
    try {
      const ok = await this.redis.ping();
      return { ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: null };
    }
  }

  private readVersion(): string {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
      return (JSON.parse(raw) as { version?: string }).version ?? '—';
    } catch {
      return '—';
    }
  }

  private async gitCommit(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: process.cwd() });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }
}
