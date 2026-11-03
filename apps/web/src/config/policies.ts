import { apiGet } from '@/services/api.client';

/** Ro‘yxatdan o‘tishda qabul qilinadigan majburiy hujjatlar (server `getRequiredPolicies` bilan bir xil). */
const REQUIRED_TYPES = ['TERMS', 'PRIVACY', 'PLATFORM_RULES'] as const;

interface PublishedPolicy {
  id: string;
  type: string;
  publishedAt: string | null;
}

/**
 * Majburiy hujjatlarning joriy (eng so‘nggi nashr qilingan) versiyalari ID’lari.
 * ID’lar qattiq yozilmaydi: ular bazaga bog‘liq, admin yangi versiya nashr qilganda o‘zgaradi.
 */
export function pickRequiredPolicyIds(policies: PublishedPolicy[]): string[] {
  const latest = new Map<string, PublishedPolicy>();
  for (const policy of policies) {
    if (!(REQUIRED_TYPES as readonly string[]).includes(policy.type)) continue;
    const current = latest.get(policy.type);
    if (!current || (policy.publishedAt ?? '') > (current.publishedAt ?? '')) latest.set(policy.type, policy);
  }
  return REQUIRED_TYPES.flatMap((type) => latest.get(type)?.id ?? []);
}

export async function fetchRequiredPolicyIds(): Promise<string[]> {
  const list = await apiGet<PublishedPolicy[] | { items: PublishedPolicy[] }>('/legal/policies');
  return pickRequiredPolicyIds(Array.isArray(list) ? list : list.items);
}
