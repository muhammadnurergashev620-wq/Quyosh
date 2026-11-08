import { type BadgeTone } from '@/components/ui/Badge';
import type { TicketStatus } from '@/features/m7/types';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/deals/deals.css';
import '@/features/m7/m7.css';

export const CATEGORY_LABEL: Record<string, string> = {
  ACCOUNT: t('Akkaunt va kirish'), CALCULATOR: t('Kalkulyator'), REQUEST_QUOTE: t('So‘rov va takliflar'), INSTALLATION: t('Montaj'),
  SHOP: t('Do‘kon kabineti'), TECHNICAL: t('Texnik xato'), SECURITY: t('Xavfsizlik'), OTHER: t('Boshqa'),
};

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: t('Ochiq'), tone: 'primary' }, IN_PROGRESS: { label: t('Ko‘rib chiqilmoqda'), tone: 'primary' }, WAITING_USER: { label: t('Javobingiz kutilmoqda'), tone: 'warning' },
  RESOLVED: { label: t('Hal qilindi'), tone: 'success' }, CLOSED: { label: t('Yopilgan'), tone: 'neutral' },
};
