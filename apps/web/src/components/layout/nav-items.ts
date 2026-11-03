import {
  Activity,
  BarChart3,
  BatteryCharging,
  Bell,
  Bug,
  Calculator,
  Building2,
  ClipboardList,
  FileText,
  FileUp,
  Home,
  LayoutDashboard, LayoutTemplate,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  UserCog,
  UserRound,
  Users,
  Wrench,
  Zap,
  Heart,
  BadgeCheck,
  BookOpen,
  Images,
  Code2,
  CircleHelp,
  MessageSquareQuote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '@/types/common';
import { t } from '@/i18n';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: string;
  primary?: boolean;
  short?: string;
  /** Faqat shu huquqi bor admin (yoki superadmin) ko‘radi. */
  permission?: string;
}

const ACCOUNT = 'Hisob';

/**
 * Do‘kon hali yaratilmagan bo‘lsa, do‘kon paneli bo‘limlari bosilganda to‘g‘ridan-to‘g‘ri do‘kon ochish va
 * tekshiruvga yuborish sahifasiga (`/dokon/onboarding`) olib boradi. Boshqa bandlar (bildirishnoma, sozlamalar) o‘zgarmaydi.
 */
export function navTarget(to: string, needsShopOnboarding: boolean): { to: string; redirected: boolean } {
  const redirected = needsShopOnboarding && to.startsWith('/dokon') && to !== '/dokon/onboarding';
  return { to: redirected ? '/dokon/onboarding' : to, redirected };
}

/** Menyu elementlari joriy tilda (yorliq, qisqa nom va guruh nomi tarjima qilinadi). Guruhlar — TZ U5.5. */
export function getNavItems(role: Role | null, options: { superAdmin?: boolean; permissions?: string[]; canCreateAdmins?: boolean } = {}): NavItem[] {
  return rawNavItems(role, options).map((item) => ({ ...item, label: t(item.label), short: item.short ? t(item.short) : undefined, group: t(item.group) }));
}

