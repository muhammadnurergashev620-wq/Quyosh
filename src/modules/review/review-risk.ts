/** TZ 13.4: soxta sharhlarga qarshi deterministik belgilar. Chegaralar ModerationSettings da. */
export interface ModerationRules {
  pendingThreshold: number;
  selfReviewLookbackDays: number;
  sharedDeviceLookbackDays: number;
  newAccountDays: number;
  fastConfirmHours: number;
  burstWindowHours: number;
  burstCount: number;
  duplicateSimilarity: number;
  ipClusterLookbackDays: number;
  ipClusterAccounts: number;
  autoComplaintBlockedCount: number;
  autoComplaintWindowDays: number;
  scores: Record<'SHARED_DEVICE_WITH_SHOP' | 'NEW_ACCOUNT' | 'FAST_CONFIRM' | 'BURST' | 'DUPLICATE_TEXT' | 'SAME_IP_CLUSTER' | 'CONTACT_IN_TEXT', number>;
}

export const DEFAULT_MODERATION_RULES: ModerationRules = {
  pendingThreshold: 40,
  selfReviewLookbackDays: 90,
  sharedDeviceLookbackDays: 30,
  newAccountDays: 7,
  fastConfirmHours: 2,
  burstWindowHours: 24,
  burstCount: 5,
  duplicateSimilarity: 0.8,
  ipClusterLookbackDays: 30,
  ipClusterAccounts: 3,
  autoComplaintBlockedCount: 3,
  autoComplaintWindowDays: 30,
  scores: { SHARED_DEVICE_WITH_SHOP: 60, NEW_ACCOUNT: 20, FAST_CONFIRM: 20, BURST: 30, DUPLICATE_TEXT: 40, SAME_IP_CLUSTER: 40, CONTACT_IN_TEXT: 20 },
};

export interface RiskSignals {
  /** Muallif shu do‘kon a’zosi (yoki lookback ichida a’zo bo‘lgan). */
  selfReview: boolean;
  sharedDeviceWithShop: boolean;
  accountAgeDays: number;
  /** Akkauntning boshqa faolligi (hisoblar, so‘rovlar va h.k.) bormi. */
  hasOtherActivity: boolean;
  /** INSTALLED → CONFIRMED oralig‘i (soat). */
  confirmDelayHours: number | null;
  /** Shu do‘konga oxirgi burstWindowHours ichidagi sharhlar soni (yangisisiz). */
  recentShopReviews: number;
  /** Shu do‘kondagi boshqa sharhlar bilan eng katta trigram o‘xshashligi (0..1). */
  maxSimilarity: number;
  /** Shu ipHash dan oxirgi davrda sharh yozgan turli akkauntlar soni (shu muallif ham kiradi). */
  ipDistinctAccounts: number;
  comment: string | null;
}

export interface RiskResult {
  blocked: boolean;
  flags: string[];
  score: number;
  status: 'PENDING' | 'PUBLISHED';
}

const PHONE = /(?:\+?998[\s-]?)?(?:\(?\d{2}\)?[\s-]?)\d{3}[\s-]?\d{2}[\s-]?\d{2}/;
const LINK = /(?:https?:\/\/|www\.|t\.me\/|@[a-z0-9_]{4,}|\b[a-z0-9-]+\.(?:uz|com|ru|net|org|me|io)\b)/i;

export const containsContact = (text: string | null | undefined): boolean => !!text && (PHONE.test(text) || LINK.test(text));

export function scoreReviewRisk(signals: RiskSignals, rules: ModerationRules = DEFAULT_MODERATION_RULES): RiskResult {
  if (signals.selfReview) return { blocked: true, flags: ['SELF_REVIEW'], score: 100, status: 'PENDING' };
  const flags: string[] = [];
  const add = (flag: keyof ModerationRules['scores'], when: boolean) => {
    if (when) flags.push(flag);
  };
  add('SHARED_DEVICE_WITH_SHOP', signals.sharedDeviceWithShop);
  add('NEW_ACCOUNT', signals.accountAgeDays < rules.newAccountDays && !signals.hasOtherActivity);
  add('FAST_CONFIRM', signals.confirmDelayHours !== null && signals.confirmDelayHours < rules.fastConfirmHours);
  add('BURST', signals.recentShopReviews + 1 >= rules.burstCount);
  add('DUPLICATE_TEXT', signals.maxSimilarity >= rules.duplicateSimilarity);
  add('SAME_IP_CLUSTER', signals.ipDistinctAccounts >= rules.ipClusterAccounts);
  add('CONTACT_IN_TEXT', containsContact(signals.comment));
  const score = flags.reduce((sum, flag) => sum + rules.scores[flag as keyof ModerationRules['scores']], 0);
  return { blocked: false, flags, score, status: score >= rules.pendingThreshold ? 'PENDING' : 'PUBLISHED' };
}
