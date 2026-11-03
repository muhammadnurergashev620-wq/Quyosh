import * as fs from 'node:fs';
import * as path from 'node:path';

/** DevOps ko‘rsatkichlarini qayta ishga tushgandan keyin ham saqlash uchun oddiy JSON fayl (data/ papkasi git’da yo‘q). */
export function metricsFile(name: string): string {
  return path.join(process.env.METRICS_DIR?.trim() || path.join(process.cwd(), 'data'), name);
}

export function loadJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function saveJson(file: string, value: unknown): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file);
  } catch {
    // Saqlab bo‘lmasa, ko‘rsatkichlar faqat xotirada qoladi.
  }
}
