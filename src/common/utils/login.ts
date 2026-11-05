/** Do‘kon va admin panellariga kirish nomi: 3–32 belgi, lotin harflari, raqamlar va . _ - (kichik harfga keltiriladi). */
export const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export const LOGIN_MESSAGE = 'Login 3–32 belgi bo‘lishi kerak: lotin harflari, raqamlar va . _ - (raqam yoki harf bilan boshlanadi)';

export const normalizeLogin = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();
export const isValidLogin = (value: string): boolean => LOGIN_PATTERN.test(value);
