/** Google orqali ro‘yxatdan o‘tish tugagach avtomatik kirish uchun ID token faqat xotirada saqlanadi (diskka yozilmaydi). */
let credential: string | null = null;

export const googlePending = {
  set: (value: string) => {
    credential = value;
  },
  take: () => {
    const value = credential;
    credential = null;
    return value;
  },
  clear: () => {
    credential = null;
  },
};
