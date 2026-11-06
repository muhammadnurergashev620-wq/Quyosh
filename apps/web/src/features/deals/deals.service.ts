import { apiDelete, apiDownload, apiGet, apiPatch, apiPost, apiPut, apiUpload } from '@/services/api.client';
import type {
  QuoteTemplate,
  BuilderCatalog, ChatMessage, ChecklistAnswer, ChecklistEvaluation, ChecklistTemplateItem, CompareRow, ConversationRow, ConversationView, FavoriteRow,
  InstallationRow, InstallationStatus, InstallationView, PipelineStage, PublicReviews, QuoteInput, QuoteRequestDetail, QuoteRequestRow, QuoteRevisionSnapshot,
  QuoteView, RequestLimits, RequestShopStatus, ShopLeadRow, ShopLeadView, ShopReviewRow, SiteVisit,
} from './types';
import type { SystemType } from '@/features/calc/types';

export interface CreateRequestInput {
  calculationId?: string;
  siteId?: string;
  title?: string;
  systemType: SystemType;
  requiredCapacityKw?: number;
  batteryNeeded?: boolean;
  installationNeeded?: boolean;
  financingInterest?: boolean;
  notes?: string;
  shopIds: string[];
}

const shop = (shopId: string) => `/manage/shops/${shopId}`;

