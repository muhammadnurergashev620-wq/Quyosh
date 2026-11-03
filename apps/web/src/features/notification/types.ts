export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'READ';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  template?: string | null;
  data?: Record<string, unknown> | null;
  status: NotificationStatus;
  readAt: string | null;
  createdAt: string;
}
