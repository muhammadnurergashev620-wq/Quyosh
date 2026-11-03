import { t } from '@/i18n';
export type PolicyType =
  | 'TERMS'
  | 'PRIVACY'
  | 'PUBLIC_OFFER'
  | 'PLATFORM_RULES'
  | 'PAYMENT'
  | 'REFUND'
  | 'CANCELLATION'
  | 'WARRANTY';
export type PolicyStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const POLICY_TYPE_LABEL: Record<PolicyType, string> = {
  TERMS: t('Foydalanish shartlari'),
  PRIVACY: t('Maxfiylik siyosati'),
  PUBLIC_OFFER: t('Ommaviy oferta'),
  PLATFORM_RULES: t('Platforma qoidalari'),
  PAYMENT: t('To‘lov shartlari'),
  REFUND: t('Qaytarish shartlari'),
  CANCELLATION: t('Bekor qilish shartlari'),
  WARRANTY: t('Kafolat shartlari'),
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
