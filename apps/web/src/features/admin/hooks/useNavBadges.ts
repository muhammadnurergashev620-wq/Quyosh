import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUnreadCount } from '@/features/notification/hooks/useNotifications';
import { adminService } from '../services/admin.service';

type SeenKey = 'audit' | 'users' | 'verifications';
const STORAGE_PREFIX = 'qs.seen.';
/** Doimiy shovqin: har bir sessiya yangilanishi «yangi yozuv» hisoblanmasin. */
const NOISE = new Set(['AUTH_REFRESH_ROTATED']);
const listeners = new Set<() => void>();
const seen: Record<SeenKey, string | null> = { audit: null, users: null, verifications: null };

for (const key of Object.keys(seen) as SeenKey[]) {
  try {
    seen[key] = localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    /* xotira yopiq bo‘lsa, faqat shu sessiya uchun */
  }
}

/** Adminning oxirgi ko‘rgan vaqti (server vaqti bilan solishtiriladi, soat farqi ta’sir qilmaydi). */
function markSeen(key: SeenKey, at: string) {
  if (seen[key] && seen[key]! >= at) return;
  seen[key] = at;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, at);
  } catch {
    /* e’tiborsiz */
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const useSeen = (key: SeenKey) => useSyncExternalStore(subscribe, () => seen[key]);

export interface NavBadge {
  count: number;
  /** true bo‘lsa, ko‘rsatilgan son «kamida» (masalan, 30+). */
  capped: boolean;
}
export const badgeText = (badge: NavBadge) => (badge.capped ? `${badge.count}+` : String(badge.count));

/** Yo‘l → belgi. Faqat soni 0 dan katta bo‘lganlar qaytariladi. */
export function useNavBadges(role: string | null, pathname: string): Record<string, NavBadge> {
  const admin = role === 'ADMIN';
  const usersSeen = useSeen('users');
  const auditSeen = useSeen('audit');
  const verificationsSeen = useSeen('verifications');
  const onUsers = pathname.startsWith('/admin/foydalanuvchilar');
  const onAudit = pathname.startsWith('/admin/audit');
  const onVerifications = pathname.startsWith('/admin/tasdiqlash');

  const unread = useUnreadCount();
  const adminSeenRef = useRef({ usersSeen, verificationsSeen });
  adminSeenRef.current = { usersSeen, verificationsSeen };
  const badges = useQuery({
    queryKey: ['admin', 'badges'],
    queryFn: () => {
      const v = adminSeenRef.current;
      return adminService.badges({ usersSince: v.usersSeen ?? undefined, verificationsSince: v.verificationsSeen ?? undefined });
    },
    enabled: admin,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const audit = useQuery({
    queryKey: ['admin', 'audit-latest'],
    queryFn: () => adminService.audit({}),
    enabled: admin,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const now = badges.data?.now;
  const auditItems = audit.data?.items ?? [];
  const auditNewest = auditItems[0]?.createdAt;

  // Birinchi ochilganda eski ma’lumotlar «yangi» bo‘lib chiqmasin; sahifada turganda kelganlari darhol ko‘rilgan hisoblanadi.
  useEffect(() => {
    if (!now) return;
    if (!usersSeen || onUsers) markSeen('users', now);
    if (!verificationsSeen || onVerifications) markSeen('verifications', now);
  }, [now, usersSeen, verificationsSeen, onUsers, onVerifications]);
  useEffect(() => {
    if (auditNewest && (!auditSeen || onAudit)) markSeen('audit', auditNewest);
  }, [auditNewest, auditSeen, onAudit]);

  const result: Record<string, NavBadge> = {};
  const put = (to: string, count: number, capped = false) => {
    if (count > 0) result[to] = { count, capped };
  };

  put('/bildirishnomalar', unread.data?.count ?? 0);
  if (admin) {
    const data = badges.data;
    put('/admin/tasdiqlash', onVerifications ? 0 : (data?.verifications ?? 0));
    put('/admin/foydalanuvchilar', onUsers ? 0 : (data?.users ?? 0));
    put('/admin/katalog', data?.pendingModels ?? 0);
    const fresh = auditSeen ? auditItems.filter((log) => !NOISE.has(log.action) && log.createdAt > auditSeen) : [];
    put('/admin/audit', onAudit ? 0 : fresh.length, fresh.length === auditItems.length && !!audit.data?.nextCursor);
  }
  return result;
}
