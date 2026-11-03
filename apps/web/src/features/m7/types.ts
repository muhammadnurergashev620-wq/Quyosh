import type { SystemType } from '@/features/calc/types';

export type I18n = Partial<Record<'uz' | 'oz' | 'ru', string>>;
export type ReminderType = 'CLEANING' | 'INSPECTION' | 'WARRANTY_EXPIRY';

export interface Reminder { id: string; type: ReminderType; intervalDays: number | null; nextAt: string; lastSentAt: string | null; lastDoneAt: string | null; active: boolean; warrantyItemId: string | null }
export interface SystemRow {
  id: string; title: string | null; systemPowerKw: string; systemType: SystemType; installedAt: string;
  shop: { id: string; name: string; slug: string } | null;
  lastReading: { period: string; generatedKwh: number; expectedKwh: number | null; deviation: number | null } | null;
  nextReminder: Reminder | null; warrantyEndsAt: string | null;
}
export interface SystemDetail {
  id: string; title: string | null; systemPowerKw: string; systemType: SystemType; installedAt: string;
  components: Array<{ title: string; quantity: number }>; checklist: Array<{ code: string; status: string; comment?: string | null }> | null;
  expectedMonthlyKwh: number[] | null; shop: { id: string; name: string; slug: string } | null; installationId: string | null; quoteId: string | null; requestShopId: string | null;
  readings: Array<{ id: string; period: string; generatedKwh: number; meterReading: number | null; expectedKwh: number | null; deviation: number | null; alert: boolean }>;
  warranties: Array<{ id: string; component: string; months: number; startsAt: string; endsAt: string; daysLeft: number; expiringSoon: boolean }>;
  reminders: Reminder[];
}

export interface Project { id: string; title: string; city: string | null; systemPowerKw: string | null; systemType: SystemType | null; completedAt: string | null; installationId?: string | null; description: string | null; published?: boolean; verifiedInstallation?: boolean; images: Array<{ fileId: string; url: string | null; thumb: string | null }> }
export type CertType = 'OFFICIAL_DEALER' | 'CERTIFIED_INSTALLER' | 'LICENSE';
export interface Certification { id: string; shopId: string; certType: CertType; brand: string | null; issuer: string; certNumber: string | null; fileId: string; validFrom: string; validUntil: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'; reason: string | null; expiringSoon?: boolean; shop?: { id: string; name: string; slug: string } }

export interface WidgetConfig {
  publicKey: string; allowedDomains: string[]; active: boolean;
  theme: { primaryColor: string; title: string; lang: 'uz' | 'oz' | 'ru'; showLogo: boolean };
  contrast: { ratio: number; ok: boolean; suggestion: string | null }; embed: string; frameUrl: string;
}

export interface ShopAnalytics {
  from: string; to: string;
  totals: { views: number; requests: number; widgetRequests: number; medianResponseMinutes: number | null; quotesSent: number; selected: number; installationsConfirmed: number; cleanAcceptanceShare: number | null };
  funnel: Array<{ step: string; count: number }>;
  daily: Array<{ day: string; views: number; requests: number; medianResponseMinutes: number | null }>;
  products: Array<{ productModelId: string; name: string; views: number }>;
  regions: Array<{ regionCode: string; count: number }>;
}
export interface Funnel { steps: Array<{ step: string; count: number; conversion: number | null }> }

export interface ShopDashboard {
  shop: { avgResponseMinutes: number | null; ratingAvg: string; ratingCount: number; status: string; verificationStatus: string };
  kpis: { views: number; newRequests: number; waiting: number; quotesSent: number; selectionRate: number | null; medianResponseMinutes: number | null; cleanAcceptanceShare: number | null };
  replyToday: Array<{ id: string; sentAt: string; status: string; number: number; systemType: SystemType; requiredCapacityKw: string | null; regionCode: string | null; customerFirstName: string | null; overdue: boolean }>;
  profile: { products: number; branches: number; services: number; projects: number; certifications: number };
}
export interface CustomerDashboard {
  actions: Array<{ kind: 'QUOTE' | 'ACCEPT_INSTALLATION' | 'SITE_VISIT' | 'READING'; id: string; title: string | null; requestNumber?: number; period?: string }>;
  newQuotes: Array<{ id: string; status: string; total: string; viewedAt: string | null; validUntil: string | null; shop: { name: string }; request: { id: string; number: number } }>;
  openRequests: Array<{ id: string; number: number; title: string; createdAt: string; quotes: number }>;
  calculations: Array<{ id: string; title: string | null; createdAt: string; systemType: SystemType; systemPowerKw: number | null; monthlySaving: number | null }>;
  system: { id: string; title: string | null; systemPowerKw: string; expectedThisMonthKwh: number | null; lastReading: { period: string; generatedKwh: number; expectedKwh: number | null } | null } | null;
  reminders: Array<{ id: string; type: ReminderType; nextAt: string; installedSystemId: string }>;
  site: { id: string; title: string } | null;
  empty: boolean;
}
export interface AdminQueues { queues: Array<{ key: string; permission: string; count: number; breaching?: number; to: string }>; exchangeRate: { rateDate: string; rateToUzs: string; stale: boolean } | null }

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
export interface Ticket {
  id: string; number: number; code: string; category: string; subject: string; priority: 'URGENT' | 'HIGH' | 'NORMAL'; status: TicketStatus;
  firstResponseDueAt: string; firstRespondedAt: string | null; resolvedAt: string | null; satisfaction: number | null; lastMessageAt: string; createdAt: string;
  assigneeId?: string | null; relatedType?: string | null; relatedId?: string | null; requestIdRef?: string | null; guestContact?: string | null;
  sla?: 'OK' | 'AT_RISK' | 'BREACHED' | 'MET'; minutesLeft?: number | null;
  messages?: Array<{ id: string; senderSide: 'USER' | 'AGENT' | 'SYSTEM'; body: string; attachmentFileIds: string[]; isInternal: boolean; createdAt: string; senderUserId: string | null }>;
  requester?: { id: string; firstName: string | null; lastName: string | null; phone: string | null; accountNumber: number } | null;
}
export interface ReplyTemplate { id: string; titleI18n: I18n; bodyI18n: I18n; category: string | null; active: boolean }

export type ArticleType = 'GUIDE' | 'ARTICLE' | 'FAQ' | 'VIDEO' | 'GLOSSARY';
export type CtaType = 'CALCULATOR' | 'OUTAGE' | 'FINANCING' | 'SHOPS' | 'NONE';
export interface KCategory { id: string; slug: string; icon: string | null; nameI18n: I18n; count: number }
export interface ArticleCard { id: string; slug: string; articleType: ArticleType; titleI18n: I18n; summaryI18n: I18n; coverFileId: string | null; tags: string[]; ctaType: CtaType; readingMinutes: number; videoUrl: string | null; beginnerOrder: number | null; publishedAt: string | null; verifiedAt: string | null; category: { id: string; slug: string; nameI18n: I18n; icon: string | null } }
export interface Article extends ArticleCard { bodyI18n: I18n; sourceUrls: string[]; seoTitleI18n: I18n | null; seoDescriptionI18n: I18n | null; related: ArticleCard[]; helpfulYes: number; helpfulNo: number }
export interface AdminArticle extends ArticleCard { status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; updatedAt: string; helpfulYes: number; helpfulNo: number; bodyI18n: I18n; categoryId?: string; sourceUrls?: string[]; seoTitleI18n?: I18n | null; seoDescriptionI18n?: I18n | null }
