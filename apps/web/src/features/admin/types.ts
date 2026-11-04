
export type DevOpsWindow = '1h' | '24h' | '7d' | '30d';

export interface DevOpsIssue {
  level: 'warning' | 'danger';
  message: string;
}

export interface DevOpsPing {
  ok: boolean;
  latencyMs: number | null;
}

export interface DevOpsTrafficPoint {
  at: string;
  count: number;
  errors: number;
  p95Ms: number | null;
}

export interface DevOpsSnapshot {
  checkedAt: string;
  issues: DevOpsIssue[];
  system: {
    hostname: string;
    platform: string;
    cpuCount: number;
    cpuPercent: number;
    loadAvg: [number, number, number];
    totalMemMB: number;
    freeMemMB: number;
    usedMemPercent: number;
    uptimeSeconds: number;
    disk: { totalGB: number; usedGB: number; freeGB: number; usedPercent: number } | null;
  };
  process: {
    supervisor: 'pm2' | 'systemd' | 'docker' | 'none';
    pid: number;
    nodeVersion: string;
    uptimeSeconds: number;
    rssMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    heapLimitMB: number;
    cpuUserMs: number;
    cpuSystemMs: number;
  };
  version: {
    appVersion: string;
    commit: string | null;
    environment: string;
    nodeVersion: string;
    startedAt: string;
  };
  dependencies: {
    database: DevOpsPing;
    redis: DevOpsPing;
    telegramAlerting: boolean;
  };
  backup: { configured: boolean; message: string; stale: boolean; ageHours: number | null; lastAt: string | null; sizeMB: number | null; file: string | null; count: number; keepDaily: number };
  /** Tashqi provayderlar: bugungi muvaffaqiyat/xato va oylik kvota (TZ 19.1.1). */
  providers: Array<{ key: string; label: string; provider: string; state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'; success: number; failure: number; avgLatencyMs: number | null; successRate: number | null; used: number; limit: number | null; usage: number | null; lastOkAt?: string | null; lastError?: string | null }>;
  openAlerts: number;
  lastDeploy: OpsDeployment | null;
  errors: { lastHour: number; last24h: number; logged24h: number; series: Array<{ at: string; count: number }> };
  history: Array<{ at: string; cpu: number; mem: number; disk: number | null; heapMB: number }>;
  traffic: DevOpsTrafficPoint[];
  trafficSummary: {
    requests: number;
    perMinute: number;
    errors: number;
    errorRate: number;
    p95Ms: number | null;
    previous: { perMinute: number; errorRate: number; p95Ms: number | null } | null;
  };
  topEndpoints: Array<{ route: string; count: number; percent: number }>;
}

export interface Dashboard {
  users: { total: number; new: number };
  shops: { total: number };
}

export type ManagedStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'BLOCKED' | 'DELETED';

export interface ShopMembershipInfo {
  shopId: string;
  memberRole: 'OWNER' | 'MANAGER' | 'STAFF';
  shop: { name: string; slug?: string; status: string };
}

export interface AdminUser {
  id: string;
  accountNumber: number;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Profil rasmi manzili (yuklangan rasm yoki Google rasmi). */
  avatar?: string | null;
  status: ManagedStatus;
  createdAt: string;
  deletedAt: string | null;
  lastLoginAt?: string | null;
  phoneVerifiedAt?: string | null;
  roles: Array<'CUSTOMER' | 'SHOP' | 'ADMIN'>;
  shopMemberships: ShopMembershipInfo[];
}

export interface AdminUsersPage {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminUserStats {
  total: { all: number; customers: number; shops: number; new30: number; growthPercent: number | null };
  active: { all: number; customers: number; shops: number };
  blocked: { all: number; customers: number; shops: number; suspended: number };
  pending: { all: number; customers: number; shops: number };
}

export interface UserFilters {
  role?: 'CUSTOMER' | 'SHOP' | 'ADMIN';
  status?: ManagedStatus;
  search?: string;
  sort?: 'createdAt' | 'lastLoginAt' | 'name';
  dir?: 'asc' | 'desc';
  from?: string;
  to?: string;
}

export interface AdminActor {
  accountNumber?: number;
  firstName: string | null;
  lastName: string | null;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actor?: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string } | null;
  before?: unknown;
  after?: unknown;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  ipAddress: string | null;
  requestId: string | null;
  device?: string | null;
  createdAt: string;
  /** Qisqa kod: AUD-XXXXXXXX. */
  code?: string;
  /** SUCCESS — oddiy bajarilgan; FAILED — rad etilgan yoki xato bilan tugagan. */
  outcome?: 'SUCCESS' | 'FAILED';
  /** Amal kimga nisbatan bajarilgan (foydalanuvchi yoki usta hujjati egasi). */
  targetUser?: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string } | null;
  targetDocumentType?: string | null;
  actorRole?: AuditActorRole;
}

