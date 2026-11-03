import type { SystemType } from '@/features/calc/types';

export type QuoteRequestStatus = 'OPEN' | 'CLOSED_SELECTED' | 'CLOSED_NO_SELECTION' | 'EXPIRED' | 'CANCELLED';
export type RequestShopStatus = 'SENT' | 'VIEWED' | 'CLARIFICATION_REQUESTED' | 'QUOTED' | 'DECLINED' | 'SELECTED' | 'NOT_SELECTED';
export type PipelineStage = 'NEW' | 'CONTACTED' | 'SITE_VISIT' | 'PROPOSAL' | 'WON' | 'LOST';
export type QuoteStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';
export type InstallationStatus = 'AGREED' | 'SITE_VISIT_SCHEDULED' | 'INSTALLATION_SCHEDULED' | 'INSTALLED' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
export type QuoteItemType = 'EQUIPMENT' | 'INSTALLATION' | 'DELIVERY' | 'OTHER';
export type Side = 'CUSTOMER' | 'SHOP';
export type Money = string | number;

export interface ShopCard {
  id: string;
  slug: string;
  name: string;
  logoAssetId: string | null;
  ratingAvg: Money;
  ratingCount: number;
  avgResponseMinutes: number | null;
  verificationStatus?: string;
  phone?: string | null;
}

export interface RequestLimits {
  open: number;
  maxOpen: number;
  today: number;
  maxPerDay: number;
  maxShops: number;
  canCreate: boolean;
  nextAvailableAt: string | null;
}

export interface QuoteRequestRow {
  id: string;
  number: number;
  title: string;
  systemType: SystemType;
  requiredCapacityKw: Money | null;
  status: QuoteRequestStatus;
  createdAt: string;
  closedAt: string | null;
  shops: Array<{ id: string; status: RequestShopStatus; shop: { id: string; name: string; logoAssetId: string | null } }>;
  quoteCount: number;
  minTotal: Money | null;
  unread: number;
}

export interface SiteVisit {
  id: string;
  proposedSlotsJson: Array<{ start: string; end: string }>;
  confirmedStart: string | null;
  confirmedEnd: string | null;
  status: 'PROPOSED' | 'CONFIRMED' | 'DONE' | 'CANCELLED';
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
}

export interface QuoteSummary {
  id: string;
  shopId?: string;
  status: QuoteStatus;
  total: Money;
  currency?: string;
  systemPowerKw?: Money | null;
  currentRevision: number;
  validUntil?: string | null;
  durationDays?: number | null;
  warrantyEquipmentMonths?: number | null;
  warrantyInstallationMonths?: number | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  updatedAt?: string;
  installation?: { id: string; status: InstallationStatus } | null;
}

export interface CalcBrief {
  systemType: SystemType | null;
  systemPowerKw: number | null;
  panelCount: number | null;
  inverterKw: number | null;
  batteryKwh: number | null;
  annualLoadKwh: number | null;
  annualGenerationKwh: number | null;
  usableAreaM2: number | null;
  monthlyBill: number | null;
  initialCost: number | null;
  simplePaybackYears: number | null;
}

export interface QuoteRequestDetail {
  id: string;
  number: number;
  title: string;
  systemType: SystemType;
  requiredCapacityKw: Money | null;
  batteryNeeded: boolean;
  installationNeeded: boolean;
  financingInterest: boolean;
  notes: string | null;
  regionCode: string | null;
  status: QuoteRequestStatus;
  createdAt: string;
  closedAt: string | null;
  calculationId: string | null;
  siteId: string | null;
  calculation: { id: string; title: string | null; brief: CalcBrief | null } | null;
  limits: { maxShops: number };
  shops: Array<{
    id: string;
    status: RequestShopStatus;
    contactRevealedAt: string | null;
    declineReason: string | null;
    sentAt: string;
    viewedAt: string | null;
    shop: ShopCard;
    siteVisits: SiteVisit[];
    unread: number;
    quote: QuoteSummary | null;
  }>;
}

export interface Attachment {
  id: string;
  name: string | null;
  mime: string | null;
  size: number;
  status: string;
}

export interface ChatMessage {
  id: string;
  senderSide: 'CUSTOMER' | 'SHOP' | 'SYSTEM';
  mine: boolean;
  body: string;
  systemKind: string | null;
  clientId: string | null;
  readAt: string | null;
  createdAt: string;
  attachments: Attachment[];
}

