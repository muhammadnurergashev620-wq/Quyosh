/**
 * TZ 14.2 bildirishnoma kanallari (Telegram olib tashlangan — 2026-11-01). IN_APP har doim; SMS/EMAIL — tur bo‘yicha
 * standart va foydalanuvchi sozlamasi. SECURITY_ALERT o‘chirib bo‘lmaydi.
 */
export type ExternalChannel = 'SMS' | 'EMAIL';

export interface ChannelRule {
  /** Standart yoqilgan tashqi kanallar. */
  defaults: ExternalChannel[];
  /** Foydalanuvchi tanlashi mumkin bo‘lgan kanallar. */
  allowed: ExternalChannel[];
  /** O‘chirib bo‘lmaydi. */
  locked?: boolean;
  /** Sozlamalar sahifasidagi guruh. */
  audience: 'CUSTOMER' | 'SHOP' | 'ALL';
}

export const CHANNEL_RULES: Record<string, ChannelRule> = {
  QUOTE_REQUEST_RECEIVED: { defaults: ['SMS'], allowed: ['SMS', 'EMAIL'], audience: 'SHOP' },
  NEW_MESSAGE: { defaults: [], allowed: ['SMS', 'EMAIL'], audience: 'ALL' },
  QUOTE_RECEIVED: { defaults: ['SMS'], allowed: ['SMS', 'EMAIL'], audience: 'CUSTOMER' },
  QUOTE_REVISED: { defaults: ['SMS'], allowed: ['SMS', 'EMAIL'], audience: 'CUSTOMER' },
  QUOTE_ACCEPTED: { defaults: [], allowed: ['SMS', 'EMAIL'], audience: 'SHOP' },
  QUOTE_NOT_SELECTED: { defaults: [], allowed: ['EMAIL'], audience: 'SHOP' },
  QUOTE_EXPIRING: { defaults: [], allowed: ['SMS', 'EMAIL'], audience: 'CUSTOMER' },
  SITE_VISIT_PROPOSED: { defaults: ['SMS'], allowed: ['SMS', 'EMAIL'], audience: 'ALL' },
  SITE_VISIT_CONFIRMED: { defaults: ['SMS'], allowed: ['SMS', 'EMAIL'], audience: 'ALL' },
  INSTALLATION_STATUS_CHANGED: { defaults: [], allowed: ['SMS', 'EMAIL'], audience: 'CUSTOMER' },
  INSTALLATION_CONFIRM_REMINDER: { defaults: ['SMS'], allowed: ['SMS', 'EMAIL'], audience: 'CUSTOMER' },
  INSTALLATION_ISSUE_REPORTED: { defaults: [], allowed: ['SMS', 'EMAIL'], audience: 'SHOP' },
  REVIEW_PUBLISHED: { defaults: [], allowed: ['EMAIL'], audience: 'SHOP' },
  REVIEW_REPLY: { defaults: [], allowed: ['EMAIL'], audience: 'CUSTOMER' },
  MAINTENANCE_REMINDER: { defaults: [], allowed: ['SMS', 'EMAIL'], audience: 'CUSTOMER' },
  WARRANTY_EXPIRING: { defaults: ['EMAIL'], allowed: ['SMS', 'EMAIL'], audience: 'CUSTOMER' },
  SUPPORT_REPLY: { defaults: ['EMAIL'], allowed: ['SMS', 'EMAIL'], audience: 'ALL' },
  SUPPORT_RESOLVED: { defaults: ['EMAIL'], allowed: ['SMS', 'EMAIL'], audience: 'ALL' },
  CERTIFICATION_RESULT: { defaults: ['EMAIL'], allowed: ['SMS', 'EMAIL'], audience: 'SHOP' },
  CERTIFICATION_EXPIRING: { defaults: ['EMAIL'], allowed: ['SMS', 'EMAIL'], audience: 'SHOP' },
  SECURITY_ALERT: { defaults: ['SMS', 'EMAIL'], allowed: ['SMS', 'EMAIL'], locked: true, audience: 'ALL' },
};

/** Kanallar: sozlama bo‘lsa — undan (ruxsat etilganlar bilan kesishma), aks holda standart; locked — har doim standart. */
export function resolveChannels(type: string, preference: string[] | null | undefined): ExternalChannel[] {
  const rule = CHANNEL_RULES[type];
  if (!rule) return [];
  if (rule.locked || !preference) return rule.defaults;
  return rule.allowed.filter((c) => preference.includes(c));
}

const TZ_OFFSET = 5 * 3_600_000;
/** SMS tungi vaqtda (22:00–08:00 Toshkent) faqat SECURITY_ALERT — boshqalari 08:00 ga qoldiriladi. */
export function smsSendAt(type: string, now = new Date()): Date | null {
  if (type === 'SECURITY_ALERT') return null;
  const local = new Date(now.getTime() + TZ_OFFSET);
  const h = local.getUTCHours();
  if (h >= 8 && h < 22) return null;
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TZ_OFFSET;
  return new Date(day + (h >= 22 ? 24 : 0) * 3_600_000 + 8 * 3_600_000);
}

const LAT: Record<string, string> = { 'ʻ': "'", 'ʼ': "'", '‘': "'", '’': "'", '«': '"', '»': '"', '—': '-', '–': '-', '…': '...', '≈': '~', '№': 'N' };
/** SMS: 160 lotin belgi (GSM-7), "[Quyosh] sarlavha: matn" — oshsa qisqartiriladi. */
export function smsText(title: string, body: string): string {
  const raw = `[Quyosh] ${title}: ${body}`.replace(/[ʻʼ‘’«»—–…≈№]/g, (c) => LAT[c] ?? c).replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
  return raw.length <= 160 ? raw : `${raw.slice(0, 157)}...`;
}
