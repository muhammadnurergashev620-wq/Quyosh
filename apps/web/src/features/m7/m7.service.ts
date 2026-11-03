import { apiDelete, apiDownload, apiGet, apiPatch, apiPost, apiPut, apiUpload } from '@/services/api.client';
import type {
  AdminArticle, AdminQueues, Article, ArticleCard, ArticleType, Certification, CustomerDashboard, Funnel, KCategory, Project, ReplyTemplate, ShopAnalytics,
  ShopDashboard, SystemDetail, SystemRow, Ticket, WidgetConfig,
} from './types';

const shop = (id: string) => `/manage/shops/${id}`;
const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]));
  return p.toString() ? `?${p}` : '';
};

export const uploadMedia = (kind: string, linkType: string, linkId: string, file: File) => {
  const form = new FormData();
  form.set('kind', kind);
  form.set('linkType', linkType);
  form.set('linkId', linkId);
  form.set('file', file);
  return apiUpload<{ id: string; status: string }>('/media/uploads', form);
};

export const m7Service = {
  // Kabinet
  systems: () => apiGet<SystemRow[]>('/installed-systems'),
  system: (id: string) => apiGet<SystemDetail>(`/installed-systems/${id}`),
  addSystem: (body: { title: string; systemPowerKw: number; systemType: string; installedAt: string; siteId?: string; components?: Array<{ title: string; quantity?: number }>; warranties?: Array<{ component: string; months: number }> }) => apiPost<SystemDetail>('/installed-systems', body),
  archiveSystem: (id: string) => apiDelete(`/installed-systems/${id}`),
  addReading: (id: string, body: { period: string; generatedKwh?: number; meterReading?: number }) => apiPost<{ reading: SystemDetail['readings'][number]; system: SystemDetail }>(`/installed-systems/${id}/readings`, body),
  reminder: (id: string, reminderId: string, action: 'DONE' | 'SNOOZE' | 'DISABLE' | 'ENABLE') => apiPatch(`/installed-systems/${id}/reminders/${reminderId}`, { action }),

  // Bosh panellar va analitika
  customerDashboard: () => apiGet<CustomerDashboard>('/me/dashboard'),
  shopDashboard: (shopId: string) => apiGet<ShopDashboard>(`${shop(shopId)}/dashboard`),
  shopAnalytics: (shopId: string, from?: string, to?: string) => apiGet<ShopAnalytics>(`${shop(shopId)}/analytics${qs({ from, to })}`),
  shopAnalyticsCsv: (shopId: string, from?: string, to?: string) => apiDownload(`${shop(shopId)}/analytics.csv${qs({ from, to })}`, 'analitika.csv'),
  adminQueues: () => apiGet<AdminQueues>('/admin/queues'),
  funnel: (from?: string, to?: string, region?: string) => apiGet<Funnel>(`/admin/analytics/funnel${qs({ from, to, region })}`),

  // Portfolio, sertifikatlar, vidjet
  projects: (shopId: string) => apiGet<{ items: Project[]; confirmedInstallations: Array<{ id: string; confirmedAt: string; quote: { systemPowerKw: string | null; systemType: string | null; request: { number: number; regionCode: string | null } } }> }>(`${shop(shopId)}/projects`),
  saveProject: (shopId: string, id: string | null, body: Record<string, unknown>) => (id ? apiPut<Project>(`${shop(shopId)}/projects/${id}`, body) : apiPost<Project>(`${shop(shopId)}/projects`, body)),
  deleteProject: (shopId: string, id: string) => apiDelete(`${shop(shopId)}/projects/${id}`),
  publicProjects: (slug: string) => apiGet<Project[]>(`/shops/${encodeURIComponent(slug)}/projects`),
  certifications: (shopId: string) => apiGet<Certification[]>(`${shop(shopId)}/certifications`),
  saveCertification: (shopId: string, id: string | null, body: Record<string, unknown>) => (id ? apiPut<Certification>(`${shop(shopId)}/certifications/${id}`, body) : apiPost<Certification>(`${shop(shopId)}/certifications`, body)),
  deleteCertification: (shopId: string, id: string) => apiDelete(`${shop(shopId)}/certifications/${id}`),
  adminCertifications: (status: string) => apiGet<Certification[]>(`/admin/certifications?status=${status}`),
  reviewCertification: (id: string, decision: 'APPROVED' | 'REJECTED', reason?: string) => apiPatch(`/admin/certifications/${id}`, { decision, reason }),
  widget: (shopId: string) => apiGet<WidgetConfig>(`${shop(shopId)}/widget`),
  saveWidget: (shopId: string, body: Partial<Pick<WidgetConfig, 'allowedDomains' | 'active'>> & { theme?: Partial<WidgetConfig['theme']> }) => apiPut<WidgetConfig>(`${shop(shopId)}/widget`, body),
  mediaUrl: (id: string, variant: 'thumbnail' | 'medium' | 'original' = 'original') => apiGet<{ url: string }>(`/media/${id}/${variant}`),

  // Yordam
  suggestions: (q: string) => apiGet<ArticleCard[]>(`/support/suggestions${qs({ q })}`),
  guestOtp: (phone: string) => apiPost<{ sent: boolean; resendAfter: number; developmentCode?: string }>('/support/guest-otp', { phone }),
  createTicket: (body: Record<string, unknown>) => apiPost<{ id: string; number: number; code: string; firstResponseDueAt: string }>('/support/tickets', body),
  tickets: () => apiGet<Ticket[]>('/support/tickets'),
  ticket: (id: string) => apiGet<Ticket>(`/support/tickets/${id}`),
  replyTicket: (id: string, body: string, attachmentIds?: string[]) => apiPost<Ticket>(`/support/tickets/${id}/messages`, { body, attachmentIds }),
  resolveTicket: (id: string) => apiPost<Ticket>(`/support/tickets/${id}/resolve`),
  reopenTicket: (id: string) => apiPost<Ticket>(`/support/tickets/${id}/reopen`),
  rateTicket: (id: string, score: number) => apiPost(`/support/tickets/${id}/rate`, { score }),
  adminTickets: (params: { status?: string; priority?: string; assignee?: string; search?: string }) => apiGet<Ticket[]>(`/admin/support/tickets${qs(params)}`),
  adminTicket: (id: string) => apiGet<Ticket>(`/admin/support/tickets/${id}`),
  adminUpdateTicket: (id: string, body: Record<string, unknown>) => apiPatch<Ticket>(`/admin/support/tickets/${id}`, body),
  adminReply: (id: string, body: { body: string; internal?: boolean; status?: string }) => apiPost<Ticket>(`/admin/support/tickets/${id}/messages`, body),
  templates: () => apiGet<ReplyTemplate[]>('/admin/support/reply-templates'),

  // Bilimlar markazi
  kCategories: () => apiGet<KCategory[]>('/knowledge/categories'),
  articles: (params: { category?: string; type?: ArticleType; q?: string; offset?: number; limit?: number }) => apiGet<{ items: ArticleCard[]; total: number; nextOffset: number | null }>(`/knowledge/articles${qs(params)}`),
  beginner: () => apiGet<ArticleCard[]>('/knowledge/beginner'),
  glossary: () => apiGet<Array<ArticleCard & { bodyI18n: Record<string, string> }>>('/knowledge/glossary'),
  article: (slug: string) => apiGet<Article>(`/knowledge/articles/${encodeURIComponent(slug)}`),
  helpful: (slug: string, helpful: boolean) => apiPost(`/knowledge/articles/${encodeURIComponent(slug)}/helpful`, { helpful }),
  adminArticles: () => apiGet<AdminArticle[]>('/admin/knowledge/articles'),
  adminArticle: (id: string) => apiGet<AdminArticle & { categoryId: string }>(`/admin/knowledge/articles/${id}`),
  saveArticle: (id: string | null, body: Record<string, unknown>) => (id ? apiPut<AdminArticle>(`/admin/knowledge/articles/${id}`, body) : apiPost<AdminArticle>('/admin/knowledge/articles', body)),

  // Hisobni o‘chirish
  cancelDeletion: () => apiPost('/users/me/delete-account/cancel'),
};