export interface AdminUserDetail {
  id: string;
  accountNumber: number;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  /** Yuklangan profil rasmi (yoki Google rasmi) manzili. */
  avatar?: string | null;
  adminAvatarAllowed?: boolean;
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  deletedAt: string | null;
  /** O‘chirilgan akkaunt raqamidan qayta ro‘yxatdan o‘tish admin tomonidan taqiqlanganmi. */
  registrationBlocked?: boolean;
  /** Kirishda OTP so‘ralishi (superadmin boshqaradi). */
  twoFactorEnabled?: boolean;
  lastLoginAt: string | null;
  phoneVerifiedAt: string | null;
  roles: Array<'CUSTOMER' | 'SHOP' | 'ADMIN'>;
  shopMemberships: ShopMembershipInfo[];
  stats: { activeDevices: number };
  lastSession: { lastSeenAt: string; ipAddress: string | null; userAgent: string | null; panel: string | null } | null;
  account?: { googleLinked: boolean; googleEmail: string | null; hasPassword: boolean; createdByAdmin: boolean };
  recentActivity: Array<{ id: string; action: string; reason: string | null; actorId: string | null; actor?: { accountNumber: number } | null; createdAt: string }>;
}

export interface AdminBadges {
  users: number;
  pendingModels?: number;
  now: string;
}

export type AuditActorRole = 'ADMIN' | 'SHOP' | 'CUSTOMER' | 'SYSTEM';

export type AuditSummary = Record<AuditActorRole | 'ALL', number>;

export interface AuditPage {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuditStatsBucket {
  total: number;
  users: number;
  admins: number;
  system: number;
  security: number;
}

export interface AuditStats {
  current: AuditStatsBucket;
  previous: AuditStatsBucket | null;
}

export interface AuditRelated {
  items: Array<{ id: string; code: string; action: string; createdAt: string; reason: string | null; targetType: string | null; targetId: string | null; actor: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string } | null }>;
}

export interface AuditFilters {
  actorRole?: AuditActorRole | 'USERS';
  outcome?: 'SUCCESS' | 'FAILED';
  kind?: 'security';
  technical?: 'true';
  dir?: 'asc' | 'desc';
  actorNumber?: number;
  actorId?: string;
  action?: string;
  category?: string;
  targetType?: string;
  search?: string;
  from?: string;
  to?: string;
}

/** Admin akkaunti (superadmin ko‘radigan «Adminlar» ro‘yxati). */
export interface AdminAccount {
  id: string;
  accountNumber: number;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
  phoneVerifiedAt?: string | null;
  activeDevices?: number;
  avatar?: string | null;
  adminAvatarAllowed?: boolean;
  status: ManagedStatus;
  isSuperAdmin: boolean;
  adminPermissions?: string[];
  /** Superadmin belgilagan: bu admin yangi adminlar yarata oladimi va qaysi huquqlarni bera oladi. */
  canCreateAdmins?: boolean;
  grantablePermissions?: string[];
  createdByAdminId?: string | null;
  isSelf?: boolean;
  twoFactorEnabled?: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface AdminMyProfile {
  user: {
    id: string;
    accountNumber: number;
    phone: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    avatar?: string | null;
    adminAvatarAllowed: boolean;
    status: ManagedStatus;
    isSuperAdmin: boolean;
    twoFactorEnabled: boolean;
    phoneVerifiedAt: string | null;
    adminPermissions: string[];
    canCreateAdmins: boolean;
    grantablePermissions: string[];
    createdAt: string;
    lastLoginAt: string | null;
    hasPassword: boolean;
    googleLinked: boolean;
    googleEmail: string | null;
    createdBy: { accountNumber: number; firstName: string | null; lastName: string | null } | null;
  };
  stats: { actionsTotal: number; actions30d: number; logins30d: number; adminsCreated: number; activeDevices: number; firstActionAt: string | null; passwordChangedAt: string | null };
  activity: Array<{ id: string; action: string; targetType: string | null; reason: string | null; ipAddress: string | null; createdAt: string }>;
}

export interface AdminAccountsStats {
  total: number;
  totalWeekAgo: number;
  active: number;
  blocked: number;
  suspended: number;
  pending: number;
  mfaOn: number;
  mfaOff: number;
  superAdmins: number;
}

export interface AdminAccountDetails {
  sessions: Array<{ id: string; status: 'ACTIVE' | 'REVOKED' | string; panel: string | null; ipAddress: string | null; userAgent: string | null; lastSeenAt: string; createdAt: string; revokedAt: string | null }>;
  activity: Array<{ id: string; action: string; targetType: string | null; reason: string | null; createdAt: string }>;
  actions30d: number;
  passwordResetAt: string | null;
  createdBy: { accountNumber: number; firstName: string | null; lastName: string | null } | null;
}

export interface CreateAdminInput {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  isSuperAdmin?: boolean;
  permissions?: string[];
  canCreateAdmins?: boolean;
  grantablePermissions?: string[];
}

/** Joriy adminning adminlarni boshqarish doirasi (server qaytaradi). */
export interface AdminScope {
  superAdmin: boolean;
  grantable: string[];
}

export interface OpsDeployment {
  id: string;
  service: string;
  environment: string;
  version: string;
  gitSha: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  triggeredBy: string | null;
  changelogUrl: string | null;
}

export interface OpsAlert {
  id: string;
  fingerprint: string;
  alertName: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  status: 'FIRING' | 'RESOLVED';
  startsAt: string;
  endsAt: string | null;
  summary: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}
