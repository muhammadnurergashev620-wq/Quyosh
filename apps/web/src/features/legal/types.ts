import { t } from '@/i18n';
/** Backend `PolicyType` enumi bilan bir xil (TZ 7.2): faqat shu uch tur. */
export type PolicyType = 'TERMS' | 'PRIVACY' | 'PLATFORM_RULES';
export type PolicyStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const POLICY_TYPE_LABEL: Record<PolicyType, string> = {
  TERMS: t('Foydalanish shartlari'),
  PRIVACY: t('Maxfiylik siyosati'),
  PLATFORM_RULES: t('Platforma qoidalari'),
};

export interface Policy {
  id: string;
  type: PolicyType;
  version: string;
  title: string;
  content?: string;
  status: PolicyStatus;
  publishedAt: string | null;
  createdAt?: string;
}

export interface PolicyAcceptance {
  id: string;
  policyId: string;
  acceptedAt: string;
}

export interface CreatePolicyInput {
  type: PolicyType;
  version: string;
  title: string;
  content: string;
}