export interface ShopLeadView {
  id: string;
  shopId: string;
  status: RequestShopStatus;
  pipelineStage: PipelineStage;
  declineReason: string | null;
  sentAt: string;
  viewedAt: string | null;
  firstResponseAt: string | null;
  contactRevealedAt: string | null;
  assignedMember: { id: string; name: string } | null;
  request: {
    id: string; number: number; title: string; status: QuoteRequestStatus; systemType: SystemType; requiredCapacityKw: Money | null;
    batteryNeeded: boolean; installationNeeded: boolean; financingInterest: boolean; notes: string | null; regionCode: string | null; districtCode: string | null; createdAt: string;
  };
  customer: { firstName: string | null; lastName?: string | null; phone?: string | null; email?: string | null; revealed: boolean };
  calculation: CalcBrief | null;
  site: { siteType: string; regionCode: string | null; usableAreaM2: number; areaCount: number; title?: string; address?: string | null; location?: { lat: number; lon: number } | null } | null;
  siteVisits: SiteVisit[];
  notes: Array<{ id: string; body: string; createdAt: string; author: string | null }>;
  quote: { id: string; status: QuoteStatus; total: Money; currentRevision: number; validUntil: string | null; installation: { id: string; status: InstallationStatus } | null } | null;
}

export type ConversationView =
  | ({ side: 'SHOP' } & ShopLeadView)
  | {
      side: 'CUSTOMER';
      id: string;
      status: RequestShopStatus;
      contactRevealedAt: string | null;
      shop: ShopCard;
      request: { id: string; number: number; title: string; status: QuoteRequestStatus; systemType: SystemType; requiredCapacityKw: Money | null };
      quote: { id: string; status: QuoteStatus; total: Money; currentRevision: number } | null;
      siteVisits: SiteVisit[];
    };

export interface ShopLeadRow {
  id: string;
  status: RequestShopStatus;
  pipelineStage: PipelineStage;
  sentAt: string;
  viewedAt: string | null;
  firstResponseAt: string | null;
  contactRevealed: boolean;
  assignedMember: { id: string; name: string } | null;
  request: { id: string; number: number; title: string; systemType: SystemType; requiredCapacityKw: Money | null; batteryNeeded: boolean; installationNeeded: boolean; financingInterest: boolean; regionCode: string | null; status: QuoteRequestStatus; createdAt: string; customerFirstName: string | null };
  unread: number;
  quote: { id: string; status: QuoteStatus; total: Money } | null;
}

export interface QuoteItem {
  id?: string;
  itemType: QuoteItemType;
  productModelId?: string | null;
  serviceId?: string | null;
  titleSnapshot?: string;
  title?: string;
  quantity: Money;
  unitPrice: Money;
  lineTotal?: Money;
}

export interface FinancingOption {
  financingType: 'BANK_LOAN' | 'INSTALLMENT' | 'LEASING';
  providerName: string;
  annualRate: Money;
  termMonths: number;
  downPaymentPct?: Money;
  paymentType?: 'ANNUITY' | 'DIFFERENTIATED';
  notes?: string | null;
  monthlyPayment?: number | null;
  totalInterest?: number | null;
}

export interface QuoteView {
  id: string;
  side: Side;
  status: QuoteStatus;
  requestId: string;
  request: { id: string; number: number; title: string; status: QuoteRequestStatus };
  shop: ShopCard;
  currentRevision: number;
  revisions: Array<{ revision: number; createdAt: string }>;
  items: Array<Required<Pick<QuoteItem, 'itemType' | 'quantity' | 'unitPrice' | 'lineTotal'>> & { id: string; titleSnapshot: string; productModelId: string | null; serviceId: string | null }>;
  financingOptions: FinancingOption[];
  equipmentSubtotal: Money; installationSubtotal: Money; deliveryCost: Money; otherCosts: Money; discountAmount: Money;
  vatIncluded: boolean; vatRate: Money; vatAmount: Money; total: Money; currency: string;
  pricePerKw: number | null;
  exchangeRateUsd: Money | null; exchangeRateDate: string | null;
  systemPowerKw: Money | null; systemType: SystemType | null;
  warrantyEquipmentMonths: number | null; warrantyInstallationMonths: number | null; warrantyText: string | null;
  durationDays: number | null; includedScope: string | null; excludedScope: string | null; validUntil: string | null;
  sentAt: string | null; viewedAt: string | null; decidedAt: string | null; rejectReason?: string | null;
  installation: { id: string; status: InstallationStatus } | null;
  version: number;
  updatedAt: string;
}

export interface CompareRow extends QuoteView {
  paybackRange: [number, number] | null;
  badges: Array<'CHEAPEST_PER_KW' | 'LONGEST_WARRANTY' | 'FASTEST_INSTALL'>;
  expiringSoon: boolean;
}

export interface QuoteRevisionSnapshot {
  revision: number;
  createdAt: string;
  snapshotJson: Record<string, unknown> & { items: Array<{ title: string; quantity: string; unitPrice: string; lineTotal: string; itemType: QuoteItemType }> };
}

export interface QuoteInput {
  items?: Array<{ itemType: QuoteItemType; productModelId?: string; serviceId?: string; title?: string; quantity: number; unitPrice: number }>;
  financingOptions?: Array<{ financingType: FinancingOption['financingType']; providerName: string; annualRate: number; termMonths: number; downPaymentPct?: number }>;
  deliveryCost?: number;
  otherCosts?: number;
  discountAmount?: number;
  vatIncluded?: boolean;
  vatRate?: number;
  systemPowerKw?: number;
  systemType?: SystemType;
  warrantyEquipmentMonths?: number;
  warrantyInstallationMonths?: number;
  warrantyText?: string;
  durationDays?: number;
  includedScope?: string;
  excludedScope?: string;
  validUntil?: string;
}

