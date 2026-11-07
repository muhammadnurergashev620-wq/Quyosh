import type { AdminUser } from './types';
import { t } from '@/i18n';

export type UserAction = 'SUSPEND' | 'BLOCK' | 'ACTIVATE' | 'DELETE' | 'BLOCK_REGISTRATION' | 'ALLOW_REGISTRATION';

interface Copy {
  title: string;
  text: string;
  confirm: string;
  variant: 'primary' | 'danger';
  reasonRequired: boolean;
}

export const USER_ACTION_COPY: Record<UserAction, Copy> = {
  SUSPEND: {
    title: t('Akkauntni muzlatish'),
    text: t('Foydalanuvchi darhol tizimdan chiqariladi va qayta kira olmaydi. Do‘kon xodimi bo‘lsa, do‘kon kabinetiga ham kira olmaydi. Keyinroq qayta faollashtirish mumkin.'),
    confirm: t('Muzlatish'),
    variant: 'primary',
    reasonRequired: true,
  },
  BLOCK: {
    title: t('Akkauntni bloklash'),
    text: t('Foydalanuvchi darhol tizimdan chiqariladi va kira olmaydi. Qoidabuzarlik uchun mo‘ljallangan; keyinroq blokni bekor qilish mumkin.'),
    confirm: t('Bloklash'),
    variant: 'danger',
    reasonRequired: true,
  },
  ACTIVATE: {
    title: t('Akkauntni faollashtirish'),
    text: t('Foydalanuvchi yana tizimga kira oladi; sessiyalar qaytadan ochiladi.'),
    confirm: t('Faollashtirish'),
    variant: 'primary',
    reasonRequired: false,
  },
  DELETE: {
    title: t('Akkauntni o‘chirish'),
    text: t('Foydalanuvchi tizimga kira olmaydi va ro‘yxatdan yo‘qoladi. So‘rov, taklif va montaj tarixi saqlanadi. Bu amalni bekor qilib bo‘lmaydi.'),
    confirm: t('O‘chirish'),
    variant: 'danger',
    reasonRequired: true,
  },
  BLOCK_REGISTRATION: {
    title: t('Qayta ro‘yxatdan o‘tishni bloklash'),
    text: t('Bu telefon raqami bilan yangi akkaunt ochib bo‘lmaydi: ro‘yxatdan o‘tishga urinish tashqaridan oddiy ko‘rinadi, lekin akkaunt yaratilmaydi va kod yuborilmaydi. Istalgan payt blokni bekor qilish mumkin.'),
    confirm: t('Bloklash'),
    variant: 'danger',
    reasonRequired: false,
  },
  ALLOW_REGISTRATION: {
    title: t('Qayta ro‘yxatdan o‘tishga ruxsat berish'),
    text: t('Bu telefon raqami bilan yana yangi akkaunt ochish mumkin bo‘ladi.'),
    confirm: t('Ruxsat berish'),
    variant: 'primary',
    reasonRequired: false,
  },
};

export function displayName(user: AdminUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone;
}