export const dealsService = {
  // Mijoz: so‘rovlar
  limits: () => apiGet<RequestLimits>('/quote-requests/limits'),
  createRequest: (input: CreateRequestInput, idempotencyKey: string) => apiPost<{ id: string; number: number; shopCount: number }>('/quote-requests', input, idempotencyKey),
  myRequests: () => apiGet<QuoteRequestRow[]>('/quote-requests/me'),
  request: (id: string) => apiGet<QuoteRequestDetail>(`/quote-requests/${id}`),
  addShops: (id: string, shopIds: string[]) => apiPost<{ added: number }>(`/quote-requests/${id}/shops`, { shopIds }),
  revealContact: (id: string, shopId: string) => apiPost<{ contactRevealedAt: string }>(`/quote-requests/${id}/reveal-contact`, { shopId }),
  closeRequest: (id: string) => apiPost<{ status: string }>(`/quote-requests/${id}/close`),
  compare: (id: string) => apiGet<{ request: { id: string; number: number; status: string; calculationId: string | null }; quotes: CompareRow[] }>(`/quote-requests/${id}/compare`),

  // Yozishma (ikki tomon)
  conversations: () => apiGet<ConversationRow[]>('/request-shops/conversations'),
  conversation: (rsId: string) => apiGet<ConversationView>(`/request-shops/${rsId}`),
  messages: (rsId: string, cursor?: string) => apiGet<{ side: 'CUSTOMER' | 'SHOP'; items: ChatMessage[]; nextCursor: string | null }>(`/request-shops/${rsId}/messages${cursor ? `?cursor=${cursor}` : ''}`),
  send: (rsId: string, body: { body?: string; attachmentIds?: string[]; clientId: string; asClarification?: boolean }) => apiPost<ChatMessage>(`/request-shops/${rsId}/messages`, body),
  markRead: (rsId: string) => apiPost<{ count: number }>(`/request-shops/${rsId}/messages/read`),
  upload: (linkType: 'RequestShop' | 'Installation', linkId: string, file: File) => {
    const form = new FormData();
    form.set('kind', 'MESSAGE_ATTACHMENT');
    form.set('linkType', linkType);
    form.set('linkId', linkId);
    form.set('file', file);
    return apiUpload<{ id: string; status: string }>('/media/uploads', form);
  },
  proposeVisit: (rsId: string, slots: Array<{ start: string; end: string }>, notes?: string) => apiPost<SiteVisit>(`/request-shops/${rsId}/site-visits`, { slots, notes }),
  updateVisit: (rsId: string, visitId: string, body: { action: 'CONFIRM' | 'CANCEL' | 'DONE' | 'REQUEST_OTHER'; slotIndex?: number; reason?: string }) => apiPatch<SiteVisit>(`/request-shops/${rsId}/site-visits/${visitId}`, body),
  visitIcs: (rsId: string, visitId: string) => apiDownload(`/request-shops/${rsId}/site-visits/${visitId}/ics`, 'olchov.ics'),

  // Do‘kon: inbox
  shopRequests: (shopId: string, params: { status?: RequestShopStatus; stage?: PipelineStage; assigned?: 'mine' } = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as Array<[string, string]>).toString();
    return apiGet<{ items: ShopLeadRow[]; nextCursor: string | null }>(`${shop(shopId)}/requests${q ? `?${q}` : ''}`);
  },
  shopRequest: (shopId: string, rsId: string) => apiGet<ShopLeadView>(`${shop(shopId)}/requests/${rsId}`),
  updateLead: (shopId: string, rsId: string, body: { pipelineStage?: PipelineStage; assignedMemberId?: string; unassign?: boolean }) => apiPatch<ShopLeadView>(`${shop(shopId)}/requests/${rsId}`, body),
  decline: (shopId: string, rsId: string, reason: string) => apiPost<ShopLeadView>(`${shop(shopId)}/requests/${rsId}/decline`, { reason }),
  addNote: (shopId: string, rsId: string, body: string) => apiPost<ShopLeadView['notes']>(`${shop(shopId)}/requests/${rsId}/notes`, { body }),
  shopQuoteFor: (shopId: string, rsId: string) => apiGet<QuoteView | null>(`${shop(shopId)}/requests/${rsId}/quote`),
  quoteTemplates: (shopId: string) => apiGet<QuoteTemplate[]>(`${shop(shopId)}/quote-templates`),
  saveQuoteTemplate: (shopId: string, body: { name: string; items: QuoteTemplate['items']; defaults: QuoteTemplate['defaults'] }, id?: string) =>
    id ? apiPut<QuoteTemplate>(`${shop(shopId)}/quote-templates/${id}`, body) : apiPost<QuoteTemplate>(`${shop(shopId)}/quote-templates`, body),
  deleteQuoteTemplate: (shopId: string, id: string) => apiDelete(`${shop(shopId)}/quote-templates/${id}`),
  builderCatalog: (shopId: string, search?: string) => apiGet<BuilderCatalog>(`${shop(shopId)}/quote-builder/catalog${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  // Takliflar
  createQuote: (requestId: string, shopId: string, input: QuoteInput, idempotencyKey: string) => apiPost<QuoteView>(`/quote-requests/${requestId}/quotes`, { shopId, ...input }, idempotencyKey),
  updateQuote: (id: string, version: number, input: QuoteInput) => apiPatch<QuoteView>(`/quotes/${id}`, { version, ...input }),
  sendQuote: (id: string, idempotencyKey: string) => apiPost<QuoteView>(`/quotes/${id}/send`, {}, idempotencyKey),
  reviseQuote: (id: string, version: number, input: QuoteInput) => apiPost<QuoteView>(`/quotes/${id}/revise`, { version, ...input }),
  withdrawQuote: (id: string) => apiPost<{ status: string }>(`/quotes/${id}/withdraw`),
  quote: (id: string) => apiGet<QuoteView>(`/quotes/${id}`),
  revision: (id: string, revision: number) => apiGet<QuoteRevisionSnapshot>(`/quotes/${id}/revisions/${revision}`),
  acceptQuote: (id: string) => apiPost<{ status: string; installationId: string }>(`/quotes/${id}/accept`),
  rejectQuote: (id: string, reason?: string) => apiPost<{ status: string }>(`/quotes/${id}/reject`, { reason }),
  quotePdf: (id: string, lang: 'uz' | 'oz' | 'ru' | 'en', number: number) => apiDownload(`/quotes/${id}/pdf?lang=${lang}`, `taklif-${number}.pdf`),

  // Montaj
  installations: (status?: InstallationStatus) => apiGet<InstallationRow[]>(`/installations${status ? `?status=${status}` : ''}`),
  shopInstallations: (shopId: string, status?: InstallationStatus) => apiGet<InstallationRow[]>(`${shop(shopId)}/installations${status ? `?status=${status}` : ''}`),
  installation: (id: string) => apiGet<InstallationView>(`/installations/${id}`),
  updateInstallation: (id: string, body: { action: 'SCHEDULE' | 'MARK_INSTALLED' | 'CANCEL'; scheduledDate?: string; reason?: string; note?: string }) => apiPatch<InstallationView>(`/installations/${id}`, body),
  checklist: (id: string) => apiGet<{ status: InstallationStatus; items: ChecklistTemplateItem[]; result: ChecklistAnswer[]; evaluation: ChecklistEvaluation | null }>(`/installations/${id}/checklist`),
  saveChecklist: (id: string, items: ChecklistAnswer[]) => apiPut<{ result: ChecklistAnswer[]; evaluation: ChecklistEvaluation }>(`/installations/${id}/checklist`, { items }),
  confirmInstallation: (id: string, acceptWithIssues = false) => apiPost<InstallationView>(`/installations/${id}/confirm`, { acceptWithIssues }),
  requestFix: (id: string) => apiPost<{ ok: true }>(`/installations/${id}/request-fix`),
  dispute: (id: string, reason: string, photoFileIds: string[] = []) => apiPost<InstallationView>(`/installations/${id}/dispute`, { reason, photoFileIds }),

  // Sharh, sevimlilar, shikoyat
  createReview: (installationId: string, rating: number, comment?: string) => apiPost<{ id: string; moderationStatus: 'PENDING' | 'PUBLISHED' }>('/reviews', { installationId, rating, comment }),
  shopReviews: (shopId: string) => apiGet<ShopReviewRow[]>(`${shop(shopId)}/reviews`),
  replyReview: (shopId: string, reviewId: string, body: string) => apiPost(`${shop(shopId)}/reviews/${reviewId}/reply`, { body }),
  publicReviews: (slug: string, offset = 0) => apiGet<PublicReviews>(`/shops/${encodeURIComponent(slug)}/reviews?offset=${offset}`),
  favorites: () => apiGet<FavoriteRow[]>('/favorites'),
  addFavorite: (target: { shopId?: string; productModelId?: string }) => apiPost('/favorites', target),
  removeFavorite: (target: { shopId?: string; productModelId?: string }) => apiDelete(`/favorites?${new URLSearchParams(target as Record<string, string>).toString()}`),
  complain: (body: { targetType: 'REVIEW' | 'SHOP' | 'PRODUCT_MODEL' | 'MESSAGE' | 'USER'; targetId: string; reason: 'SPAM' | 'FAKE' | 'ABUSE' | 'WRONG_INFO' | 'OTHER'; details?: string }) => apiPost('/complaints', body),
};

export interface AdminReviewRow {
  id: string; rating: number; comment: string | null; moderationStatus: 'PENDING' | 'PUBLISHED' | 'HIDDEN'; riskFlags: string[]; riskScore: number; createdAt: string; moderatedAt: string | null;
  user: { id: string; firstName: string | null; lastName: string | null; phone: string | null; createdAt: string };
  shop: { id: string; name: string; slug: string };
  installation: { id: string; installedAt: string | null; confirmedAt: string | null };
}
export interface AdminComplaintRow { id: string; reporterId: string | null; targetType: string; targetId: string; reason: string; details: string | null; status: string; createdAt: string }
export interface AdminDisputeRow { id: string; status: string; disputeReason: string | null; updatedAt: string; shop: { id: string; name: string }; quote: { total: string; request: { number: number } }; user: { firstName: string | null; lastName: string | null; phone: string | null } }

/** Admin: sharh moderatsiyasi, shikoyatlar, montaj e’tirozlari, ModerationSettings (TZ 13.4, 9.11). */
export const adminDealsService = {
  reviews: (status: 'PENDING' | 'PUBLISHED' | 'HIDDEN') => apiGet<AdminReviewRow[]>(`/admin/reviews?status=${status}`),
  moderate: (id: string, decision: 'PUBLISHED' | 'HIDDEN', note?: string) => apiPost(`/admin/reviews/${id}/moderate`, { decision, note }),
  complaints: (status: 'OPEN' | 'RESOLVED' | 'REJECTED') => apiGet<AdminComplaintRow[]>(`/admin/complaints?status=${status}`),
  resolveComplaint: (id: string, status: 'RESOLVED' | 'REJECTED') => apiPost(`/admin/complaints/${id}/resolve`, { status }),
  disputes: () => apiGet<AdminDisputeRow[]>('/admin/installations/disputes'),
  resolveDispute: (id: string, decision: 'CONFIRMED' | 'CANCELLED', note: string) => apiPost(`/admin/installations/${id}/resolve`, { decision, note }),
  settings: () => apiGet<{ version: number; rules: Record<string, unknown> & { scores: Record<string, number> }; updatedAt: string | null }>('/admin/moderation-settings'),
  saveSettings: (rules: Record<string, unknown>) => apiPut('/admin/moderation-settings', { rules }),
};