/** Do‘kon taklif shabloni: qatorlar + standart shartlar (muddat va quvvat har safar yangidan). */
export interface QuoteTemplate {
  id: string;
  name: string;
  items: NonNullable<QuoteInput['items']>;
  defaults: Omit<QuoteInput, 'items' | 'validUntil'>;
  createdAt: string;
  updatedAt: string;
}

export interface BuilderCatalog {
  exchangeRate: { rateToUzs: Money; rateDate: string } | null;
  products: Array<{ shopProductId: string; model: { id: string; brand: string; model: string; nominalPowerW: number | null; inverterAcKw: Money | null; batteryCapacityKwh: Money | null; warrantyMonths: number | null; category: { slug: string; nameI18n: Record<string, string> } }; offer: { price: Money; currency: string } | null; priceUzs: number | null }>;
  services: Array<{ id: string; serviceType: string; pricingModel: string; price: Money | null; currency: string; warrantyMonths: number | null; priceUzs: number | null }>;
}

export interface ChecklistTemplateItem {
  code: string;
  titleI18n: Record<string, string>;
  hintI18n?: Record<string, string>;
  required: boolean;
  photoRequired: boolean;
}

export interface ChecklistAnswer {
  code: string;
  status: 'OK' | 'ISSUE' | 'NA';
  comment?: string | null;
  photoFileIds?: string[];
}

export interface ChecklistEvaluation {
  complete: boolean;
  hasIssues: boolean;
  answered: number;
  total: number;
  missing: string[];
  errors: Array<{ code: string; reason: 'COMMENT_REQUIRED' | 'PHOTO_REQUIRED' | 'UNKNOWN_ITEM' | 'NA_NOT_ALLOWED' }>;
}

export interface InstallationView {
  id: string;
  side: Side;
  status: InstallationStatus;
  scheduledDate: string | null;
  installedAt: string | null;
  confirmedAt: string | null;
  cancelReason: string | null;
  disputeReason: string | null;
  history: Array<{ status: InstallationStatus; at: string; side: string; note?: string }>;
  requestShopId: string | null;
  shop: { id: string; name: string; slug: string; logoAssetId: string | null; phone: string | null };
  quote: { id: string; total: Money; currency: string; systemPowerKw: Money | null; systemType: SystemType | null; durationDays: number | null; warrantyEquipmentMonths: number | null; warrantyInstallationMonths: number | null; request: { id: string; number: number; title: string } };
  customer?: { firstName: string | null; lastName: string | null; phone: string | null };
  checklist: { items: ChecklistTemplateItem[]; result: ChecklistAnswer[]; evaluation: ChecklistEvaluation; completedAt: string | null } | null;
  review: { id: string; rating: number; comment: string | null; moderationStatus: 'PENDING' | 'PUBLISHED' | 'HIDDEN'; createdAt: string; reply: { body: string; createdAt: string } | null } | null;
  installedSystem: { id: string; systemPowerKw: Money; installedAt: string } | null;
  version: number;
}

export interface InstallationRow {
  id: string;
  status: InstallationStatus;
  scheduledDate: string | null;
  installedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requestId: string;
  shop: { id: string; name: string; slug: string; logoAssetId: string | null };
  quote: { id: string; total: Money; systemPowerKw: Money | null; systemType: SystemType | null; request: { number: number; title: string } };
  user?: { firstName: string | null; lastName: string | null; phone: string | null };
}

export interface ConversationRow {
  id: string;
  status: RequestShopStatus;
  shop: { id: string; name: string; logoAssetId: string | null };
  request: { id: string; number: number; title: string; status: QuoteRequestStatus };
  last: { body: string; senderSide: string; createdAt: string; attachmentFileIds: string[] } | null;
  unread: number;
}

export interface ShopReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { firstName: string | null };
  installationId: string;
  reply: { id: string; body: string; createdAt: string; moderationStatus: string } | null;
}

export interface PublicReviews {
  ratingAvg: Money;
  ratingCount: number;
  distribution: Array<{ rating: number; count: number }>;
  items: Array<{ id: string; rating: number; comment: string | null; createdAt: string; author: string | null; systemPowerKw: Money | null; systemType: SystemType | null; reply: { body: string; createdAt: string } | null }>;
  nextOffset: number | null;
}

export interface FavoriteRow {
  id: string;
  createdAt: string;
  shop: { id: string; slug: string; name: string; logoAssetId: string | null; ratingAvg: Money; ratingCount: number } | null;
  productModel: { id: string; slug: string; brand: string; model: string; nominalPowerW: number | null; category: { slug: string; nameI18n: Record<string, string> } } | null;
}
