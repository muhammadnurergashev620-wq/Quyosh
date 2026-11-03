import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { zipSingle } from './zip';

describe('zipSingle', () => {
  it('produces a valid archive with the original bytes', () => {
    const data = Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 7) % 251));
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    writeFileSync(join(dir, 'a.zip'), zipSingle('video-qongiroq.webm', data));
    execFileSync('python3', ['-I', '-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;z.extractall(sys.argv[2])', join(dir, 'a.zip'), join(dir, 'out')]);
    expect(readFileSync(join(dir, 'out', 'video-qongiroq.webm')).equals(data)).toBe(true);
  });
});
