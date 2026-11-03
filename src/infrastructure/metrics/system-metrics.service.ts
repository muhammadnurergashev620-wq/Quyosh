import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as os from 'node:os';
import { promisify } from 'node:util';
import { loadJson, metricsFile, saveJson } from './metrics-store';
import type { TrafficWindow } from './request-rate.service';

const execFileAsync = promisify(execFile);

export interface SystemSample {
  at: string;
  cpu: number;
  mem: number;
  disk: number | null;
  heapMB: number;
}

interface Coarse {
  n: number;
  cpu: number;
  mem: number;
  disk: number;
  diskN: number;
  heap: number;
}

const SAMPLE_MS = 30_000;
const COARSE_MS = 5 * 60_000;
const KEEP_COARSE = 30 * 24 * 12; // 30 kun, 5 daqiqalik
const FILE = 'devops-system.json';

/** Har 30 soniyada CPU, RAM, disk va Node heap’ni o‘lchab, KPI kartalardagi grafiklar uchun tarix to‘playdi. */
@Injectable()
export class SystemMetricsService implements OnModuleInit, OnModuleDestroy {
  private raw: SystemSample[] = [];
  private readonly coarse = new Map<number, Coarse>();
  private lastCpu = os.cpus();
  private disk: number | null = null;
  private diskAt = 0;
  private timers: NodeJS.Timeout[] = [];

  onModuleInit(): void {
    const saved = loadJson<{ coarse: Record<string, Coarse> }>(metricsFile(FILE));
    if (saved?.coarse) for (const [key, value] of Object.entries(saved.coarse)) this.coarse.set(Number(key), value);
    void this.sample();
    const sampler = setInterval(() => void this.sample(), SAMPLE_MS);
    const saver = setInterval(() => saveJson(metricsFile(FILE), { coarse: Object.fromEntries(this.coarse) }), 60_000);
    sampler.unref();
    saver.unref();
    this.timers.push(sampler, saver);
  }

  onModuleDestroy(): void {
    this.timers.forEach(clearInterval);
    saveJson(metricsFile(FILE), { coarse: Object.fromEntries(this.coarse) });
  }

  private cpuPercent(): number {
    const end = os.cpus();
    let idle = 0;
    let total = 0;
    for (let i = 0; i < end.length; i++) {
      const s = this.lastCpu[i]?.times;
      const e = end[i]!.times;
      if (!s) continue;
      idle += e.idle - s.idle;
      total += e.user + e.nice + e.sys + e.idle + e.irq - (s.user + s.nice + s.sys + s.idle + s.irq);
    }
    this.lastCpu = end;
    return total === 0 ? 0 : Math.round((1 - idle / total) * 100);
  }

  private async diskPercent(): Promise<number | null> {
    if (Date.now() - this.diskAt < 5 * 60_000 && this.disk !== null) return this.disk;
    try {
      const { stdout } = await execFileAsync('df', ['-Pk', '/']);
      const parts = stdout.trim().split('\n').pop()!.trim().split(/\s+/);
      const total = Number(parts[1]);
      const used = Number(parts[2]);
      this.disk = total > 0 ? Math.round((used / total) * 100) : null;
    } catch {
      this.disk = null;
    }
    this.diskAt = Date.now();
    return this.disk;
  }

  private async sample(): Promise<void> {
    const total = os.totalmem();
    const sample: SystemSample = {
      at: new Date().toISOString(),
      cpu: this.cpuPercent(),
      mem: Math.round(((total - os.freemem()) / total) * 100),
      disk: await this.diskPercent(),
      heapMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
    this.raw.push(sample);
    if (this.raw.length > 130) this.raw.shift();

    const key = Math.floor(Date.now() / COARSE_MS);
    const bucket = this.coarse.get(key) ?? { n: 0, cpu: 0, mem: 0, disk: 0, diskN: 0, heap: 0 };
    bucket.n += 1;
    bucket.cpu += sample.cpu;
    bucket.mem += sample.mem;
    bucket.heap += sample.heapMB;
    if (sample.disk !== null) {
      bucket.disk += sample.disk;
      bucket.diskN += 1;
    }
    this.coarse.set(key, bucket);
    const cutoff = key - KEEP_COARSE;
    for (const k of this.coarse.keys()) if (k < cutoff) this.coarse.delete(k);
  }

  /** Tanlangan oyna uchun tarix (eng ko‘pi bilan ~100 nuqta). */
  history(window: TrafficWindow): SystemSample[] {
    if (window === '1h') {
      const since = Date.now() - 3_600_000;
      const raw = this.raw.filter((item) => Date.parse(item.at) >= since);
      if (raw.length >= 12) return raw;
      // Qayta ishga tushgandan keyin 30 soniyalik o‘lchovlar kam: 5 daqiqalik saqlangan tarix bilan to‘ldiriladi.
      const firstRaw = raw[0] ? Date.parse(raw[0].at) : Date.now();
      const older: SystemSample[] = [];
      for (const [key, g] of [...this.coarse.entries()].sort((a, b) => a[0] - b[0])) {
        const at = key * COARSE_MS;
        if (at >= since && at + COARSE_MS <= firstRaw) older.push({ at: new Date(at).toISOString(), cpu: Math.round(g.cpu / g.n), mem: Math.round(g.mem / g.n), disk: g.diskN ? Math.round(g.disk / g.diskN) : null, heapMB: Math.round(g.heap / g.n) });
      }
      return [...older, ...raw];
    }
    const windowMs = window === '24h' ? 86_400_000 : window === '7d' ? 7 * 86_400_000 : 30 * 86_400_000;
    const stepMs = window === '24h' ? 15 * 60_000 : window === '7d' ? 2 * 3_600_000 : 8 * 3_600_000;
    const from = Date.now() - windowMs;
    const groups = new Map<number, Coarse>();
    for (const [key, value] of this.coarse) {
      const at = key * COARSE_MS;
      if (at < from) continue;
      const slot = Math.floor(at / stepMs);
      const group = groups.get(slot) ?? { n: 0, cpu: 0, mem: 0, disk: 0, diskN: 0, heap: 0 };
      group.n += value.n;
      group.cpu += value.cpu;
      group.mem += value.mem;
      group.disk += value.disk;
      group.diskN += value.diskN;
      group.heap += value.heap;
      groups.set(slot, group);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([slot, g]) => ({ at: new Date(slot * stepMs).toISOString(), cpu: Math.round(g.cpu / g.n), mem: Math.round(g.mem / g.n), disk: g.diskN ? Math.round(g.disk / g.diskN) : null, heapMB: Math.round(g.heap / g.n) }));
  }
}
