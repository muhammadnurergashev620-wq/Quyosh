export type ShopStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'SUSPENDED';
export type ShopVerificationStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type ShopMemberRole = 'OWNER' | 'MANAGER' | 'STAFF';
export type ServiceType = 'INSTALLATION' | 'SITE_VISIT' | 'AUDIT' | 'MAINTENANCE' | 'DELIVERY';
export type PricingModel = 'FIXED' | 'FROM' | 'PER_KW' | 'PER_UNIT' | 'QUOTE_REQUIRED';
export type Currency = 'UZS' | 'USD';
export type StockStatus = 'IN_STOCK' | 'ON_ORDER' | 'OUT_OF_STOCK';
export type ShopProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type I18nText = { uz: string; oz?: string; ru?: string };

export interface MyShop {
  id: string;
  slug: string;
  name: string;
  status: ShopStatus;
  verificationStatus: ShopVerificationStatus;
  logoAssetId: string | null;
  memberRole: ShopMemberRole;
  permissions: string[];
}

export interface Shop {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoAssetId: string | null;
  coverAssetId: string | null;
  stir: string | null;
  phone: string | null;
  email: string | null;
  status: ShopStatus;
  verificationStatus: ShopVerificationStatus;
  createdSource: 'SELF' | 'ADMIN';
  suspendReason: string | null;
  ratingAvg: string;
  ratingCount: number;
  createdAt: string;
}

export interface ManagedShop extends Shop {
  counts: { branches: number; products: number; services: number };
  completeness: number;
  checklist: Array<{ key: 'profile' | 'branch' | 'serviceArea' | 'products'; done: boolean }>;
  membership: { memberRole: ShopMemberRole; permissions: string[] };
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  regionCode: string | null;
  phone: string | null;
  openingHoursJson: OpeningHours | null;
  holidayExceptionsJson: unknown[] | null;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  lat?: number | null;
  lon?: number | null;
  hasServiceArea?: boolean;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type OpeningHours = Partial<Record<Weekday, Array<[string, string]>>>;

export interface BranchInput {
  name: string;
  address: string;
  regionCode?: string;
  phone?: string;
  openingHoursJson?: OpeningHours;
  status?: 'ACTIVE' | 'INACTIVE';
  lat?: number | null;
  lon?: number | null;
}

export interface ShopService {
  id: string;
  serviceType: ServiceType;
  pricingModel: PricingModel;
  price: string | null;
  currency: Currency;
  branchId: string | null;
  descriptionI18n: Partial<I18nText> | null;
  warrantyMonths: number | null;
  active: boolean;
}

export type ServiceInput = Omit<ShopService, 'id' | 'price' | 'branchId' | 'descriptionI18n' | 'warrantyMonths'> & {
  price?: string;
  branchId?: string;
  descriptionI18n?: Partial<I18nText>;
  warrantyMonths?: number;
};

export interface MemberUser {
  id: string;
  accountNumber: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  avatarAssetId: string | null;
  /** Vaqtincha parol hali almashtirilmagan (admin ko‘rinishi). */
  mustPasswordChange?: boolean;
}

export interface ShopMember {
  id: string;
  memberRole: ShopMemberRole;
  permissions: string[];
  createdAt: string;
  user: MemberUser;
}

