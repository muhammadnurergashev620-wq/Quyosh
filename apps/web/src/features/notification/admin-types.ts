export type AdminNotificationCategory = 'SHOP' | 'DISPUTE' | 'DOCUMENT' | 'USER' | 'ORDER' | 'CHAT' | 'CONTENT' | 'SYSTEM';
export type AdminNotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AdminNotificationItem {
  id: string;
  channel: string;
  title: string;
  body: string;
  template: string | null;
  status: string;
  read: boolean;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
  category: AdminNotificationCategory;
  priority: AdminNotificationPriority;
  action: string | null;
  actor: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; avatar?: string | null; role: 'ADMIN' | 'SHOP' | 'CUSTOMER' } | null;
  object: { type: string; id: string | null; number: number | null } | null;
  path: string | null;
}

export interface AdminNotificationsPage {
  items: AdminNotificationItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  unread: number;
  truncated: boolean;
}

export interface AdminNotificationBucket {
  total: number;
  last7: number;
  prev7: number;
  changePercent: number | null;
}

export interface AdminNotificationStats {
  total: AdminNotificationBucket;
  unread: AdminNotificationBucket;
  important: AdminNotificationBucket;
  system: AdminNotificationBucket;
  truncated: boolean;
}

export interface AdminNotificationDetail {
  id: string;
  channel: string;
  title: string;
  body: string;
  template: string | null;
  status: string;
  read: boolean;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
  error: string | null;
  category: AdminNotificationCategory;
  priority: AdminNotificationPriority;
  action: string | null;
  path: string | null;
  audit: {
    id: string;
    action: string;
    reason: string | null;
    ipAddress: string | null;
    createdAt: string;
    targetType: string | null;
    targetId: string | null;
    actor: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string; role: string } | null;
  } | null;
  order: { id: string; orderNumber: number; status: string; finalAmount: string; currency: string; createdAt: string; category: string | null; customer: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string } } | null;
  targetUser: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string; role: string } | null;
  events: Array<{ kind: 'created' | 'sent' | 'audit' | 'read'; at: string; label: string }>;
}

export interface AdminNotificationFilters {
  search?: string;
  category?: AdminNotificationCategory;
  priority?: AdminNotificationPriority;
  state?: 'UNREAD' | 'READ';
  from?: string;
  to?: string;
  dir?: 'asc' | 'desc';
}
