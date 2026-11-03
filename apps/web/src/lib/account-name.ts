import { t } from '@/i18n';
interface NamedAccount {
  firstName: string | null;
  lastName: string | null;
  accountNumber?: number;
}

export function accountName(user: NamedAccount | null | undefined): string {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  if (name) return name;
  return t('Ism kiritilmagan');
}

/** To‘liq ism («Kamronbek Ziyovuddinov») → ism va familiya (birinchi so‘z — ism, qolgani — familiya). Kamida ikki so‘z bo‘lmasa — null. */
export function splitFullName(full: string): { firstName: string; lastName: string } | null {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0]!.slice(0, 100), lastName: parts.slice(1).join(' ').slice(0, 100) };
}

export const joinFullName = (firstName?: string | null, lastName?: string | null) => [firstName, lastName].filter(Boolean).join(' ').trim();

