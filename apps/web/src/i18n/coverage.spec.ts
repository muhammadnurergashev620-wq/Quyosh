import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ru } from './ru';
import { ruExtra } from './ru.extra';
import { ruM2 } from './ru.m2';
import { ruM3 } from './ru.m3';
import { ruM5 } from './ru.m5';
import { ruM6 } from './ru.m6';
import { ruM7 } from './ru.m7';
import { ruQuyosh } from './ru.quyosh';

const norm = (value: string) => value.replace(/[‘’ʻʼ`]/g, "'").trim();
const index = (dict: Record<string, string>) => new Set(Object.keys(dict).map(norm));

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'i18n') sources(path, out);
    } else if (/\.tsx?$/.test(name) && !/\.spec\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** Kodda `t('…')` bilan ishlatilgan har bir o‘zbekcha kalitning ruscha va inglizcha tarjimasi bo‘lishi shart (audit A-08). */
describe('i18n coverage', () => {
  const used = new Map<string, string>();
  for (const file of sources(join(__dirname, '..'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
      const key = match[2]!.replace(/\\'/g, "'");
      if (!used.has(norm(key))) used.set(norm(key), file);
    }
  }
  const RU = index({ ...ru, ...ruExtra, ...ruQuyosh, ...ruM2, ...ruM3, ...ruM5, ...ruM6, ...ruM7 });
  const EN = index(en);

  it('finds the t() calls', () => {
    expect(used.size).toBeGreaterThan(1000);
  });

  it('every used key has a Russian translation', () => {
    expect([...used.keys()].filter((key) => !RU.has(key))).toEqual([]);
  });

  it('every used key has an English translation', () => {
    expect([...used.keys()].filter((key) => !EN.has(key))).toEqual([]);
  });
});
