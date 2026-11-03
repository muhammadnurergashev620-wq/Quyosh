import { z } from 'zod';
import { splitFullName } from '@/lib/account-name';
import { t } from '@/i18n';

const LOCAL_PHONE_REGEX = /^\d{9}$/;
const OTP_CODE_REGEX = /^\d{6}$/;

/** O‘zbekistonda mavjud operator/hudud kodlari (backend tekshiruvi bilan bir xil). */
const UZ_PREFIXES = new Set(['20', '33', '50', '55', '61', '62', '65', '66', '67', '69', '70', '71', '72', '74', '76', '77', '78', '80', '87', '88', '90', '91', '92', '93', '94', '95', '97', '98', '99']);

/** «95 959 49 44» ko‘rinishidagi qiymatdan faqat 9 xonali raqamni ajratadi. */
export function toLocalDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length > 9 && digits.startsWith('998')) digits = digits.slice(3);
  return digits.slice(0, 9);
}

/** 9 ta raqamni «XX XXX XX XX» ko‘rinishiga keltiradi. */
export function formatLocalPhone(value: string): string {
  const d = toLocalDigits(value);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}

export const localPhoneSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(
    z
      .string()
      .regex(LOCAL_PHONE_REGEX, t('9 ta raqam kiriting (90 123 45 67)'))
      .refine((value) => UZ_PREFIXES.has(value.slice(0, 2)), t('Operator kodi noto‘g‘ri')),
  );

export const registerSchema = z
  .object({
    phoneLocal: localPhoneSchema,
    password: z.string().min(8, t('Kamida 8 ta belgi')).max(128, t('Juda uzun')),
    confirmPassword: z.string().min(1, t('Parolni qayta kiriting')),
    fullName: z.string().trim().max(200).refine((value) => splitFullName(value) !== null, t('To‘liq ismni kiriting (masalan: Kamronbek Ziyovuddinov)')),
    acceptedTerms: z.literal(true, { errorMap: () => ({ message: t('Davom etish uchun shartlarni qabul qiling.') }) }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: t('Parollar bir xil emas'),
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  phoneLocal: localPhoneSchema,
  password: z.string().min(1, t('Parolni kiriting')).max(128),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const otpSchema = z.object({
  code: z.string().regex(OTP_CODE_REGEX, t('6 xonali kodni kiriting')),
});
export type OtpFormValues = z.infer<typeof otpSchema>;

export function toFullPhone(phoneLocal: string): string {
  return `+998${phoneLocal}`;
}
