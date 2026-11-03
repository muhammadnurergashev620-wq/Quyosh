/** Profil rasmi havolasi: yuklangan fayl bo‘lsa — API orqali beriladigan manzil (fayl id'si bilan versiyalanadi, shuning uchun keshlanadi). */
export const avatarPath = (assetId: string | null | undefined): string | null => (assetId ? `/avatars/${assetId}` : null);

/**
 * Javobdagi har bir `avatarAssetId` maydoni bor obyektga `avatar` (yuklangan rasm yoki Google rasmi) qo‘shadi va xom id'ni olib tashlaydi.
 * Shu bilan har bir endpoint alohida hisoblamaydi: select'ga `avatarAssetId: true` qo‘shish yetarli.
 */
export function decorateAvatars<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) decorateAvatars(item);
    return value;
  }
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value; // Date, Decimal, Buffer va h.k.
    const record = value as Record<string, unknown>;
    if ('avatarAssetId' in record) {
      const id = record.avatarAssetId as string | null;
      record.avatar = avatarPath(id) ?? (typeof record.avatarUrl === 'string' ? record.avatarUrl : null);
      delete record.avatarAssetId;
    }
    for (const key of Object.keys(record)) decorateAvatars(record[key]);
  }
  return value;
}
