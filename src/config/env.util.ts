export function intEnv(name: string, fallback: number, min = 1): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} kamida ${min} bo‘lgan butun son bo‘lishi kerak (hozir: "${raw}")`);
  }
  return value;
}

export function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function intListEnv(name: string, fallback: number[]): number[] {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const values = raw.split(',').map((item) => Number(item.trim()));
  if (values.length === 0 || values.some((value) => !Number.isInteger(value) || value < 1)) {
    throw new Error(`${name} vergul bilan ajratilgan musbat butun sonlar bo‘lishi kerak (hozir: "${raw}")`);
  }
  return values;
}
