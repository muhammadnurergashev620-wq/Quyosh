export interface RegisterInput {
  phone: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface RegisterResult {
  userId: string;
  verificationRequired: true;
  developmentCode?: string;
  existingAccount?: boolean;
  accountNumber?: number;
}

export type GoogleSignInResult =
  | ({ needsPhone: false; verificationRequired: false } & Record<string, unknown>)
  | { needsPhone: true; signupToken: string; firstName: string | null; lastName: string | null };

export interface LoginInput {
  phone: string;
  password: string;
  /** Kodni SMS orqali olish (standart — email). */
  codeChannel?: 'SMS';
}

/** Kod qayerga yuborilgani (email yoki SMS), manzil yashirin ko‘rinishda. */
export interface CodeDelivery {
  channel: 'EMAIL' | 'SMS' | 'NONE';
  destination?: string;
}

export interface DeviceLimitInfo {
  reached: true;
  max: number;
  active: number;
}

export interface LoginResult {
  /** false — ikki bosqichli autentifikatsiya o‘chirilgan: OTP so‘ralmaydi, sessiya shu javobda ochilgan. */
  verificationRequired: boolean;
  /** Yangi qurilma uchun faol qurilmalar limiti to‘lgan bo‘lsa — kod kiritishdan oldin ogohlantirish uchun. */
  deviceLimit?: DeviceLimitInfo;
  developmentCode?: string;
  /** Kod qayerga yuborilgani. */
  delivery?: CodeDelivery;
  /** SMS orqali yuborish mumkinmi (xizmat ulangan bo‘lsa). */
  smsAvailable?: boolean;
}

export interface VerifyOtpInput {
  phone: string;
  code: string;
}

export interface VerifyOtpResult {
  userId: string;
  deviceId: string;
  sessionId: string;
}

export interface VerifyRegistrationResult {
  id: string;
  phone: string;
  status: string;
}

export type DeviceSessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface DeviceSession {
  id: string;
  status: DeviceSessionStatus;
  userAgent: string | null;
  ipAddress: string | null;
  panel: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
  canRevoke: boolean;
  revokeLockedUntil: string | null;
}