function rawNavItems(role: Role | null, options: { superAdmin?: boolean; permissions?: string[]; canCreateAdmins?: boolean }): NavItem[] {
  if (role === 'ADMIN') {
    const allowed = (item: NavItem) => options.superAdmin || !item.permission || !!options.permissions?.includes(item.permission);
    return [
      { to: '/admin', label: 'Boshqaruv paneli', short: 'Panel', icon: LayoutDashboard, group: 'Umumiy', primary: true, permission: 'REPORTS' },
      { to: '/admin/hisobot', label: 'Hisobotlar', short: 'Hisobot', icon: BarChart3, group: 'Umumiy', permission: 'REPORTS' },
      { to: '/admin/devops', label: 'DevOps', icon: Activity, group: 'Umumiy', permission: 'DEVOPS' },
      { to: '/admin/foydalanuvchilar', label: 'Foydalanuvchilar', icon: Users, group: 'Boshqaruv', permission: 'USERS' },
      ...(options.superAdmin || options.canCreateAdmins ? [{ to: '/admin/adminlar', label: 'Adminlar', icon: UserCog, group: 'Boshqaruv' } satisfies NavItem] : []),
      { to: '/admin/dokonlar', label: 'Do‘konlar', icon: Store, group: 'Boshqaruv', primary: true, permission: 'SHOPS' },
      { to: '/admin/tasdiqlash', label: 'Tasdiqlash', icon: ShieldCheck, group: 'Boshqaruv', primary: true, permission: 'SHOPS' },
      { to: '/admin/sertifikatlar', label: 'Sertifikatlar', icon: BadgeCheck, group: 'Boshqaruv', permission: 'SHOPS' },
      { to: '/admin/bosh-sahifa', label: 'Bosh sahifa', icon: LayoutTemplate, group: 'Kontent', permission: 'CONTENT' },
      { to: '/admin/kontent', label: 'Bilimlar markazi', icon: BookOpen, group: 'Kontent', permission: 'CONTENT' },
      { to: '/admin/katalog', label: 'Katalog moderatsiyasi', short: 'Katalog', icon: Package, group: 'Kontent', permission: 'CATALOG' },
      { to: '/admin/sharhlar', label: 'Sharhlar va shikoyatlar', short: 'Sharhlar', icon: MessageSquareQuote, group: 'Kontent', permission: 'REVIEWS' },
      { to: '/admin/tariflar', label: 'Tariflar', icon: Zap, group: 'Kalkulyator', permission: 'TARIFFS' },
      { to: '/admin/kalkulyator', label: 'Kalkulyator sozlamalari', icon: Calculator, group: 'Kalkulyator', permission: 'CALCULATOR' },
      { to: '/admin/siyosatlar', label: 'Siyosatlar', icon: FileText, group: 'Kontent', permission: 'POLICIES' },
      { to: '/admin/yordam', label: 'Yordam navbati', icon: LifeBuoy, group: 'Boshqaruv', permission: 'SUPPORT' },
      { to: '/admin/audit', label: 'Audit jurnali', icon: ScrollText, group: 'Kontent', permission: 'AUDIT' },
      ...(options.superAdmin ? [{ to: '/admin/errorlar', label: 'Errorlar', icon: Bug, group: 'Kontent' } satisfies NavItem] : []),
      { to: '/admin/profil', label: 'Profil', icon: UserRound, group: ACCOUNT, primary: true },
      { to: '/bildirishnomalar', label: 'Bildirishnomalar', icon: Bell, group: ACCOUNT },
      { to: '/sozlamalar', label: 'Sozlamalar', icon: Settings, group: ACCOUNT },
    ].filter(allowed);
  }
  if (role === 'SHOP') {
    return [
      { to: '/dokon', label: 'Bosh panel', short: 'Panel', icon: Home, group: 'Ish', primary: true },
      { to: '/dokon/sorovlar', label: 'So‘rovlar', icon: ClipboardList, group: 'Ish', primary: true },
      { to: '/dokon/takliflar', label: 'Takliflar', icon: Receipt, group: 'Ish', primary: true },
      { to: '/dokon/montajlar', label: 'Montajlar', icon: Wrench, group: 'Ish' },
      { to: '/dokon/sharhlar', label: 'Sharhlar', icon: MessageSquareQuote, group: 'Ish' },
      { to: '/dokon/katalog', label: 'Mahsulotlar', icon: Package, group: 'Katalog' },
      { to: '/dokon/import', label: 'Import', icon: FileUp, group: 'Katalog' },
      { to: '/dokon/filiallar', label: 'Filiallar va hudud', icon: MapPin, group: 'Katalog' },
      { to: '/dokon/xizmatlar', label: 'Xizmatlar', icon: Wrench, group: 'Katalog' },
      { to: '/dokon/portfolio', label: 'Portfolio', icon: Images, group: 'Katalog' },
      { to: '/dokon/sertifikatlar', label: 'Sertifikatlar', icon: ShieldCheck, group: 'Katalog' },
      { to: '/dokon/vidjet', label: 'Vidjet', icon: Code2, group: 'Katalog' },
      { to: '/dokon/analitika', label: 'Analitika', icon: BarChart3, group: ACCOUNT },
      { to: '/dokon/xodimlar', label: 'Xodimlar', icon: Users, group: ACCOUNT },
      { to: '/bildirishnomalar', label: 'Bildirishnomalar', icon: Bell, group: ACCOUNT },
      { to: '/sozlamalar', label: 'Sozlamalar', icon: Settings, group: ACCOUNT },
    ];
  }
  return [
    { to: '/mijoz/bosh', label: 'Bosh panel', short: 'Panel', icon: Home, group: 'Asosiy' },
    { to: '/mijoz/kalkulyator', label: 'Kalkulyator', icon: Calculator, group: 'Asosiy', primary: true },
    { to: '/mijoz/hisoblar', label: 'Hisoblarim', short: 'Hisoblar', icon: BarChart3, group: 'Asosiy', primary: true },
    { to: '/mijoz/obyektlar', label: 'Obyektlarim', icon: Building2, group: 'Asosiy' },
    { to: '/mijoz/sorovlar', label: 'So‘rov va takliflar', short: 'So‘rovlar', icon: ClipboardList, group: 'Asosiy', primary: true },
    { to: '/mijoz/xarita', label: 'Do‘konlar xaritasi', short: 'Xarita', icon: MapPin, group: 'Asosiy' },
    { to: '/mijoz/kredit', label: 'Kredit kalkulyatori', short: 'Kredit', icon: Receipt, group: 'Kalkulyatorlar' },
    { to: '/mijoz/uzilish', label: 'Elektr o‘chganda', short: 'Uzilish', icon: BatteryCharging, group: 'Kalkulyatorlar' },
    { to: '/mijoz/mahsulotlar', label: 'Mahsulotlar', icon: Package, group: 'Asosiy' },
    { to: '/mijoz/dokonlar', label: 'Do‘konlar', icon: Store, group: 'Asosiy' },
    { to: '/mijoz/chat', label: 'Chat', icon: MessageCircle, group: 'Muloqot' },
    { to: '/mijoz/montajlar', label: 'Montajlar', icon: Wrench, group: 'Muloqot' },
    { to: '/mijoz/sevimlilar', label: 'Sevimlilar', icon: Heart, group: 'Muloqot' },
    { to: '/mijoz/tizimim', label: 'O‘rnatilgan tizim', short: 'Tizimim', icon: Zap, group: 'Muloqot', primary: true },
    { to: '/mijoz/murojaatlar', label: 'Murojaatlar', icon: LifeBuoy, group: 'Muloqot' },
    { to: '/mijoz/bilim', label: 'Bilimlar markazi', short: 'Bilim', icon: BookOpen, group: 'Yordam' },
    { to: '/mijoz/yordam', label: 'Yordam markazi', short: 'Yordam', icon: CircleHelp, group: 'Yordam' },
    { to: '/mijoz/profil', label: 'Profil', icon: UserRound, group: ACCOUNT, primary: true },
    { to: '/bildirishnomalar', label: 'Bildirishnomalar', icon: Bell, group: ACCOUNT },
    { to: '/sozlamalar', label: 'Sozlamalar', icon: Settings, group: ACCOUNT },
  ];
}
