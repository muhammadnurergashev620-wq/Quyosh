/** Eski yuklashlarda kirill/o‘zbek fayl nomlari UTF-8 baytlari Latin-1 sifatida o‘qilib buzilgan; iloji bo‘lsa tiklaydi. */
export function fixFilename(name: string): string {
  if (!/[À-ÿ]/.test(name)) return name;
  try {
    const bytes = Uint8Array.from(name, (char) => char.charCodeAt(0));
    if (bytes.some((byte) => byte > 0xff)) return name;
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return name;
  }
}

export function formatBytes(bytes: number | string): string {
  const value = Number(bytes);
  if (!Number.isFinite(value)) return '—';
  if (value < 1024) return `${value} bayt`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

export function formatMime(mime: string): string {
  const subtype = mime.split('/')[1] ?? mime;
  return subtype === 'jpeg' ? 'JPEG' : subtype.toUpperCase();
}
