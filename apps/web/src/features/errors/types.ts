export type ErrorSource = 'SERVER' | 'CLIENT';
export type ErrorSeverity = 'ERROR' | 'WARNING';
export type ErrorKind = 'HTTP' | 'UNHANDLED' | 'UI_CRASH' | 'UI_ERROR' | 'API_ERROR' | 'NETWORK';

export interface ErrorUser {
  id: string;
  accountNumber: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

export interface ErrorLogItem {
  id: string;
  source: ErrorSource;
  kind: ErrorKind;
  severity: ErrorSeverity;
  status: number | null;
  code: string | null;
  message: string;
  stack: string | null;
  method: string | null;
  path: string | null;
  pageUrl: string | null;
  requestId: string | null;
  userId: string | null;
  userRole: string | null;
  panel: string | null;
  platform: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  appVersion: string | null;
  context: Record<string, unknown> | null;
  fingerprint: string;
  resolvedAt: string | null;
  createdAt: string;
  user: ErrorUser | null;
}

export interface ErrorGroup {
  fingerprint: string;
  source: ErrorSource;
  kind: ErrorKind;
  severity: ErrorSeverity;
  status: number | null;
  code: string | null;
  message: string;
  method: string | null;
  path: string | null;
  pageUrl: string | null;
  count: number;
  users: number;
  openCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ErrorSummary {
  last24h: number;
  last24hErrors: number;
  openTotal: number;
  affectedUsers24h: number;
  bySource: Array<{ source: ErrorSource; count: number }>;
  byKind: Array<{ kind: ErrorKind; count: number }>;
  /** Hal qilinmagan xatolar, status bo‘yicha (0 — status yo‘q: interfeys/tarmoq). */
  byStatus: Array<{ status: number; count: number; lastSeenAt: string | null }>;
  daily: Array<{ day: string; total: number; errors: number }>;
}

export interface ErrorFilters {
  source?: ErrorSource | '';
  severity?: ErrorSeverity | '';
  panel?: string;
  platform?: string;
  /** Aniq status (0 — status yo‘q). */
  status?: string;
  statusClass?: '4xx' | '5xx' | 'none';
  state?: 'open' | 'resolved' | '';
  q?: string;
  accountNumber?: string;
  fingerprint?: string;
}

export interface ErrorPage {
  items: ErrorLogItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ErrorOverviewBucket {
  total: number;
  severe: number;
  open: number;
  affectedUsers: number;
}

export interface ErrorOverview {
  from: string;
  to: string;
  current: ErrorOverviewBucket;
  previous: ErrorOverviewBucket;
  series: Array<{ day: string; errors: number; warnings: number }>;
  categories: { client4xx: number; server5xx: number; ui: number; other: number };
  codes: Array<{ status: number; count: number }>;
}

export interface ErrorGroupRow extends ErrorGroup {
  panel: string | null;
  platform: string | null;
  resolved: boolean;
}

export interface ErrorGroupsPage {
  items: ErrorGroupRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ErrorGroupDetail {
  sample: ErrorLogItem & { user: (ErrorUser & { avatar?: string | null }) | null };
  fingerprint: string;
  count: number;
  users: number;
  openCount: number;
  resolved: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  daily: Array<{ day: string; count: number }>;
  topUsers: Array<{ count: number; user: (ErrorUser & { avatar?: string | null }) | null }>;
  recent: Array<{ id: string; createdAt: string; requestId: string | null; platform: string | null; panel: string | null; ipAddress: string | null; resolvedAt: string | null; user: { id: string; accountNumber: number; firstName: string | null; lastName: string | null } | null }>;
}

export interface ErrorGroupsPageFilters {
  q?: string;
  severity?: ErrorSeverity;
  state?: 'open' | 'resolved';
  source?: ErrorSource;
  statusClass?: '4xx' | '5xx' | 'none';
  status?: string;
  from?: string;
  to?: string;
  sort?: 'last' | 'count' | 'users';
  dir?: 'asc' | 'desc';
}
