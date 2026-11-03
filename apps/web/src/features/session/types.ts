import type { Role, UserStatus } from '@/types/common';

export interface Me {
  id: string;
  accountNumber: number;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Profil rasmi manzili (yuklangan rasm yoki Google rasmi). */
  avatar?: string | null;
  /** Shu akkaunt o‘ziga profil rasmi qo‘ya oladimi (admin uchun superadmin ruxsatiga bog‘liq). */
  canSetAvatar?: boolean;
  status: UserStatus;
  roles: Role[];
  createdAt?: string;
  phoneVerifiedAt?: string | null;
  /** Kirishda OTP so‘ralishi (ikki bosqichli autentifikatsiya). */
  twoFactorEnabled?: boolean;
  /** Google akkaunt ulanganmi (ulangan bo‘lsa Google orqali ham kirish mumkin). */
  googleLinked?: boolean;
  /** Akkauntda parol bormi (Google orqali ochilgan akkauntda dastlab yo‘q). */
  hasPassword?: boolean;
  googleEmail?: string | null;
  /** Superadmin: adminlarni yaratish va boshqarish huquqi. */
  isSuperAdmin?: boolean;
  /** Oddiy adminning ruxsat berilgan bo‘limlari. */
  adminPermissions?: string[];
  /** Admin yangi adminlar yarata oladimi (superadmin belgilaydi) va qaysi huquqlarni bera oladi. */
  canCreateAdmins?: boolean;
  grantablePermissions?: string[];
  masterProfile: { id: string; status: string; verification: string } | null;
}
